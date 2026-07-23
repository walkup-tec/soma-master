import {
  createDefaultBotDraft,
  ensureBotHasStart,
  normalizeBotDraft,
} from "@/lib/bots/bot-flow.normalize";
import type { BotFlowDraft } from "@/lib/bots/bot.types";

const STORAGE_KEY = "soma-bots-flows-v1";

function readStored(): BotFlowDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    STORAGE_KEY,
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

export function createFreshBotDraft(): BotFlowDraft {
  return ensureBotHasStart(createDefaultBotDraft());
}
