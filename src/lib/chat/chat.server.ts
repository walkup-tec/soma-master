import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig, type SessionData } from "@/lib/auth/session-config";
import {
  appendMessage,
  deleteAiExample,
  deleteAiKnowledge,
  getChatAiSettings,
  getConversation,
  joinConversationAsAgent,
  linkConversationClient,
  listAiExamples,
  listAiKnowledge,
  listConversations,
  getOrCreateConversationByPhone,
  listMessages,
  markConversationRead,
  saveChatAiSettings,
  setConversationAiEnabled,
  upsertAiExample,
  upsertAiKnowledge,
} from "@/lib/chat/chat.repository";
import { takeEvolutionQrFlash } from "@/lib/chat/evolution-qr-flash";
import {
  evolutionConnectQr,
  evolutionConnectionState,
  evolutionSendText,
  ensureSomaEvolutionInstance,
  getEvolutionPublicConfig,
  getResolvedWebhookUrl,
  isEvolutionConfigured,
  type EvolutionConnectionState,
  type EvolutionQrPayload,
} from "@/lib/chat/evolution.adapter";
import { isOpenAiConfigured } from "@/lib/chat/openai.adapter";
import { createClientAttendance } from "@/lib/clients/client-attendance.repository";
import { updateClientStatus } from "@/lib/clients/clients.repository";
import { isValidAttendanceStatus } from "@/lib/clients/client-status";
import { loadSystemSettingsFromDisk } from "@/lib/config/settings.repository";

async function requireChatUser(): Promise<SessionData> {
  const session = await getSession(sessionConfig);
  const user = session.data;
  if (!user?.userId) throw new Error("Não autenticado.");
  if (!sessionCanAccessMenu(user, "chat")) {
    throw new Error("Sem permissão para acessar o Chat.");
  }
  return user;
}

/** ChatBot em Configurações: chat ou master (configurações). */
async function requireChatBotSettingsUser(): Promise<SessionData> {
  const session = await getSession(sessionConfig);
  const user = session.data;
  if (!user?.userId) throw new Error("Não autenticado.");
  const allowed =
    user.role === "master" ||
    sessionCanAccessMenu(user, "configuracoes") ||
    sessionCanAccessMenu(user, "chat");
  if (!allowed) {
    throw new Error("Sem permissão para configurar o ChatBot.");
  }
  return user;
}

export const getChatBootstrapFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireChatUser();
  const [conversations, aiSettings] = await Promise.all([listConversations(), getChatAiSettings()]);
  return {
    conversations,
    aiSettings,
    evolutionConfigured: isEvolutionConfigured(),
    openAiConfigured: isOpenAiConfigured(),
    currentUserId: user.userId,
  };
});

export const listChatConversationsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireChatUser();
  return listConversations();
});

export const getChatThreadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const conversationId = String((data as { conversationId?: string })?.conversationId ?? "").trim();
    if (!conversationId) throw new Error("Conversa obrigatória.");
    return { conversationId };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    const conversation = await getConversation(data.conversationId);
    if (!conversation) throw new Error("Conversa não encontrada.");
    await markConversationRead(data.conversationId);
    const messages = await listMessages(data.conversationId);
    return { conversation, messages };
  });

export const joinChatConversationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const conversationId = String((data as { conversationId?: string })?.conversationId ?? "").trim();
    if (!conversationId) throw new Error("Conversa obrigatória.");
    return { conversationId };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    return joinConversationAsAgent({
      conversationId: data.conversationId,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
    });
  });

export const setChatConversationAiFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; aiEnabled?: boolean };
    const conversationId = String(body.conversationId ?? "").trim();
    if (!conversationId) throw new Error("Conversa obrigatória.");
    return { conversationId, aiEnabled: Boolean(body.aiEnabled) };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    await setConversationAiEnabled(data);
    return getConversation(data.conversationId);
  });

export const sendChatMessageFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; text?: string };
    const conversationId = String(body.conversationId ?? "").trim();
    const text = String(body.text ?? "").trim();
    if (!conversationId || !text) throw new Error("Conversa e texto são obrigatórios.");
    return { conversationId, text };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    // Enviar mensagem = entrar no atendimento (pausa IA desta conversa)
    await joinConversationAsAgent({
      conversationId: data.conversationId,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
    });

    const conversation = await getConversation(data.conversationId);
    if (!conversation) throw new Error("Conversa não encontrada.");

    const message = await appendMessage({
      conversationId: data.conversationId,
      direction: "outbound",
      body: data.text,
      senderType: "agent",
      senderUserId: user.userId,
      senderName: user.name || user.email || "Atendente",
    });

    const send = await evolutionSendText({ phone: conversation.phone, text: data.text });
    return { message, evolution: send };
  });

export const addChatAttendanceNoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; note?: string };
    const conversationId = String(body.conversationId ?? "").trim();
    const note = String(body.note ?? "").trim();
    if (!conversationId || !note) throw new Error("Conversa e nota são obrigatórias.");
    return { conversationId, note };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const conversation = await getConversation(data.conversationId);
    if (!conversation?.clientId) {
      throw new Error("Vincule a conversa a um cliente do CRM para registrar o atendimento.");
    }

    const attendance = await createClientAttendance({
      clientId: conversation.clientId,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
      note: `[WhatsApp] ${data.note}`,
    });

    await appendMessage({
      conversationId: data.conversationId,
      direction: "outbound",
      body: `Nota de atendimento registrada: ${data.note}`,
      senderType: "system",
      senderName: "Sistema",
    });

    return attendance;
  });

export const setChatClientStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; statusId?: string };
    const conversationId = String(body.conversationId ?? "").trim();
    const statusId = String(body.statusId ?? "").trim();
    if (!conversationId || !statusId) throw new Error("Conversa e status são obrigatórios.");
    return { conversationId, statusId };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const conversation = await getConversation(data.conversationId);
    if (!conversation?.clientId) {
      throw new Error("Vincule a conversa a um cliente do CRM para alterar o status.");
    }
    const settings = await loadSystemSettingsFromDisk();
    if (!isValidAttendanceStatus(data.statusId, settings)) {
      throw new Error("Status inválido.");
    }
    await updateClientStatus(
      conversation.clientId,
      user.userId,
      user.role === "master",
      data.statusId,
    );

    const settingsAfter = await loadSystemSettingsFromDisk();
    const label = settingsAfter.attendanceStatuses.find((s) => s.id === data.statusId)?.label ?? data.statusId;
    await createClientAttendance({
      clientId: conversation.clientId,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
      note: `[WhatsApp] Status alterado para: ${label}`,
    });

    return getConversation(data.conversationId);
  });

export const linkChatClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; clientId?: string | null };
    const conversationId = String(body.conversationId ?? "").trim();
    if (!conversationId) throw new Error("Conversa obrigatória.");
    return {
      conversationId,
      clientId: body.clientId ? String(body.clientId).trim() : null,
    };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    await linkConversationClient(data.conversationId, data.clientId);
    return getConversation(data.conversationId);
  });

export const getChatAiEducationFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireChatBotSettingsUser();
  const [settings, knowledge, examples] = await Promise.all([
    getChatAiSettings(),
    listAiKnowledge(),
    listAiExamples(),
  ]);
  return {
    settings,
    knowledge,
    examples,
    openAiConfigured: isOpenAiConfigured(),
  };
});

/** Loader da aba ChatBot — Integração EVO unificada (conexão + webhook + IA). */
export const getChatbotSettingsLoaderFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireChatBotSettingsUser();
  const [aiSettings, knowledge, examples] = await Promise.all([
    getChatAiSettings(),
    listAiKnowledge(),
    listAiExamples(),
  ]);

  const config = getEvolutionPublicConfig();
  const flash = takeEvolutionQrFlash(user.userId);
  const webhookUrl = getResolvedWebhookUrl(aiSettings.webhookPublicBaseUrl);
  const evo: {
    configured: boolean;
    apiUrlHost: string | null;
    instance: string | null;
    state: EvolutionConnectionState;
    qr: EvolutionQrPayload;
    error?: string | null;
    webhookUrl: string | null;
    webhookPublicBaseUrl: string;
    webhookReady: boolean;
  } = {
    configured: config.configured,
    apiUrlHost: config.apiUrlHost,
    instance: config.instance,
    state: flash?.state ?? "unknown",
    qr: flash?.qr ?? {},
    error:
      flash?.error ??
      (config.configured ? null : "Evolution API não configurada no servidor (.env.local)."),
    webhookUrl,
    webhookPublicBaseUrl: aiSettings.webhookPublicBaseUrl,
    webhookReady: Boolean(webhookUrl),
  };

  return {
    evo,
    education: {
      settings: aiSettings,
      knowledge,
      examples,
      openAiConfigured: isOpenAiConfigured(),
    },
  };
});

/** Simula inbound WhatsApp (dev/local sem webhook público). */
export const injectChatTestInboundFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { phone?: string; text?: string; contactName?: string };
    const phone = String(body.phone ?? "").replace(/\D/g, "");
    const text = String(body.text ?? "").trim();
    if (phone.length < 10) throw new Error("Informe um telefone válido (DDD + número).");
    if (!text) throw new Error("Informe o texto da mensagem de teste.");
    return {
      phone,
      text,
      contactName: String(body.contactName ?? "Contato teste").trim() || "Contato teste",
    };
  })
  .handler(async ({ data }) => {
    await requireChatBotSettingsUser();
    const conversation = await getOrCreateConversationByPhone({
      phone: data.phone,
      contactName: data.contactName,
    });
    await appendMessage({
      conversationId: conversation.id,
      direction: "inbound",
      body: data.text,
      senderType: "contact",
      senderName: data.contactName,
      bumpUnread: true,
    });
    return { conversationId: conversation.id };
  });

export const saveChatAiEducationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as {
      aiGlobalEnabled?: boolean;
      openaiModel?: string;
      systemPrompt?: string;
    };
    return {
      aiGlobalEnabled: body.aiGlobalEnabled,
      openaiModel: body.openaiModel,
      systemPrompt: body.systemPrompt,
    };
  })
  .handler(async ({ data }) => {
    await requireChatBotSettingsUser();
    return saveChatAiSettings(data);
  });

export const upsertChatAiKnowledgeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as {
      id?: string;
      title?: string;
      content?: string;
      enabled?: boolean;
      sortOrder?: number;
    };
    return {
      id: String(body.id ?? `know-${crypto.randomUUID().slice(0, 8)}`),
      title: String(body.title ?? ""),
      content: String(body.content ?? ""),
      enabled: body.enabled !== false,
      sortOrder: Number(body.sortOrder ?? 0) || 0,
    };
  })
  .handler(async ({ data }) => {
    await requireChatBotSettingsUser();
    return upsertAiKnowledge(data);
  });

export const deleteChatAiKnowledgeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const id = String((data as { id?: string })?.id ?? "").trim();
    if (!id) throw new Error("ID obrigatório.");
    return { id };
  })
  .handler(async ({ data }) => {
    await requireChatBotSettingsUser();
    await deleteAiKnowledge(data.id);
    return { ok: true };
  });

export const upsertChatAiExampleFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as {
      id?: string;
      userSays?: string;
      assistantReplies?: string;
      enabled?: boolean;
      sortOrder?: number;
    };
    return {
      id: String(body.id ?? `ex-${crypto.randomUUID().slice(0, 8)}`),
      userSays: String(body.userSays ?? ""),
      assistantReplies: String(body.assistantReplies ?? ""),
      enabled: body.enabled !== false,
      sortOrder: Number(body.sortOrder ?? 0) || 0,
    };
  })
  .handler(async ({ data }) => {
    await requireChatBotSettingsUser();
    return upsertAiExample(data);
  });

export const deleteChatAiExampleFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const id = String((data as { id?: string })?.id ?? "").trim();
    if (!id) throw new Error("ID obrigatório.");
    return { id };
  })
  .handler(async ({ data }) => {
    await requireChatBotSettingsUser();
    await deleteAiExample(data.id);
    return { ok: true };
  });

export const getEvolutionConnectionStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireChatBotSettingsUser();
  const config = getEvolutionPublicConfig();
  if (!config.configured) {
    return {
      config,
      state: "unknown" as const,
      ok: false,
      error: "Evolution API não configurada no servidor (.env.local).",
    };
  }
  // Garante instância soma-* (não toca nas demais do Easypanel)
  await ensureSomaEvolutionInstance();
  const status = await evolutionConnectionState();
  return {
    config,
    state: status.state,
    ok: status.ok,
    error: status.error,
  };
});

export const refreshEvolutionQrFn = createServerFn({ method: "POST" }).handler(async () => {
  await requireChatBotSettingsUser();
  const config = getEvolutionPublicConfig();
  if (!config.configured) {
    return {
      config,
      state: "unknown" as const,
      qr: {},
      ok: false,
      error: "Evolution API não configurada no servidor (.env.local).",
    };
  }
  const ensured = await ensureSomaEvolutionInstance();
  if (!ensured.ok) {
    return {
      config,
      state: "unknown" as const,
      qr: {},
      ok: false,
      error: ensured.error,
    };
  }
  const connected = await evolutionConnectionState();
  if (connected.ok && connected.state === "open") {
    return {
      config,
      state: "open" as const,
      qr: {},
      ok: true,
      error: undefined,
    };
  }
  const connect = await evolutionConnectQr();
  return {
    config,
    state: connect.state,
    qr: connect.qr,
    ok: connect.ok,
    error: connect.error,
  };
});
