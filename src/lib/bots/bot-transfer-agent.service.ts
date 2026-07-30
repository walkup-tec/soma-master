import { isAgentOnline, listOnlineAgentIds } from "@/lib/chat/agent-presence.repository";
import {
  appendMessage,
  disableConversationAutomation,
  getConversation,
  joinConversationAsAgent,
} from "@/lib/chat/chat.repository";
import { takeRoundRobinIndex } from "@/lib/bots/bot-transfer-rr.repository";
import type { BotNodeConfig, BotTransferMode } from "@/lib/bots/bot.types";
import { loadSystemSettingsFromDisk } from "@/lib/config/settings.repository";
import { findUserById, listAllUsers } from "@/lib/users/user.repository";
import type { PublicUser } from "@/lib/users/user.types";

export type BotTransferAttendant = {
  id: string;
  name: string;
  email: string;
};

export function resolveBotTransferMode(config: BotNodeConfig): BotTransferMode {
  const raw = String(config.transferMode || "").trim();
  if (raw === "random" || raw === "round_robin" || raw === "specific") return raw;
  // Legado: só attendantUserId → específico
  if (String(config.attendantUserId || "").trim()) return "specific";
  return "random";
}

/** Usuários com acesso ao menu Chat (candidatos a atendimento). */
export async function listChatAttendants(): Promise<BotTransferAttendant[]> {
  const [users, settings] = await Promise.all([listAllUsers(), loadSystemSettingsFromDisk()]);
  const chatCategoryIds = new Set(
    settings.categories.filter((category) => category.menuIds.includes("chat")).map((c) => c.id),
  );
  return users
    .filter((candidate) => candidate.role === "master" || chatCategoryIds.has(candidate.categoryId))
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

async function resolveTarget(input: {
  mode: BotTransferMode;
  attendantUserId?: string;
}): Promise<{ user: PublicUser | BotTransferAttendant; reason: string } | { error: string }> {
  const attendants = await listChatAttendants();
  if (attendants.length === 0) {
    return { error: "Nenhum atendente com acesso ao Chat cadastrado." };
  }

  if (input.mode === "specific") {
    const id = String(input.attendantUserId || "").trim();
    if (!id) return { error: "Selecione o atendente específico." };
    const found = attendants.find((item) => item.id === id);
    if (!found) {
      const user = await findUserById(id);
      if (!user) return { error: "Atendente selecionado não encontrado." };
      return {
        user: { id: user.id, name: user.name, email: user.email },
        reason: "atendente específico",
      };
    }
    const online = await isAgentOnline(found.id);
    return {
      user: found,
      reason: online
        ? "atendente específico (online)"
        : "atendente específico (offline — fica na fila até ficar online)",
    };
  }

  if (input.mode === "round_robin") {
    const index = await takeRoundRobinIndex(attendants.length);
    const picked = attendants[index];
    if (!picked) return { error: "Falha na distribuição 1 para 1." };
    return {
      user: picked,
      reason: `distribuição 1 para 1 (posição ${index + 1}/${attendants.length})`,
    };
  }

  // random — só quem está logado/online
  const onlineIds = new Set(await listOnlineAgentIds());
  const onlinePool = attendants.filter((item) => onlineIds.has(item.id));
  const picked = pickRandom(onlinePool);
  if (!picked) {
    return {
      error: "__NO_ONLINE__",
    };
  }
  return { user: picked, reason: "distribuição aleatória entre online" };
}

/**
 * Atribui a conversa ao atendente conforme o modo do nó Transferir Atendente.
 * Desliga a IA local e registra mensagem de sistema.
 */
export async function applyBotTransferAgent(input: {
  conversationId: string;
  config: BotNodeConfig;
  dryRun?: boolean;
}): Promise<{
  ok: boolean;
  message: string;
  attendantUserId: string | null;
  attendantUserName: string | null;
  transferMode: BotTransferMode;
  online: boolean | null;
}> {
  const mode = resolveBotTransferMode(input.config);

  if (input.dryRun) {
    return {
      ok: true,
      message: `Transferir Atendente simulado (${mode})`,
      attendantUserId: input.config.attendantUserId || null,
      attendantUserName: null,
      transferMode: mode,
      online: null,
    };
  }

  if (!input.conversationId) {
    return {
      ok: false,
      message: "Conversa obrigatória para transferir.",
      attendantUserId: null,
      attendantUserName: null,
      transferMode: mode,
      online: null,
    };
  }

  const resolved = await resolveTarget({
    mode,
    attendantUserId: input.config.attendantUserId,
  });

  if ("error" in resolved) {
    if (resolved.error === "__NO_ONLINE__") {
      await disableConversationAutomation(input.conversationId);
      await appendMessage({
        conversationId: input.conversationId,
        direction: "outbound",
        body: "Bot tentou transferir (aleatório), mas nenhum atendente está online. Conversa em Não atribuídos.",
        senderType: "system",
        senderName: "Sistema",
      });
      return {
        ok: true,
        message: "Nenhum atendente online — conversa permanece em Não atribuídos.",
        attendantUserId: null,
        attendantUserName: null,
        transferMode: mode,
        online: false,
      };
    }
    return {
      ok: false,
      message: resolved.error,
      attendantUserId: null,
      attendantUserName: null,
      transferMode: mode,
      online: null,
    };
  }

  const target = resolved.user;
  const name = target.name || target.email || "Atendente";
  const online = await isAgentOnline(target.id);

  const before = await getConversation(input.conversationId);
  if (!before) {
    return {
      ok: false,
      message: "Conversa não encontrada.",
      attendantUserId: null,
      attendantUserName: null,
      transferMode: mode,
      online,
    };
  }

  if (before.assignedUserId !== target.id) {
    await joinConversationAsAgent({
      conversationId: input.conversationId,
      userId: target.id,
      userName: name,
      systemMessage: `Bot transferiu o atendimento para ${name} (${resolved.reason}).`,
    });
  }

  await disableConversationAutomation(input.conversationId);

  return {
    ok: true,
    message: `Transferido para ${name} — ${resolved.reason}`,
    attendantUserId: target.id,
    attendantUserName: name,
    transferMode: mode,
    online,
  };
}
