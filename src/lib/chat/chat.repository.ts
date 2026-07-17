import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_CHAT_AI_SETTINGS,
  type ChatAiExample,
  type ChatAiKnowledgeItem,
  type ChatAiSettings,
  type ChatConversation,
  type ChatMessage,
  type ChatSenderType,
} from "@/lib/chat/chat.types";
import { ensureChatSchema } from "@/lib/chat/ensure-chat-schema";
import { normalizeWhatsAppPhone, phonesMatch } from "@/lib/chat/phone";
import { resolveAttendanceStatusColor, resolveAttendanceStatusLabel } from "@/lib/clients/client-status";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";
import { loadSystemSettingsFromDisk } from "@/lib/config/settings.repository";

const DATA_DIR = join(process.cwd(), "data");
const CONV_FILE = join(DATA_DIR, "chat-conversations.json");
const MSG_FILE = join(DATA_DIR, "chat-messages.json");
const AI_SETTINGS_FILE = join(DATA_DIR, "chat-ai-settings.json");
const AI_KNOWLEDGE_FILE = join(DATA_DIR, "chat-ai-knowledge.json");
const AI_EXAMPLES_FILE = join(DATA_DIR, "chat-ai-examples.json");

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

async function withChatDb<T>(fn: (sql: Awaited<ReturnType<typeof getSql>>) => Promise<T>): Promise<T> {
  const sql = await getSql();
  await ensureChatSchema(sql);
  return fn(sql);
}

type ConvRow = {
  id: string;
  phone: string;
  contact_name: string | null;
  client_id: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  ai_enabled: boolean;
  last_message_at: Date | null;
  last_message_preview: string | null;
  unread_count: number;
  created_at: Date;
  updated_at: Date;
  client_name?: string | null;
  client_status?: string | null;
};

function mapConv(row: ConvRow): ChatConversation {
  return {
    id: row.id,
    phone: row.phone,
    contactName: row.contact_name,
    clientId: row.client_id,
    assignedUserId: row.assigned_user_id,
    assignedUserName: row.assigned_user_name,
    aiEnabled: row.ai_enabled,
    lastMessageAt: row.last_message_at ? row.last_message_at.toISOString() : null,
    lastMessagePreview: row.last_message_preview,
    unreadCount: row.unread_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    clientName: row.client_name ?? null,
    clientStatusId: row.client_status ?? null,
  };
}

async function enrichConversations(items: ChatConversation[]): Promise<ChatConversation[]> {
  const settings = await loadSystemSettingsFromDisk();
  return items.map((item) => {
    const statusId = item.clientStatusId;
    if (!statusId) return item;
    return {
      ...item,
      clientStatusLabel: resolveAttendanceStatusLabel(statusId, settings),
      clientStatusColor: resolveAttendanceStatusColor(statusId, settings),
    };
  });
}

export async function listConversations(limit = 80): Promise<ChatConversation[]> {
  if (isDatabaseEnabled()) {
    const rows = await withChatDb((sql) => sql<ConvRow[]>`
      select
        c.id, c.phone, c.contact_name, c.client_id, c.assigned_user_id, c.assigned_user_name,
        c.ai_enabled, c.last_message_at, c.last_message_preview, c.unread_count,
        c.created_at, c.updated_at,
        cl.data->>'nome' as client_name,
        cl.status as client_status
      from crm.chat_conversations c
      left join crm.clients cl on cl.id = c.client_id
      order by c.last_message_at desc nulls last, c.updated_at desc
      limit ${limit}
    `);
    return enrichConversations(rows.map(mapConv));
  }

  const items = await readJsonFile<ChatConversation[]>(CONV_FILE, []);
  return enrichConversations(
    [...items].sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt)).slice(0, limit),
  );
}

export async function getConversation(id: string): Promise<ChatConversation | null> {
  const all = await listConversations(500);
  return all.find((c) => c.id === id) ?? null;
}

async function findClientIdByPhone(phone: string): Promise<{ clientId: string; name: string | null } | null> {
  if (!isDatabaseEnabled()) return null;
  const normalized = normalizeWhatsAppPhone(phone);
  const sql = await getSql();
  const rows = await sql<{ id: string; data: Record<string, unknown> }[]>`
    select id, data from crm.clients
    order by created_at desc
    limit 5000
  `;
  for (const row of rows) {
    const data = row.data ?? {};
    const candidates = [data.whatsapp, data.telefone, data.celular, data.fone].filter(Boolean).map(String);
    if (candidates.some((c) => phonesMatch(c, normalized))) {
      return { clientId: row.id, name: typeof data.nome === "string" ? data.nome : null };
    }
  }
  return null;
}

export async function getOrCreateConversationByPhone(input: {
  phone: string;
  contactName?: string | null;
}): Promise<ChatConversation> {
  const phone = normalizeWhatsAppPhone(input.phone);
  if (!phone) throw new Error("Telefone inválido.");

  if (isDatabaseEnabled()) {
    return withChatDb(async (sql) => {
      const existing = await sql<ConvRow[]>`
        select id, phone, contact_name, client_id, assigned_user_id, assigned_user_name,
               ai_enabled, last_message_at, last_message_preview, unread_count, created_at, updated_at
        from crm.chat_conversations where phone = ${phone} limit 1
      `;
      if (existing[0]) {
        if (input.contactName && !existing[0].contact_name) {
          await sql`
            update crm.chat_conversations
            set contact_name = ${input.contactName}, updated_at = now()
            where id = ${existing[0].id}
          `;
        }
        return mapConv(existing[0]);
      }

      const linked = await findClientIdByPhone(phone);
      const aiSettings = await sql<{ ai_global_enabled: boolean }[]>`
        select ai_global_enabled
        from crm.chat_ai_settings
        where id = 'default'
        limit 1
      `;
      const initialAiEnabled =
        aiSettings[0]?.ai_global_enabled ?? DEFAULT_CHAT_AI_SETTINGS.aiGlobalEnabled;
      const id = `chat-${crypto.randomUUID().slice(0, 10)}`;
      const now = new Date();
      await sql`
        insert into crm.chat_conversations (
          id, phone, contact_name, client_id, ai_enabled, created_at, updated_at
        ) values (
          ${id},
          ${phone},
          ${input.contactName ?? linked?.name ?? null},
          ${linked?.clientId ?? null},
          ${initialAiEnabled},
          ${now},
          ${now}
        )
      `;
      return {
        id,
        phone,
        contactName: input.contactName ?? linked?.name ?? null,
        clientId: linked?.clientId ?? null,
        assignedUserId: null,
        assignedUserName: null,
        aiEnabled: initialAiEnabled,
        lastMessageAt: null,
        lastMessagePreview: null,
        unreadCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    });
  }

  const items = await readJsonFile<ChatConversation[]>(CONV_FILE, []);
  const found = items.find((c) => c.phone === phone);
  if (found) return found;
  const initialAiEnabled = (await getChatAiSettings()).aiGlobalEnabled;
  const now = new Date().toISOString();
  const created: ChatConversation = {
    id: `chat-${crypto.randomUUID().slice(0, 10)}`,
    phone,
    contactName: input.contactName ?? null,
    clientId: null,
    assignedUserId: null,
    assignedUserName: null,
    aiEnabled: initialAiEnabled,
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  items.push(created);
  await writeJsonFile(CONV_FILE, items);
  return created;
}

export async function listMessages(conversationId: string, limit = 200): Promise<ChatMessage[]> {
  if (isDatabaseEnabled()) {
    const rows = await withChatDb((sql) => sql<{
      id: string;
      conversation_id: string;
      direction: string;
      body: string;
      message_type: string;
      media_id: string | null;
      media_mime_type: string | null;
      media_file_name: string | null;
      sender_type: string;
      sender_user_id: string | null;
      sender_name: string | null;
      wa_message_id: string | null;
      created_at: Date;
    }[]>`
      select * from crm.chat_messages
      where conversation_id = ${conversationId}
      order by created_at asc
      limit ${limit}
    `);
    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      direction: row.direction as ChatMessage["direction"],
      body: row.body,
      messageType: row.message_type === "image" ? "image" : "text",
      mediaId: row.media_id,
      mediaMimeType: row.media_mime_type,
      mediaFileName: row.media_file_name,
      senderType: row.sender_type as ChatSenderType,
      senderUserId: row.sender_user_id,
      senderName: row.sender_name,
      waMessageId: row.wa_message_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  const all = await readJsonFile<ChatMessage[]>(MSG_FILE, []);
  return all
    .filter((m) => m.conversationId === conversationId)
    .map((message) => ({
      ...message,
      messageType: message.messageType ?? "text",
      mediaId: message.mediaId ?? null,
      mediaMimeType: message.mediaMimeType ?? null,
      mediaFileName: message.mediaFileName ?? null,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-limit);
}

export async function appendMessage(input: {
  conversationId: string;
  direction: ChatMessage["direction"];
  body: string;
  messageType?: ChatMessage["messageType"];
  mediaId?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  senderType: ChatSenderType;
  senderUserId?: string | null;
  senderName?: string | null;
  waMessageId?: string | null;
  bumpUnread?: boolean;
}): Promise<ChatMessage> {
  const body = input.body.trim();
  const messageType = input.messageType ?? "text";
  if (!body && messageType !== "image") throw new Error("Mensagem vazia.");
  if (messageType === "image" && !input.mediaId) throw new Error("Imagem ausente.");
  const preview = messageType === "image" ? `📷 ${body || "Imagem"}` : body;

  const message: ChatMessage = {
    id: `msg-${crypto.randomUUID().slice(0, 10)}`,
    conversationId: input.conversationId,
    direction: input.direction,
    body,
    messageType,
    mediaId: input.mediaId ?? null,
    mediaMimeType: input.mediaMimeType ?? null,
    mediaFileName: input.mediaFileName ?? null,
    senderType: input.senderType,
    senderUserId: input.senderUserId ?? null,
    senderName: input.senderName ?? null,
    waMessageId: input.waMessageId ?? null,
    createdAt: new Date().toISOString(),
  };

  if (isDatabaseEnabled()) {
    await withChatDb(async (sql) => {
      if (input.waMessageId) {
        const dup = await sql`select id from crm.chat_messages where wa_message_id = ${input.waMessageId} limit 1`;
        if (dup.length) return;
      }
      await sql`
        insert into crm.chat_messages (
          id, conversation_id, direction, body, message_type, media_id, media_mime_type,
          media_file_name, sender_type, sender_user_id, sender_name, wa_message_id, created_at
        ) values (
          ${message.id}, ${message.conversationId}, ${message.direction}, ${message.body},
          ${message.messageType}, ${message.mediaId}, ${message.mediaMimeType}, ${message.mediaFileName},
          ${message.senderType}, ${message.senderUserId}, ${message.senderName}, ${message.waMessageId},
          ${new Date(message.createdAt)}
        )
      `;
      await sql`
        update crm.chat_conversations
        set
          last_message_at = ${new Date(message.createdAt)},
          last_message_preview = ${preview.slice(0, 180)},
          unread_count = case when ${Boolean(input.bumpUnread)} then unread_count + 1 else unread_count end,
          updated_at = now()
        where id = ${input.conversationId}
      `;
    });
    return message;
  }

  const msgs = await readJsonFile<ChatMessage[]>(MSG_FILE, []);
  if (input.waMessageId && msgs.some((m) => m.waMessageId === input.waMessageId)) {
    return msgs.find((m) => m.waMessageId === input.waMessageId)!;
  }
  msgs.push(message);
  await writeJsonFile(MSG_FILE, msgs);
  const convs = await readJsonFile<ChatConversation[]>(CONV_FILE, []);
  const idx = convs.findIndex((c) => c.id === input.conversationId);
  if (idx >= 0) {
    convs[idx] = {
      ...convs[idx],
      lastMessageAt: message.createdAt,
      lastMessagePreview: preview.slice(0, 180),
      unreadCount: input.bumpUnread ? convs[idx].unreadCount + 1 : convs[idx].unreadCount,
      updatedAt: message.createdAt,
    };
    await writeJsonFile(CONV_FILE, convs);
  }
  return message;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  if (isDatabaseEnabled()) {
    await withChatDb(
      (sql) => sql`update crm.chat_conversations set unread_count = 0, updated_at = now() where id = ${conversationId}`,
    );
    return;
  }
  const convs = await readJsonFile<ChatConversation[]>(CONV_FILE, []);
  const next = convs.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c));
  await writeJsonFile(CONV_FILE, next);
}

export async function joinConversationAsAgent(input: {
  conversationId: string;
  userId: string;
  userName: string;
}): Promise<ChatConversation> {
  const before = await getConversation(input.conversationId);
  if (!before) throw new Error("Conversa não encontrada.");

  const alreadyAgent = before.assignedUserId === input.userId;

  // Abrir a conversa apenas atribui o atendente; não altera a IA.
  if (alreadyAgent) {
    return before;
  }

  if (isDatabaseEnabled()) {
    await withChatDb(
      (sql) => sql`
        update crm.chat_conversations
        set
          assigned_user_id = ${input.userId},
          assigned_user_name = ${input.userName},
          updated_at = now()
        where id = ${input.conversationId}
      `,
    );
  } else {
    const convs = await readJsonFile<ChatConversation[]>(CONV_FILE, []);
    const next = convs.map((c) =>
      c.id === input.conversationId
        ? {
            ...c,
            assignedUserId: input.userId,
            assignedUserName: input.userName,
            updatedAt: new Date().toISOString(),
          }
        : c,
    );
    await writeJsonFile(CONV_FILE, next);
  }

  await appendMessage({
    conversationId: input.conversationId,
    direction: "outbound",
    body: `${input.userName} entrou no atendimento.`,
    senderType: "system",
    senderName: "Sistema",
  });

  const conv = await getConversation(input.conversationId);
  if (!conv) throw new Error("Conversa não encontrada.");
  return conv;
}

export async function setConversationAiEnabled(input: {
  conversationId: string;
  aiEnabled: boolean;
}): Promise<void> {
  if (isDatabaseEnabled()) {
    await withChatDb(
      (sql) => sql`
        update crm.chat_conversations
        set ai_enabled = ${input.aiEnabled}, updated_at = now()
        where id = ${input.conversationId}
      `,
    );
    return;
  }
  const convs = await readJsonFile<ChatConversation[]>(CONV_FILE, []);
  await writeJsonFile(
    CONV_FILE,
    convs.map((c) =>
      c.id === input.conversationId
        ? { ...c, aiEnabled: input.aiEnabled, updatedAt: new Date().toISOString() }
        : c,
    ),
  );
}

/** Aplica o comando geral de IA a todas as conversas. */
export async function setAiEnabledForAllConversations(aiEnabled: boolean): Promise<void> {
  if (isDatabaseEnabled()) {
    await withChatDb(
      (sql) => sql`
        update crm.chat_conversations
        set ai_enabled = ${aiEnabled}, updated_at = now()
        where ai_enabled is distinct from ${aiEnabled}
      `,
    );
    return;
  }
  const convs = await readJsonFile<ChatConversation[]>(CONV_FILE, []);
  await writeJsonFile(
    CONV_FILE,
    convs.map((c) =>
      c.aiEnabled !== aiEnabled
        ? { ...c, aiEnabled, updatedAt: new Date().toISOString() }
        : c,
    ),
  );
}

export async function getChatAiSettings(): Promise<ChatAiSettings> {
  if (isDatabaseEnabled()) {
    return withChatDb(async (sql) => {
      const rows = await sql<{
        ai_global_enabled: boolean;
        openai_model: string;
        system_prompt: string;
        webhook_public_base_url: string | null;
        updated_at: Date;
      }[]>`
        select ai_global_enabled, openai_model, system_prompt, webhook_public_base_url, updated_at
        from crm.chat_ai_settings where id = 'default' limit 1
      `;
      if (!rows[0]) {
        await sql`
          insert into crm.chat_ai_settings (id, ai_global_enabled, openai_model, system_prompt, updated_at)
          values (
            'default',
            ${DEFAULT_CHAT_AI_SETTINGS.aiGlobalEnabled},
            ${DEFAULT_CHAT_AI_SETTINGS.openaiModel},
            ${DEFAULT_CHAT_AI_SETTINGS.systemPrompt},
            now()
          )
          on conflict (id) do nothing
        `;
        return { ...DEFAULT_CHAT_AI_SETTINGS, updatedAt: new Date().toISOString() };
      }
      return {
        aiGlobalEnabled: rows[0].ai_global_enabled,
        openaiModel: rows[0].openai_model,
        systemPrompt: rows[0].system_prompt,
        webhookPublicBaseUrl: rows[0].webhook_public_base_url?.trim() ?? "",
        updatedAt: rows[0].updated_at.toISOString(),
      };
    });
  }
  const fromFile = await readJsonFile(AI_SETTINGS_FILE, DEFAULT_CHAT_AI_SETTINGS);
  return {
    ...DEFAULT_CHAT_AI_SETTINGS,
    ...fromFile,
    webhookPublicBaseUrl: fromFile.webhookPublicBaseUrl?.trim() ?? "",
  };
}

export async function saveChatAiSettings(input: Partial<ChatAiSettings>): Promise<ChatAiSettings> {
  const current = await getChatAiSettings();
  const next: ChatAiSettings = {
    aiGlobalEnabled: input.aiGlobalEnabled ?? current.aiGlobalEnabled,
    openaiModel: (input.openaiModel ?? current.openaiModel).trim() || "gpt-4o-mini",
    systemPrompt: (input.systemPrompt ?? current.systemPrompt).trim() || DEFAULT_CHAT_AI_SETTINGS.systemPrompt,
    webhookPublicBaseUrl:
      input.webhookPublicBaseUrl !== undefined
        ? input.webhookPublicBaseUrl.trim().replace(/\/+$/, "")
        : current.webhookPublicBaseUrl,
    updatedAt: new Date().toISOString(),
  };

  if (isDatabaseEnabled()) {
    await withChatDb(
      (sql) => sql`
        insert into crm.chat_ai_settings (
          id, ai_global_enabled, openai_model, system_prompt, webhook_public_base_url, updated_at
        )
        values (
          'default',
          ${next.aiGlobalEnabled},
          ${next.openaiModel},
          ${next.systemPrompt},
          ${next.webhookPublicBaseUrl || null},
          now()
        )
        on conflict (id) do update set
          ai_global_enabled = excluded.ai_global_enabled,
          openai_model = excluded.openai_model,
          system_prompt = excluded.system_prompt,
          webhook_public_base_url = excluded.webhook_public_base_url,
          updated_at = now()
      `,
    );
    return next;
  }

  await writeJsonFile(AI_SETTINGS_FILE, next);
  return next;
}

export async function listAiKnowledge(): Promise<ChatAiKnowledgeItem[]> {
  if (isDatabaseEnabled()) {
    const rows = await withChatDb((sql) => sql<{
      id: string;
      title: string;
      content: string;
      enabled: boolean;
      sort_order: number;
      updated_at: Date;
    }[]>`
      select * from crm.chat_ai_knowledge order by sort_order asc, updated_at desc
    `);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      enabled: r.enabled,
      sortOrder: r.sort_order,
      updatedAt: r.updated_at.toISOString(),
    }));
  }
  return readJsonFile(AI_KNOWLEDGE_FILE, []);
}

export async function upsertAiKnowledge(item: Omit<ChatAiKnowledgeItem, "updatedAt"> & { updatedAt?: string }): Promise<ChatAiKnowledgeItem> {
  const record: ChatAiKnowledgeItem = {
    ...item,
    title: item.title.trim(),
    content: item.content.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (!record.title || !record.content) throw new Error("Título e conteúdo são obrigatórios.");

  if (isDatabaseEnabled()) {
    await withChatDb(
      (sql) => sql`
        insert into crm.chat_ai_knowledge (id, title, content, enabled, sort_order, updated_at)
        values (${record.id}, ${record.title}, ${record.content}, ${record.enabled}, ${record.sortOrder}, now())
        on conflict (id) do update set
          title = excluded.title,
          content = excluded.content,
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          updated_at = now()
      `,
    );
    return record;
  }

  const all = await readJsonFile<ChatAiKnowledgeItem[]>(AI_KNOWLEDGE_FILE, []);
  const idx = all.findIndex((x) => x.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  await writeJsonFile(AI_KNOWLEDGE_FILE, all);
  return record;
}

export async function deleteAiKnowledge(id: string): Promise<void> {
  if (isDatabaseEnabled()) {
    await withChatDb((sql) => sql`delete from crm.chat_ai_knowledge where id = ${id}`);
    return;
  }
  const all = await readJsonFile<ChatAiKnowledgeItem[]>(AI_KNOWLEDGE_FILE, []);
  await writeJsonFile(
    AI_KNOWLEDGE_FILE,
    all.filter((x) => x.id !== id),
  );
}

export async function listAiExamples(): Promise<ChatAiExample[]> {
  if (isDatabaseEnabled()) {
    const rows = await withChatDb((sql) => sql<{
      id: string;
      user_says: string;
      assistant_replies: string;
      enabled: boolean;
      sort_order: number;
      updated_at: Date;
    }[]>`
      select * from crm.chat_ai_examples order by sort_order asc, updated_at desc
    `);
    return rows.map((r) => ({
      id: r.id,
      userSays: r.user_says,
      assistantReplies: r.assistant_replies,
      enabled: r.enabled,
      sortOrder: r.sort_order,
      updatedAt: r.updated_at.toISOString(),
    }));
  }
  return readJsonFile(AI_EXAMPLES_FILE, []);
}

export async function upsertAiExample(item: Omit<ChatAiExample, "updatedAt">): Promise<ChatAiExample> {
  const record: ChatAiExample = {
    ...item,
    userSays: item.userSays.trim(),
    assistantReplies: item.assistantReplies.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (!record.userSays || !record.assistantReplies) throw new Error("Pergunta e resposta são obrigatórias.");

  if (isDatabaseEnabled()) {
    await withChatDb(
      (sql) => sql`
        insert into crm.chat_ai_examples (id, user_says, assistant_replies, enabled, sort_order, updated_at)
        values (${record.id}, ${record.userSays}, ${record.assistantReplies}, ${record.enabled}, ${record.sortOrder}, now())
        on conflict (id) do update set
          user_says = excluded.user_says,
          assistant_replies = excluded.assistant_replies,
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          updated_at = now()
      `,
    );
    return record;
  }

  const all = await readJsonFile<ChatAiExample[]>(AI_EXAMPLES_FILE, []);
  const idx = all.findIndex((x) => x.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  await writeJsonFile(AI_EXAMPLES_FILE, all);
  return record;
}

export async function deleteAiExample(id: string): Promise<void> {
  if (isDatabaseEnabled()) {
    await withChatDb((sql) => sql`delete from crm.chat_ai_examples where id = ${id}`);
    return;
  }
  const all = await readJsonFile<ChatAiExample[]>(AI_EXAMPLES_FILE, []);
  await writeJsonFile(
    AI_EXAMPLES_FILE,
    all.filter((x) => x.id !== id),
  );
}

export async function linkConversationClient(conversationId: string, clientId: string | null): Promise<void> {
  if (isDatabaseEnabled()) {
    await withChatDb(
      (sql) => sql`
        update crm.chat_conversations
        set client_id = ${clientId}, updated_at = now()
        where id = ${conversationId}
      `,
    );
    return;
  }
  const convs = await readJsonFile<ChatConversation[]>(CONV_FILE, []);
  await writeJsonFile(
    CONV_FILE,
    convs.map((c) => (c.id === conversationId ? { ...c, clientId, updatedAt: new Date().toISOString() } : c)),
  );
}
