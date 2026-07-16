import type { EvolutionConnectionState, EvolutionQrPayload } from "@/lib/chat/evolution.adapter";

type Flash = {
  state: EvolutionConnectionState;
  qr: EvolutionQrPayload;
  error?: string;
  at: number;
};

const TTL_MS = 90_000;
const byUser = new Map<string, Flash>();

export function putEvolutionQrFlash(
  userId: string,
  payload: Omit<Flash, "at">,
): void {
  byUser.set(userId, { ...payload, at: Date.now() });
}

export function takeEvolutionQrFlash(userId: string): Flash | null {
  const item = byUser.get(userId);
  if (!item) return null;
  if (Date.now() - item.at > TTL_MS) {
    byUser.delete(userId);
    return null;
  }
  // keep until TTL so refresh status doesn't clear QR
  return item;
}

export function clearEvolutionQrFlash(userId: string): void {
  byUser.delete(userId);
}
