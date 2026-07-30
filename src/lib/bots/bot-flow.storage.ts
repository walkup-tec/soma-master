import {
  createDefaultBotDraft,
  ensureBotHasStart,
  normalizeBotDraft,
} from "@/lib/bots/bot-flow.normalize";
import type { BotFlowDraft } from "@/lib/bots/bot.types";

export const BOT_FLOWS_STORAGE_KEY = "soma-bots-flows-v1";

function readStored(): BotFlowDraft[] {
  try {
    const raw = localStorage.getItem(BOT_FLOWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BotFlowDraft[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ensureBotHasStart(normalizeBotDraft(item)));
  } catch {
    return [];
  }
}

function writeStored(items: BotFlowDraft[]) {
  localStorage.setItem(
    BOT_FLOWS_STORAGE_KEY,
    JSON.stringify(items.map((item) => ensureBotHasStart(normalizeBotDraft(item)))),
  );
}

export function listStoredBotFlows(): BotFlowDraft[] {
  return readStored().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getStoredBotFlowById(id: string): BotFlowDraft | null {
  const found = readStored().find((item) => item.id === id);
  return found ? ensureBotHasStart(normalizeBotDraft(found)) : null;
}

export function saveStoredBotFlow(draft: BotFlowDraft): BotFlowDraft {
  const next = ensureBotHasStart(
    normalizeBotDraft({
      ...draft,
      updatedAt: new Date().toISOString(),
    }),
  );
  const others = readStored().filter((item) => item.id !== next.id);
  writeStored([next, ...others]);
  return next;
}

export function deleteStoredBotFlow(id: string): boolean {
  const current = readStored();
  const next = current.filter((item) => item.id !== id);
  if (next.length === current.length) return false;
  writeStored(next);
  return true;
}

/** Une listas por id — preserva o rascunho mais recente (`updatedAt`). */
export function mergeBotFlowLists(
  local: BotFlowDraft[],
  remote: BotFlowDraft[],
): BotFlowDraft[] {
  const map = new Map<string, BotFlowDraft>();
  for (const flow of [...local, ...remote]) {
    const normalized = ensureBotHasStart(normalizeBotDraft(flow));
    const prev = map.get(normalized.id);
    if (!prev || normalized.updatedAt.localeCompare(prev.updatedAt) > 0) {
      map.set(normalized.id, normalized);
    }
  }
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Atualiza o cache local.
 * Proteção: nunca sobrescreve um cache local não-vazio com lista vazia
 * (evita apagar bots do navegador quando o servidor ainda não tem dados).
 */
export function replaceStoredBotFlows(flows: BotFlowDraft[]): BotFlowDraft[] {
  const existing = readStored();
  const incoming = flows.map((item) => ensureBotHasStart(normalizeBotDraft(item)));
  if (incoming.length === 0 && existing.length > 0) {
    return listStoredBotFlows();
  }
  writeStored(incoming);
  return listStoredBotFlows();
}

/**
 * Hidrata local ↔ servidor sem perda:
 * 1) merge por id
 * 2) envia ao servidor o que o local tem a mais / mais novo
 * 3) grava o resultado no localStorage
 */
export async function syncBotFlowsWithServer(input: {
  listRemote: () => Promise<BotFlowDraft[]>;
  upsertRemote: (flow: BotFlowDraft) => Promise<BotFlowDraft>;
}): Promise<BotFlowDraft[]> {
  const local = listStoredBotFlows();
  let remote: BotFlowDraft[] = [];
  try {
    remote = await input.listRemote();
  } catch {
    return local;
  }

  const merged = mergeBotFlowLists(local, remote);

  for (const flow of merged) {
    const onServer = remote.find((item) => item.id === flow.id);
    if (!onServer || flow.updatedAt.localeCompare(onServer.updatedAt) > 0) {
      try {
        await input.upsertRemote(flow);
      } catch {
        /* mantém merge local mesmo se um upsert falhar */
      }
    }
  }

  let afterUpload = remote;
  try {
    afterUpload = await input.listRemote();
  } catch {
    afterUpload = remote;
  }

  const final = mergeBotFlowLists(merged, afterUpload);
  writeStored(final);
  return listStoredBotFlows();
}

export function createFreshBotDraft(): BotFlowDraft {
  return ensureBotHasStart(createDefaultBotDraft());
}
