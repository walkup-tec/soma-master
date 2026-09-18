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
  listMessagesPage,
  markConversationRead,
  saveChatAiSettings,
  setAiEnabledForAllConversations,
  setBotEnabledForAllConversations,
  setConversationAiEnabled,
  setConversationBotEnabled,
  disableConversationAutomation,
  transferConversation,
  unassignConversation,
  upsertAiExample,
  upsertAiKnowledge,
} from "@/lib/chat/chat.repository";
import { clearEvolutionQrFlash, putEvolutionQrFlash, takeEvolutionQrFlash } from "@/lib/chat/evolution-qr-flash";
import {
  evolutionConnectQr,
  evolutionConnectionState,
  evolutionDeleteInstance,
  evolutionFetchInstancePhone,
  evolutionSetInstanceWebhook,
  ensureSomaEvolutionInstance,
  getDefaultSomaEvolutionInstance,
  getEvolutionPublicConfig,
  getResolvedWebhookUrl,
  isEvolutionConfigured,
  type EvolutionConnectionState,
  type EvolutionQrPayload,
} from "@/lib/chat/evolution.adapter";
import { sendChannelImage, sendChannelText } from "@/lib/chat/channel-outbound";
import { completeMetaEmbeddedSignup } from "@/lib/chat/meta-cloud/meta-cloud-complete";
import { instanceIsMetaCloud } from "@/lib/chat/meta-cloud/meta-cloud.adapter";
import { isMetaCloudInstanceName } from "@/lib/chat/meta-cloud/meta-cloud.constants";
import { isMetaCloudConfigured, toPublicMetaEsConfig } from "@/lib/chat/meta-cloud/meta-config";
import {
  syncRegisteredCloudNumbersToWaba,
  unregisterSomaCloudNumberOnWaba,
} from "@/lib/chat/meta-cloud/waba-cloud-relay";
import {
  createWhatsappInstance,
  deleteWhatsappInstance,
  getWhatsappInstanceByName,
  listWhatsappInstances,
  updateWhatsappInstancePhone,
} from "@/lib/chat/whatsapp-instances.repository";
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
import { touchAgentPresence } from "@/lib/chat/agent-presence.repository";
import { findUserById, listAllUsers } from "@/lib/users/user.repository";

async function requireChatUser(): Promise<SessionData> {
  const session = await getSession(sessionConfig);
  const user = session.data as SessionData | undefined;
  if (!user?.userId) throw new Error("Não autenticado.");
  if (!sessionCanAccessMenu(user, "chat")) {
    throw new Error("Sem permissão para acessar o Chat.");
  }
  void touchAgentPresence(user.userId);
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
  // Webhook só nas instâncias Evolution já cadastradas — não recria canal excluído.
  // Números Cloud já conectados (antes do relay) precisam ser reenviados ao WABA.
  void listWhatsappInstances()
    .then(async (instances) => {
      void syncRegisteredCloudNumbersToWaba(instances).catch(() => undefined);
      for (const item of instances) {
        if (instanceIsMetaCloud(item)) continue;
        await evolutionSetInstanceWebhook(
          null,
          aiSettings.webhookPublicBaseUrl,
          item.instanceName,
        ).catch(() => undefined);
      }
    })
    .catch(() => undefined);
  return {
    conversations,
    aiSettings,
    evolutionConfigured: isEvolutionConfigured(),
    openAiConfigured: isOpenAiConfigured(),
    currentUserId: user.userId,
    currentUserRole: user.role,
  };
});

export const listChatConversationsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireChatUser();
  return listConversations();
});

/**
 * Snapshot de alertas do Chatbot (topo = contato novo; menu = unread / aguardando interação).
 */
export const getChatbotIncomingAlertFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireChatUser();
  const conversations = await listConversations(80);
  const unreadByConversationId: Record<string, number> = {};
  for (const conversation of conversations) {
    if (conversation.unreadCount > 0) {
      unreadByConversationId[conversation.id] = conversation.unreadCount;
    }
  }
  const unreadIds = Object.keys(unreadByConversationId);
  const awaitingAssignedIds = conversations
    .filter(
      (conversation) =>
        conversation.assignedUserId === user.userId && conversation.awaitingAgentReply === true,
    )
    .map((conversation) => conversation.id);
  return {
    pendingCount: unreadIds.length,
    conversationIds: unreadIds,
    unreadByConversationId,
    allConversationIds: conversations.map((conversation) => conversation.id),
    awaitingAssignedCount: awaitingAssignedIds.length,
    awaitingAssignedIds,
    newestCreatedAt:
      conversations
        .map((conversation) => conversation.createdAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
  };
});

const CHAT_THREAD_PAGE_SIZE = 20;

export const getChatThreadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as {
      conversationId?: string;
      markAsRead?: boolean;
      limit?: number;
    };
    const conversationId = String(body?.conversationId ?? "").trim();
    if (!conversationId) throw new Error("Conversa obrigatória.");
    const limitRaw = Number(body?.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100)
      : CHAT_THREAD_PAGE_SIZE;
    return {
      conversationId,
      markAsRead: body?.markAsRead === true,
      limit,
    };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    const conversation = await getConversation(data.conversationId);
    if (!conversation) throw new Error("Conversa não encontrada.");
    if (data.markAsRead) {
      await markConversationRead(data.conversationId);
      conversation.unreadCount = 0;
    }
    const page = await listMessagesPage({
      conversationId: data.conversationId,
      limit: data.limit,
    });
    return {
      conversation,
      messages: page.messages,
      hasMore: page.hasMore,
    };
  });

/** Carrega mensagens mais antigas (scroll para cima). */
export const loadOlderChatMessagesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as {
      conversationId?: string;
      beforeCreatedAt?: string;
      limit?: number;
    };
    const conversationId = String(body?.conversationId ?? "").trim();
    const beforeCreatedAt = String(body?.beforeCreatedAt ?? "").trim();
    if (!conversationId) throw new Error("Conversa obrigatória.");
    if (!beforeCreatedAt) throw new Error("Cursor de paginação obrigatório.");
    const limitRaw = Number(body?.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100)
      : CHAT_THREAD_PAGE_SIZE;
    return { conversationId, beforeCreatedAt, limit };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    const conversation = await getConversation(data.conversationId);
    if (!conversation) throw new Error("Conversa não encontrada.");
    return listMessagesPage({
      conversationId: data.conversationId,
      beforeCreatedAt: data.beforeCreatedAt,
      limit: data.limit,
    });
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

/** Remove atribuição — conversa volta para o filtro Não atribuídos. */
export const unassignChatConversationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const conversationId = String((data as { conversationId?: string })?.conversationId ?? "").trim();
    if (!conversationId) throw new Error("Conversa obrigatória.");
    return { conversationId };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    return unassignConversation(data.conversationId);
  });

/** Usuários que podem receber transferência (acesso ao menu Chat, exceto o atual). */
export const listChatTransferTargetsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireChatUser();
  const [users, settings] = await Promise.all([listAllUsers(), loadSystemSettingsFromDisk()]);
  const chatCategoryIds = new Set(
    settings.categories.filter((category) => category.menuIds.includes("chat")).map((c) => c.id),
  );
  return users
    .filter((candidate) => candidate.id !== user.userId)
    .filter((candidate) => candidate.role === "master" || chatCategoryIds.has(candidate.categoryId))
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
});

/** Transfere conversa para outro atendente → Meus do destinatário. */
export const transferChatConversationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; toUserId?: string };
    const conversationId = String(body.conversationId ?? "").trim();
    const toUserId = String(body.toUserId ?? "").trim();
    if (!conversationId) throw new Error("Conversa obrigatória.");
    if (!toUserId) throw new Error("Selecione o usuário de destino.");
    return { conversationId, toUserId };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const target = await findUserById(data.toUserId);
    if (!target) throw new Error("Usuário de destino não encontrado.");
    return transferConversation({
      conversationId: data.conversationId,
      fromUserId: user.userId,
      fromUserName: user.name || user.email || "Atendente",
      toUserId: target.id,
      toUserName: target.name || target.email || "Atendente",
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

export const setChatConversationBotFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; botEnabled?: boolean };
    const conversationId = String(body.conversationId ?? "").trim();
    if (!conversationId) throw new Error("Conversa obrigatória.");
    return { conversationId, botEnabled: Boolean(body.botEnabled) };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    await setConversationBotEnabled(data);
    return getConversation(data.conversationId);
  });

/** Lista bots disponíveis para envio manual no Chat (id + nome). */
export const listChatBotsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireChatUser();
  const { listBotFlowsFromServer } = await import("@/lib/bots/bot-flow.repository");
  const flows = await listBotFlowsFromServer();
  return flows
    .map((flow) => ({
      id: flow.id,
      name: String(flow.name || "Bot sem nome").trim() || "Bot sem nome",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
});

/** Atendente dispara um bot na conversa aberta. */
export const startChatBotFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { conversationId?: string; botId?: string };
    const conversationId = String(body.conversationId ?? "").trim();
    const botId = String(body.botId ?? "").trim();
    if (!conversationId || !botId) throw new Error("Conversa e bot são obrigatórios.");
    return { conversationId, botId };
  })
  .handler(async ({ data }) => {
    const user = await requireChatUser();
    const { startBotOnConversation } = await import("@/lib/bots/bot-inbound.service");
    const result = await startBotOnConversation({
      conversationId: data.conversationId,
      botId: data.botId,
      startedByName: user.name || user.email || "Atendente",
    });
    if (!result.ok) throw new Error(result.error);
    const conversation = await getConversation(data.conversationId);
    return { ...result, conversation };
  });

/** Aplica o estado geral da IA a todos os atendimentos. Ligar IA desliga Bot. */
export const setChatAiGlobalEnabledFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { enabled?: boolean };
    if (typeof body.enabled !== "boolean") throw new Error("Informe se a IA deve ligar ou desligar.");
    return { enabled: body.enabled };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    const saved = await saveChatAiSettings({
      aiGlobalEnabled: data.enabled,
      ...(data.enabled ? { botGlobalEnabled: false } : {}),
    });
    await setAiEnabledForAllConversations(data.enabled);
    return saved;
  });

/** Aplica o estado geral do Bot a todos os atendimentos. Ligar Bot desliga IA. */
export const setChatBotGlobalEnabledFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as { enabled?: boolean };
    if (typeof body.enabled !== "boolean") throw new Error("Informe se o Bot deve ligar ou desligar.");
    return { enabled: body.enabled };
  })
  .handler(async ({ data }) => {
    await requireChatUser();
    const saved = await saveChatAiSettings({
      botGlobalEnabled: data.enabled,
      ...(data.enabled ? { aiGlobalEnabled: false } : {}),
    });
    await setBotEnabledForAllConversations(data.enabled);
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
    // Enviar NÃO atribui — só o botão Atribuir coloca em Meus.
    await disableConversationAutomation(data.conversationId);
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

    // Evolution em background: UI já mostra otimista; falha vira aviso no thread no próximo poll.
    void sendChatTextInBackground({
      conversationId: data.conversationId,
      phone: conversation.phone,
      text: data.text,
      instanceName: conversation.instanceName,
    });

    const updatedConversation = await getConversation(data.conversationId);
    return {
      message,
      conversation: updatedConversation ?? conversation,
      evolution: { ok: true, error: undefined as string | undefined },
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
    // Enviar imagem NÃO atribui — só o botão Atribuir coloca em Meus.
    await disableConversationAutomation(conversation.id);

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
    void sendChatImageInBackground({
      mediaId: meta.mediaId,
      conversationId: conversation.id,
      phone: conversation.phone,
      mimeType: meta.mimeType,
      fileName: meta.fileName,
      caption: data.caption,
      instanceName: conversation.instanceName,
    });
    const updatedConversation = await getConversation(conversation.id);
    return {
      message,
      conversation: updatedConversation,
      evolution: { ok: true, error: undefined as string | undefined },
    };
  });

async function sendChatTextInBackground(input: {
  conversationId: string;
  phone: string;
  text: string;
  instanceName?: string | null;
}): Promise<void> {
  try {
    const send = await sendChannelText({
      phone: input.phone,
      text: input.text,
      instanceName: input.instanceName ?? undefined,
      conversationId: input.conversationId,
    });
    if (!send.ok) {
      await appendMessage({
        conversationId: input.conversationId,
        direction: "outbound",
        body: `⚠️ Mensagem salva no CRM, mas não foi entregue no WhatsApp: ${send.error ?? "erro desconhecido"}. Envie novamente.`,
        senderType: "system",
        senderName: "Sistema",
      });
    }
  } catch (error) {
    console.error(
      `[chat] Falha no envio de texto (conversa ${input.conversationId}):`,
      error instanceof Error ? error.message : error,
    );
    await appendMessage({
      conversationId: input.conversationId,
      direction: "outbound",
      body: "⚠️ Mensagem salva no CRM, mas não foi entregue no WhatsApp. Envie novamente.",
      senderType: "system",
      senderName: "Sistema",
    }).catch(() => undefined);
  }
}

async function sendChatImageInBackground(input: {
  mediaId: string;
  conversationId: string;
  phone: string;
  mimeType: string;
  fileName: string;
  caption: string;
  instanceName?: string | null;
}): Promise<void> {
  try {
    const { dataUrl } = await readChatImageAsDataUrl(input.mediaId);
    const send = await sendChannelImage({
      phone: input.phone,
      dataUrl,
      mimeType: input.mimeType,
      fileName: input.fileName,
      caption: input.caption,
      instanceName: input.instanceName ?? undefined,
      conversationId: input.conversationId,
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
      `[chat] Falha no envio da imagem ${input.mediaId}:`,
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
  const instances = await listWhatsappInstances();
  const webhookUrl = getResolvedWebhookUrl(aiSettings.webhookPublicBaseUrl);
  const cloudRelay = await syncRegisteredCloudNumbersToWaba(instances).catch(
    () => new Map<string, { ok: boolean; error?: string }>(),
  );

  const channels = await Promise.all(
    instances.map(async (item) => {
      const isCloud = instanceIsMetaCloud(item);
      const relay = item.phoneNumberId ? cloudRelay.get(item.phoneNumberId) : undefined;
      const flash = isCloud ? null : takeEvolutionQrFlash(user.userId, item.instanceName);
      let state: EvolutionConnectionState = isCloud
        ? item.accessTokenEncrypted && item.phoneNumberId
          ? "open"
          : "close"
        : (flash?.state ?? "unknown");
      let error = flash?.error ?? null;
      let phone = item.phone;
      if (!isCloud && config.configured && !flash) {
        const status = await evolutionConnectionState(item.instanceName).catch(() => null);
        if (status) {
          state = status.state;
          error = status.error ?? null;
        }
      }
      if (!isCloud && config.configured && state === "open" && !phone) {
        phone = await syncConnectedInstancePhone(item.instanceName, "open");
      }
      return {
        id: item.id,
        instanceName: item.instanceName,
        label: item.label,
        phone,
        provider: item.provider,
        verifiedName: item.verifiedName,
        phoneNumberId: item.phoneNumberId,
        wabaId: item.wabaId,
        wabaRelayOk: isCloud ? (relay?.ok ?? false) : null,
        wabaRelayError: isCloud ? (relay?.error ?? null) : null,
        state,
        qr: flash?.qr ?? {},
        error,
      };
    }),
  );

  const evo: {
    configured: boolean;
    apiUrlHost: string | null;
    instance: string | null;
    channels: typeof channels;
    state: EvolutionConnectionState;
    qr: EvolutionQrPayload;
    error?: string | null;
    webhookUrl: string | null;
    webhookPublicBaseUrl: string;
    webhookReady: boolean;
    metaCloudConfigured: boolean;
    metaCloud: ReturnType<typeof toPublicMetaEsConfig>;
  } = {
    configured: config.configured,
    apiUrlHost: config.apiUrlHost,
    instance: config.instance,
    channels,
    state: channels[0]?.state ?? "unknown",
    qr: channels[0]?.qr ?? {},
    error:
      channels.find((c) => c.error)?.error ??
      (config.configured || isMetaCloudConfigured()
        ? null
        : "Evolution API não configurada no servidor (.env.local)."),
    webhookUrl,
    webhookPublicBaseUrl: aiSettings.webhookPublicBaseUrl,
    webhookReady: Boolean(webhookUrl),
    metaCloudConfigured: isMetaCloudConfigured(),
    metaCloud: toPublicMetaEsConfig(),
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
      botGlobalEnabled?: boolean;
      openaiModel?: string;
      systemPrompt?: string;
    };
    return {
      aiGlobalEnabled: body.aiGlobalEnabled,
      botGlobalEnabled: body.botGlobalEnabled,
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
    if (typeof data.botGlobalEnabled === "boolean") {
      await setBotEnabledForAllConversations(data.botGlobalEnabled);
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

/** Quando conectado, busca o número na Evolution e grava no registro do canal. */
async function syncConnectedInstancePhone(
  instanceName: string,
  state: EvolutionConnectionState,
): Promise<string | null> {
  if (state !== "open") return null;
  try {
    const fetched = await evolutionFetchInstancePhone(instanceName);
    if (fetched.phone) {
      await updateWhatsappInstancePhone(instanceName, fetched.phone);
      return fetched.phone;
    }
  } catch {
    /* mantém o que já estiver no banco */
  }
  const existing = await getWhatsappInstanceByName(instanceName);
  return existing?.phone ?? null;
}

export const getEvolutionConnectionStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data ?? {}) as { instanceName?: string };
    return {
      instanceName:
        String(body.instanceName ?? "").trim() || getDefaultSomaEvolutionInstance(),
    };
  })
  .handler(async ({ data }) => {
    const user = await requireChatBotSettingsUser();
    if (isMetaCloudInstanceName(data.instanceName)) {
      const registered = await getWhatsappInstanceByName(data.instanceName);
      return {
        config: getEvolutionPublicConfig(),
        instanceName: data.instanceName,
        state: registered?.accessTokenEncrypted ? ("open" as const) : ("close" as const),
        phone: registered?.phone ?? null,
        ok: true,
        error: undefined as string | undefined,
      };
    }
    const config = getEvolutionPublicConfig();
    if (!config.configured) {
      return {
        config,
        instanceName: data.instanceName,
        state: "unknown" as const,
        phone: null as string | null,
        ok: false,
        error: "Evolution API não configurada no servidor (.env.local).",
      };
    }
    const settings = await getChatAiSettings();
    await ensureSomaEvolutionInstance({
      webhookPublicBaseUrl: settings.webhookPublicBaseUrl,
      instanceName: data.instanceName,
    });
    const status = await evolutionConnectionState(data.instanceName);
    const phone = await syncConnectedInstancePhone(data.instanceName, status.state);
    putEvolutionQrFlash(
      user.userId,
      {
        state: status.state,
        qr:
          status.state === "open"
            ? {}
            : (takeEvolutionQrFlash(user.userId, data.instanceName)?.qr ?? {}),
        error: status.error,
      },
      data.instanceName,
    );
    return {
      config,
      instanceName: data.instanceName,
      state: status.state,
      phone,
      ok: status.ok,
      error: status.error,
    };
  });

export const refreshEvolutionQrFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data ?? {}) as { instanceName?: string };
    return {
      instanceName:
        String(body.instanceName ?? "").trim() || getDefaultSomaEvolutionInstance(),
    };
  })
  .handler(async ({ data }) => {
    const user = await requireChatBotSettingsUser();
    if (isMetaCloudInstanceName(data.instanceName)) {
      return {
        config: getEvolutionPublicConfig(),
        instanceName: data.instanceName,
        state: "open" as const,
        qr: {},
        ok: false,
        error: "Este canal usa a API oficial da Meta — não há QR Code.",
      };
    }
    const config = getEvolutionPublicConfig();
    if (!config.configured) {
      clearEvolutionQrFlash(user.userId, data.instanceName);
      return {
        config,
        instanceName: data.instanceName,
        state: "unknown" as const,
        qr: {},
        ok: false,
        error: "Evolution API não configurada no servidor (.env.local).",
      };
    }
    const settings = await getChatAiSettings();
    const ensured = await ensureSomaEvolutionInstance({
      webhookPublicBaseUrl: settings.webhookPublicBaseUrl,
      instanceName: data.instanceName,
    });
    if (!ensured.ok) {
      putEvolutionQrFlash(
        user.userId,
        {
          state: "unknown",
          qr: {},
          error: ensured.error,
        },
        data.instanceName,
      );
      return {
        config,
        instanceName: data.instanceName,
        state: "unknown" as const,
        qr: {},
        ok: false,
        error: ensured.error,
      };
    }
    const connected = await evolutionConnectionState(data.instanceName);
    if (connected.ok && connected.state === "open") {
      const phone = await syncConnectedInstancePhone(data.instanceName, "open");
      clearEvolutionQrFlash(user.userId, data.instanceName);
      return {
        config,
        instanceName: data.instanceName,
        state: "open" as const,
        qr: {},
        phone,
        ok: true,
        error: undefined,
        connected: true,
      };
    }

    // Já em pareamento: NÃO regenerar QR (invalidaria o código que o WhatsApp acabou de ler).
    if (connected.ok && connected.state === "connecting") {
      const flash = takeEvolutionQrFlash(user.userId, data.instanceName);
      if (flash?.qr?.base64 || flash?.qr?.code || flash?.qr?.pairingCode) {
        putEvolutionQrFlash(
          user.userId,
          {
            state: "connecting",
            qr: flash.qr,
            error: flash.error,
          },
          data.instanceName,
        );
        return {
          config,
          instanceName: data.instanceName,
          state: "connecting" as const,
          qr: flash.qr,
          phone: null,
          ok: true,
          error: undefined,
          connected: false,
        };
      }
    }

    const registered = await getWhatsappInstanceByName(data.instanceName);
    const phoneForPair =
      registered?.phone ||
      (await evolutionFetchInstancePhone(data.instanceName).catch(() => ({ phone: null }))).phone ||
      null;
    const connect = await evolutionConnectQr(data.instanceName, phoneForPair);
    const phone =
      connect.state === "open"
        ? await syncConnectedInstancePhone(data.instanceName, "open")
        : null;
    putEvolutionQrFlash(
      user.userId,
      {
        state: connect.state,
        qr: connect.qr ?? {},
        error: connect.error,
      },
      data.instanceName,
    );
    return {
      config,
      instanceName: data.instanceName,
      state: connect.state,
      qr: connect.qr,
      phone,
      ok: connect.ok,
      error: connect.error,
      connected: false,
    };
  });

export const createChatWhatsappInstanceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data ?? {}) as { label?: string };
    const label = String(body.label ?? "").trim();
    if (!label) throw new Error("Informe um nome para o canal.");
    return { label };
  })
  .handler(async ({ data }) => {
    await requireChatBotSettingsUser();
    if (!isEvolutionConfigured()) {
      throw new Error("Evolution API não configurada no servidor (.env.local).");
    }
    const created = await createWhatsappInstance({ label: data.label });
    const settings = await getChatAiSettings();
    await ensureSomaEvolutionInstance({
      webhookPublicBaseUrl: settings.webhookPublicBaseUrl,
      instanceName: created.instanceName,
    });
    return { ok: true, instance: created };
  });

export const deleteChatWhatsappInstanceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data ?? {}) as { instanceName?: string };
    const instanceName = String(body.instanceName ?? "").trim();
    if (!instanceName) throw new Error("Instância obrigatória.");
    return { instanceName };
  })
  .handler(async ({ data }) => {
    const user = await requireChatBotSettingsUser();
    const all = await listWhatsappInstances();
    const existing = all.find((item) => item.instanceName === data.instanceName);
    if (!existing) {
      clearEvolutionQrFlash(user.userId, data.instanceName);
      return { ok: true };
    }
    if (isEvolutionConfigured() && !isMetaCloudInstanceName(data.instanceName)) {
      const removed = await evolutionDeleteInstance(data.instanceName);
      const alreadyGone = /404|does not exist|not found|não exist/i.test(removed.error || "");
      if (!removed.ok && !alreadyGone) {
        throw new Error(removed.error ?? "Falha ao excluir instância na Evolution.");
      }
    }
    if (existing.phoneNumberId) {
      await unregisterSomaCloudNumberOnWaba(existing.phoneNumberId);
    }
    await deleteWhatsappInstance(data.instanceName);
    clearEvolutionQrFlash(user.userId, data.instanceName);
    return { ok: true };
  });

export const applyWebhookToAllWhatsappInstancesFn = createServerFn({ method: "POST" }).handler(
  async () => {
    await requireChatBotSettingsUser();
    if (!isEvolutionConfigured()) {
      throw new Error("Evolution API não configurada.");
    }
    const settings = await getChatAiSettings();
    const instances = await listWhatsappInstances();
    const results: Array<{ instanceName: string; ok: boolean; error?: string }> = [];
    for (const item of instances) {
      if (instanceIsMetaCloud(item)) {
        results.push({ instanceName: item.instanceName, ok: true });
        continue;
      }
      const applied = await evolutionSetInstanceWebhook(
        null,
        settings.webhookPublicBaseUrl,
        item.instanceName,
      );
      results.push({
        instanceName: item.instanceName,
        ok: applied.ok,
        error: applied.error,
      });
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length === results.length) {
      throw new Error(failed[0]?.error ?? "Falha ao aplicar webhook.");
    }
    return { ok: true, results };
  },
);

export const getMetaEmbeddedSignupConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireChatBotSettingsUser();
  return toPublicMetaEsConfig();
});

export const completeMetaEmbeddedSignupFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data ?? {}) as {
      code?: string;
      wabaId?: string;
      phoneNumberId?: string;
      businessId?: string;
      verifiedName?: string;
      label?: string;
    };
    const code = String(body.code ?? "").trim();
    if (!code) throw new Error("Código da Meta ausente.");
    return {
      code,
      wabaId: String(body.wabaId ?? "").trim(),
      phoneNumberId: String(body.phoneNumberId ?? "").trim(),
      businessId: String(body.businessId ?? "").trim(),
      verifiedName: String(body.verifiedName ?? "").trim(),
      label: String(body.label ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    await requireChatBotSettingsUser();
    return completeMetaEmbeddedSignup(data);
  });
