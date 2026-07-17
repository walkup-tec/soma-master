import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { buildDefaultPushConfig } from "@/lib/push/push.constants";
import type { SomaPushConfig, SomaPushMessage } from "@/lib/push/push.types";

const DATA_DIR = join(process.cwd(), "data");
const MESSAGES_FILE = join(DATA_DIR, "soma-push-messages.json");
const CONFIG_FILE = join(DATA_DIR, "soma-push-config.json");

type MessageStore = {
  version: 1;
  messages: SomaPushMessage[];
};

function emptyStore(): MessageStore {
  return { version: 1, messages: [] };
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readMessages(): MessageStore {
  ensureDataDir();
  if (!existsSync(MESSAGES_FILE)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(MESSAGES_FILE, "utf8")) as MessageStore;
    if (parsed?.version !== 1 || !Array.isArray(parsed.messages)) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeMessages(store: MessageStore): void {
  ensureDataDir();
  const tmp = `${MESSAGES_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  writeFileSync(MESSAGES_FILE, readFileSync(tmp));
}

export function createPushId(): string {
  return randomUUID();
}

export function listPushMessages(limit = 50): SomaPushMessage[] {
  return readMessages()
    .messages.map((row) => ({
      ...row,
      image: row.image?.id ? row.image : null,
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, Math.max(1, limit));
}

export function getPushMessageById(id: string): SomaPushMessage | null {
  const normalized = String(id || "").trim();
  if (!normalized) return null;
  return readMessages().messages.find((row) => row.id === normalized) ?? null;
}

export function savePushMessage(message: SomaPushMessage): SomaPushMessage {
  const store = readMessages();
  const idx = store.messages.findIndex((row) => row.id === message.id);
  if (idx >= 0) store.messages[idx] = message;
  else store.messages.push(message);
  writeMessages(store);
  return message;
}

export function readPushConfig(): SomaPushConfig {
  ensureDataDir();
  const defaults = buildDefaultPushConfig();
  if (!existsSync(CONFIG_FILE)) {
    writePushConfig(defaults);
    return { ...defaults };
  }
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Partial<SomaPushConfig>;
    return {
      communityInviteLink: String(
        parsed.communityInviteLink || defaults.communityInviteLink,
      ).trim(),
      communityAnnouncementGroupJid: String(
        parsed.communityAnnouncementGroupJid || defaults.communityAnnouncementGroupJid,
      ).trim(),
      communityEvoInstance: String(
        parsed.communityEvoInstance || defaults.communityEvoInstance,
      ).trim(),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return { ...defaults };
  }
}

export function writePushConfig(config: SomaPushConfig): SomaPushConfig {
  ensureDataDir();
  const payload: SomaPushConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  const tmp = `${CONFIG_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  writeFileSync(CONFIG_FILE, readFileSync(tmp));
  return payload;
}

export function dismissPushForUser(pushId: string, email: string): boolean {
  const normalizedId = String(pushId || "").trim();
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedId || !normalizedEmail.includes("@")) return false;
  const store = readMessages();
  const row = store.messages.find((item) => item.id === normalizedId);
  if (!row) return false;
  const dismissed = new Set(
    (row.dismissedBy || []).map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    ),
  );
  if (dismissed.has(normalizedEmail)) return true;
  dismissed.add(normalizedEmail);
  row.dismissedBy = Array.from(dismissed);
  writeMessages(store);
  return true;
}
