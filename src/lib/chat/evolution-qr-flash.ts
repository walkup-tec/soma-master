import type { EvolutionConnectionState, EvolutionQrPayload } from "@/lib/chat/evolution.adapter";

type Flash = {
  state: EvolutionConnectionState;
  qr: EvolutionQrPayload;
  error?: string;
  at: number;
};

const TTL_MS = 90_000;
const byKey = new Map<string, Flash>();

function flashKey(userId: string, instanceName?: string | null): string {
  const instance = String(instanceName || "").trim() || "_default";
  return `${userId}::${instance}`;
}

export function putEvolutionQrFlash(
  userId: string,
  payload: Omit<Flash, "at">,
  instanceName?: string | null,
): void {
  byKey.set(flashKey(userId, instanceName), { ...payload, at: Date.now() });
}

export function takeEvolutionQrFlash(
  userId: string,
  instanceName?: string | null,
): Flash | null {
  const key = flashKey(userId, instanceName);
  const item = byKey.get(key);
  if (!item) return null;
  if (Date.now() - item.at > TTL_MS) {
    byKey.delete(key);
    return null;
  }
  return item;
}

export function clearEvolutionQrFlash(userId: string, instanceName?: string | null): void {
  byKey.delete(flashKey(userId, instanceName));
}
