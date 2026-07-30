import type { BotJson } from "@/lib/bots/bot.types";
import {
  findClientIdByPhone,
  getConversation,
  linkConversationClient,
  updateConversationContactName,
} from "@/lib/chat/chat.repository";
import { normalizeWhatsAppPhone } from "@/lib/chat/phone";
import { patchClientDataFields } from "@/lib/clients/clients.repository";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

/**
 * Aplica campos do node Atualizar Lead no contato da conversa e, se houver, no cliente CRM.
 */
export async function applyBotLeadFieldUpdates(input: {
  conversationId: string;
  phone: string;
  fields: Record<string, string>;
}): Promise<{ ok: boolean; message: string; clientId: string | null }> {
  const entries = Object.entries(input.fields)
    .map(([fieldId, value]) => [String(fieldId || "").trim(), String(value || "").trim()] as const)
    .filter(([fieldId, value]) => Boolean(fieldId) && Boolean(value));

  if (entries.length === 0) {
    return { ok: false, message: "Nenhum campo/valor para atualizar", clientId: null };
  }

  const patch = Object.fromEntries(entries) as Record<string, string>;
  const conversation = await getConversation(input.conversationId);
  if (!conversation) {
    return { ok: false, message: "Conversa não encontrada", clientId: null };
  }

  const nome = patch.nome?.trim();
  if (nome) {
    await updateConversationContactName({
      conversationId: input.conversationId,
      contactName: nome,
    });
  }

  let clientId = conversation.clientId;
  if (!clientId) {
    const linked = await findClientIdByPhone(normalizeWhatsAppPhone(input.phone) || input.phone);
    if (linked?.clientId) {
      clientId = linked.clientId;
      await linkConversationClient(input.conversationId, clientId);
    }
  }

  if (clientId) {
    await patchClientDataFields({ clientId, fields: patch });
    const labels = Object.keys(patch).join(", ");
    return {
      ok: true,
      message: `Lead atualizado (${labels})`,
      clientId,
    };
  }

  if (nome) {
    return {
      ok: true,
      message: "Nome do contato atualizado (sem lead CRM vinculado ao telefone)",
      clientId: null,
    };
  }

  return {
    ok: false,
    message: "Sem lead CRM vinculado — não foi possível gravar os campos",
    clientId: null,
  };
}

/** Carrega dados do contato/lead para uso em templates {{nome}}, {{telefone}}, etc. */
export async function loadBotLeadVariables(input: {
  conversationId: string;
  phone: string;
}): Promise<Record<string, BotJson>> {
  const phone = normalizeWhatsAppPhone(input.phone) || input.phone;
  const vars: Record<string, BotJson> = {
    telefone: phone,
    whatsapp: phone,
  };

  const conversation = await getConversation(input.conversationId);
  if (conversation?.contactName) {
    vars.nome = conversation.contactName;
  }

  let clientId = conversation?.clientId || null;
  if (!clientId && phone) {
    const linked = await findClientIdByPhone(phone);
    clientId = linked?.clientId || null;
  }

  if (clientId && isDatabaseEnabled()) {
    try {
      const sql = await getSql();
      const rows = await sql<{ data: Record<string, unknown> | null }[]>`
        select data from crm.clients where id = ${clientId} limit 1
      `;
      const data = rows[0]?.data;
      if (data && typeof data === "object") {
        for (const [key, value] of Object.entries(data)) {
          if (value == null) continue;
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            vars[key] = value;
          }
        }
      }
    } catch {
      /* mantém o que já tiver da conversa */
    }
  }

  if (!vars.nome && conversation?.contactName) {
    vars.nome = conversation.contactName;
  }

  return vars;
}
