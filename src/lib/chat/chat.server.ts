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
  setAiEnabledForAllConversations,
  setConversationAiEnabled,
  upsertAiExample,
  upsertAiKnowledge,
} from "@/lib/chat/chat.repository";
import { clearEvolutionQrFlash, putEvolutionQrFlash, takeEvolutionQrFlash } from "@/lib/chat/evolution-qr-flash";
import {
  evolutionConnectQr,
  evolutionConnectionState,
  evolutionSendImage,
  evolutionSendText,
  ensureSomaEvolutionInstance,
  getEvolutionPublicConfig,
  getResolvedWebhookUrl,
  isEvolutionConfigured,
  type EvolutionConnectionState,
  type EvolutionQrPayload,
} from "@/lib/chat/evolution.adapter";
import {
  appendChatImageChunk,
  finalizeChatImageUpload,
  getChatImageUploadMeta,
  initChatImageUpload,
  readChatMediaBuffer,
  readChatImageAsDataUrl,
} from "@/lib/chat/chat-media.repository";
import {
  CHAT_IMAGE_CHUNK_BYTES,
  CHAT_IMAGE_MAX_BYTES,
} from "@/lib/chat/chat-media.constants";
import { isOpenAiConfigured } from "@/lib/chat/openai.adapter";
import {
  saveChatContactNote,
} from "@/lib/chat/chat-contact-note.service";
import { CHAT_CONTACT_NOTE_MAX_LENGTH } from "@/lib/chat/chat-contact-note.constants";
import { createClientAttendance } from "@/lib/clients/client-attendance.repository";
import { createClientAttachmentFromChatMedia } from "@/lib/clients/client-attachment.repository";
import {
  addProductToClient,
  createManualClient,
  getClientByIdForUser,
  updateClientStatus,
} from "@/lib/clients/clients.repository";
import { isValidAttendanceStatus } from "@/lib/clients/client-status";
import type { ClientFieldId } from "@/lib/config/client-fields";
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
  // Reaplica webhook (base64=true) em background — necessário para receber imagens
  void ensureSomaEvolutionInstance({
    webhookPublicBaseUrl: aiSettings.webhookPublicBaseUrl,
  }).catch(() => undefined);
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

/**
 * Contatos aguardando no Chatbot: qualquer conversa com unread > 0.
 * (Antes filtrávamos sem assigned — abrir o chat atribuía o atendente e zerava o alerta.)
 */
export const getChatbotIncomingAlertFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireChatUser();
  const conversations = await listConversations(200);
  const pending = conversations.filter((conversation) => conversation.unreadCount > 0);
  return {
    pendingCount: pending.length,
    conversationIds: pending.map((conversation) => conversation.id),
    /** Todos os IDs — detecta contato novo mesmo se o unread for zerado rápido. */
    allConversationIds: conversations.map((conversation) => conversation.id),
    newestCreatedAt:
      conversations
        .map((conversation) => conversation.createdAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
  };
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

export const saveChatContactNoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; note?: string };
    const conversationId = String(body.conversationId ?? "").trim();
    const note = String(body.note ?? "");
    if (!conversationId) throw new Error("Conversa obrigatória.");
    if (note.length > CHAT_CONTACT_NOTE_MAX_LENGTH) {
      throw new Error(
        `A observação deve ter no máximo ${CHAT_CONTACT_NOTE_MAX_LENGTH} caracteres.`,
      );
    }
    return { conversationId, note };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    return saveChatContactNote(data);
  });

export const attachChatMediaToClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; mediaId?: string };
    const conversationId = String(body.conversationId ?? "").trim();
    const mediaId = String(body.mediaId ?? "").trim();
    if (!conversationId || !mediaId) throw new Error("Conversa e mídia são obrigatórias.");
    return { conversationId, mediaId };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const conversation = await getConversation(data.conversationId);
    if (!conversation) throw new Error("Conversa não encontrada.");
    if (!conversation.clientId) {
      throw new Error("Vincule esta conversa a um cliente antes de anexar.");
    }
    const client = await getClientByIdForUser(
      conversation.clientId,
      user.userId,
      user.role === "master",
    );
    if (!client) throw new Error("Cliente não encontrado ou sem permissão.");

    const { meta, buffer } = await readChatMediaBuffer(data.mediaId);
    if (meta.conversationId !== conversation.id) throw new Error("Mídia não pertence a esta conversa.");
    const allowed =
      /^image\/(jpeg|png|webp)$/i.test(meta.mimeType) ||
      meta.mimeType.toLowerCase() === "application/pdf";
    if (!allowed) throw new Error("Somente imagens e documentos PDF podem ser anexados.");

    return createClientAttachmentFromChatMedia({
      clientId: conversation.clientId,
      sourceChatMediaId: meta.mediaId,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      content: buffer,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
    });
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

/** Aplica o estado geral da IA a todos os atendimentos. */
export const setChatAiGlobalEnabledFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { enabled?: boolean };
    if (typeof body.enabled !== "boolean") throw new Error("Informe se a IA deve ligar ou desligar.");
    return { enabled: body.enabled };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    const saved = await saveChatAiSettings({ aiGlobalEnabled: data.enabled });
    await setAiEnabledForAllConversations(data.enabled);
    return saved;
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
    // Enviar manualmente atribui o atendente e pausa apenas a IA desta conversa.
    await joinConversationAsAgent({
      conversationId: data.conversationId,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
    });
    await setConversationAiEnabled({
      conversationId: data.conversationId,
      aiEnabled: false,
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

    // Evolution é a parte lenta — timeout curto; UI já mostra otimista no cliente
    const send = await evolutionSendText({ phone: conversation.phone, text: data.text });
    return {
      message,
      conversation,
      evolution: { ok: send.ok, error: send.error },
    };
  });

export const initChatImageUploadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as {
      conversationId?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      totalChunks?: number;
    };
    const conversationId = String(body.conversationId ?? "").trim();
    const fileName = String(body.fileName ?? "imagem").trim().slice(0, 160);
    const mimeType = String(body.mimeType ?? "").trim().toLowerCase();
    const fileSize = Number(body.fileSize);
    const totalChunks = Number(body.totalChunks);
    if (!conversationId) throw new Error("Conversa obrigatória.");
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
      throw new Error("Use uma imagem JPG, PNG ou WEBP.");
    }
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > CHAT_IMAGE_MAX_BYTES) {
      throw new Error("A imagem deve ter no máximo 10 MB.");
    }
    if (!Number.isSafeInteger(totalChunks) || totalChunks < 1 || totalChunks > 10) {
      throw new Error("Quantidade de partes inválida.");
    }
    return { conversationId, fileName, fileSize, mimeType, totalChunks };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const conversation = await getConversation(data.conversationId);
    if (!conversation) throw new Error("Conversa não encontrada.");
    return initChatImageUpload({
      ...data,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
    });
  });

export const appendChatImageChunkFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { mediaId?: string; chunkIndex?: number; chunkBase64?: string };
    const mediaId = String(body.mediaId ?? "").trim();
    const chunkIndex = Number(body.chunkIndex);
    const chunkBase64 = String(body.chunkBase64 ?? "");
    if (!mediaId || !Number.isSafeInteger(chunkIndex) || !chunkBase64) {
      throw new Error("Parte da imagem inválida.");
    }
    // 1 MiB binário vira ~1.4 MiB base64; margem pequena para padding.
    if (chunkBase64.length > Math.ceil((CHAT_IMAGE_CHUNK_BYTES * 4) / 3) + 16) {
      throw new Error("Parte da imagem acima do limite.");
    }
    return { mediaId, chunkIndex, chunkBase64 };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const meta = await getChatImageUploadMeta(data.mediaId);
    if (!meta || meta.userId !== user.userId) throw new Error("Upload não encontrado.");
    return appendChatImageChunk(data.mediaId, data.chunkIndex, data.chunkBase64);
  });

export const finalizeAndSendChatImageFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { mediaId?: string; caption?: string };
    const mediaId = String(body.mediaId ?? "").trim();
    const caption = String(body.caption ?? "").trim().slice(0, 1024);
    if (!mediaId) throw new Error("Imagem obrigatória.");
    return { mediaId, caption };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const pending = await getChatImageUploadMeta(data.mediaId);
    if (!pending || pending.userId !== user.userId) throw new Error("Upload não encontrado.");
    const conversation = await getConversation(pending.conversationId);
    if (!conversation) throw new Error("Conversa não encontrada.");

    const meta = await finalizeChatImageUpload(data.mediaId);
    await joinConversationAsAgent({
      conversationId: conversation.id,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
    });
    await setConversationAiEnabled({ conversationId: conversation.id, aiEnabled: false });

    const message = await appendMessage({
      conversationId: conversation.id,
      direction: "outbound",
      body: data.caption,
      messageType: "image",
      mediaId: meta.mediaId,
      mediaMimeType: meta.mimeType,
      mediaFileName: meta.fileName,
      senderType: "agent",
      senderUserId: user.userId,
      senderName: user.name || user.email || "Atendente",
    });
    // Envio Evolution em background: a UI recebe a mensagem persistida na hora
    // e uma eventual falha vira mensagem de sistema no thread (aparece no poll).
    void sendChatImageViaEvolutionInBackground({
      mediaId: meta.mediaId,
      conversationId: conversation.id,
      phone: conversation.phone,
      mimeType: meta.mimeType,
      fileName: meta.fileName,
      caption: data.caption,
    });
    const updatedConversation = await getConversation(conversation.id);
    return {
      message,
      conversation: updatedConversation,
      evolution: { ok: true, error: undefined as string | undefined },
    };
  });

async function sendChatImageViaEvolutionInBackground(input: {
  mediaId: string;
  conversationId: string;
  phone: string;
  mimeType: string;
  fileName: string;
  caption: string;
}): Promise<void> {
  try {
    const { dataUrl } = await readChatImageAsDataUrl(input.mediaId);
    const send = await evolutionSendImage({
      phone: input.phone,
      dataUrl,
      mimeType: input.mimeType,
      fileName: input.fileName,
      caption: input.caption,
    });
    if (!send.ok) {
      await appendMessage({
        conversationId: input.conversationId,
        direction: "outbound",
        body: `⚠️ A imagem foi salva no CRM, mas não foi entregue no WhatsApp: ${send.error ?? "erro desconhecido"}. Envie novamente.`,
        senderType: "system",
        senderName: "Sistema",
      });
    }
  } catch (error) {
    console.error(
      `[chat] Falha no envio da imagem ${input.mediaId} via Evolution:`,
      error instanceof Error ? error.message : error,
    );
    await appendMessage({
      conversationId: input.conversationId,
      direction: "outbound",
      body: "⚠️ A imagem foi salva no CRM, mas não foi entregue no WhatsApp. Envie novamente.",
      senderType: "system",
      senderName: "Sistema",
    }).catch(() => undefined);
  }
}

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

export const addChatClientProductFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; productId?: string };
    const conversationId = String(body.conversationId ?? "").trim();
    const productId = String(body.productId ?? "").trim();
    if (!conversationId || !productId) {
      throw new Error("Conversa e produto são obrigatórios.");
    }
    return { conversationId, productId };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const conversation = await getConversation(data.conversationId);
    if (!conversation?.clientId) throw new Error("Conversa sem cliente vinculado.");

    const settings = await loadSystemSettingsFromDisk();
    const product = settings.products.find((item) => item.id === data.productId);
    if (!product) throw new Error("Produto não encontrado.");
    if (conversation.clientProductIds?.includes(product.id)) {
      throw new Error("Este cliente já possui o produto.");
    }

    await addProductToClient(
      conversation.clientId,
      user.userId,
      user.role === "master",
      product.id,
    );
    await createClientAttendance({
      clientId: conversation.clientId,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
      note: `[WhatsApp] Produto adicionado: ${product.name}`,
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

/** Cria cliente no CRM (produto + campos) e vincula à conversa WhatsApp. */
export const createAndLinkChatClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as {
      conversationId?: string;
      productId?: string;
      statusId?: string;
      data?: Partial<Record<ClientFieldId, string>>;
    };
    const conversationId = String(body.conversationId ?? "").trim();
    const productId = String(body.productId ?? "").trim();
    const statusId = String(body.statusId ?? "novo").trim() || "novo";
    if (!conversationId) throw new Error("Conversa obrigatória.");
    if (!productId) throw new Error("Selecione o produto.");
    if (!body.data || typeof body.data !== "object") throw new Error("Preencha os dados do cliente.");
    return { conversationId, productId, statusId, data: body.data };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const conversation = await getConversation(data.conversationId);
    if (!conversation) throw new Error("Conversa não encontrada.");
    if (conversation.clientId) {
      throw new Error("Esta conversa já está vinculada a um cliente.");
    }

    const settings = await loadSystemSettingsFromDisk();
    if (!isValidAttendanceStatus(data.statusId, settings)) {
      throw new Error("Status do atendimento inválido.");
    }

    const client = await createManualClient({
      productId: data.productId,
      data: data.data,
      distribution: { type: "users", userIds: [user.userId] },
    });

    if (data.statusId !== "novo" && data.statusId !== client.status) {
      await updateClientStatus(client.id, user.userId, user.role === "master", data.statusId);
    }

    await linkConversationClient(data.conversationId, client.id);

    const label =
      settings.attendanceStatuses.find((s) => s.id === data.statusId)?.label ?? data.statusId;
    await createClientAttendance({
      clientId: client.id,
      userId: user.userId,
      userName: user.name || user.email || "Atendente",
      note: `[WhatsApp] Cliente vinculado · status: ${label}`,
    });

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
    const saved = await saveChatAiSettings(data);
    if (typeof data.aiGlobalEnabled === "boolean") {
      await setAiEnabledForAllConversations(data.aiGlobalEnabled);
    }
    return saved;
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
  const user = await requireChatBotSettingsUser();
  const config = getEvolutionPublicConfig();
  if (!config.configured) {
    return {
      config,
      state: "unknown" as const,
      ok: false,
      error: "Evolution API não configurada no servidor (.env.local).",
    };
  }
  const settings = await getChatAiSettings();
  await ensureSomaEvolutionInstance({
    webhookPublicBaseUrl: settings.webhookPublicBaseUrl,
  });
  const status = await evolutionConnectionState();
  putEvolutionQrFlash(user.userId, {
    state: status.state,
    qr: status.state === "open" ? {} : (takeEvolutionQrFlash(user.userId)?.qr ?? {}),
    error: status.error,
  });
  return {
    config,
    state: status.state,
    ok: status.ok,
    error: status.error,
  };
});

export const refreshEvolutionQrFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireChatBotSettingsUser();
  const config = getEvolutionPublicConfig();
  if (!config.configured) {
    clearEvolutionQrFlash(user.userId);
    return {
      config,
      state: "unknown" as const,
      qr: {},
      ok: false,
      error: "Evolution API não configurada no servidor (.env.local).",
    };
  }
  const settings = await getChatAiSettings();
  const ensured = await ensureSomaEvolutionInstance({
    webhookPublicBaseUrl: settings.webhookPublicBaseUrl,
  });
  if (!ensured.ok) {
    putEvolutionQrFlash(user.userId, {
      state: "unknown",
      qr: {},
      error: ensured.error,
    });
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
    clearEvolutionQrFlash(user.userId);
    return {
      config,
      state: "open" as const,
      qr: {},
      ok: true,
      error: undefined,
    };
  }
  const connect = await evolutionConnectQr();
  putEvolutionQrFlash(user.userId, {
    state: connect.state,
    qr: connect.qr ?? {},
    error: connect.error,
  });
  return {
    config,
    state: connect.state,
    qr: connect.qr,
    ok: connect.ok,
    error: connect.error,
  };
});
