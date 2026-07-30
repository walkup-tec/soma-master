import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const PRESENCE_FILE = join(DATA_DIR, "agent-presence.json");

/** Considera online se houve atividade recente (poll de sessão ~120s + folga). */
export const AGENT_ONLINE_TTL_MS = 5 * 60 * 1000;

type PresenceMap = Record<string, string>;

let cache: PresenceMap | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function readPresence(): Promise<PresenceMap> {
  if (cache) return cache;
  try {
    const raw = await readFile(PRESENCE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PresenceMap;
    cache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

function enqueueWrite(map: PresenceMap): void {
  writeQueue = writeQueue
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(PRESENCE_FILE, JSON.stringify(map, null, 2), "utf8");
    })
    .catch(() => {
      /* não bloqueia o fluxo do chat */
    });
}

/** Marca o usuário como ativo (logado / usando o CRM). */
export async function touchAgentPresence(userId: string): Promise<void> {
  const id = String(userId || "").trim();
  if (!id) return;
  const map = await readPresence();
  map[id] = new Date().toISOString();
  cache = map;
  enqueueWrite(map);
}

export async function clearAgentPresence(userId: string): Promise<void> {
  const id = String(userId || "").trim();
  if (!id) return;
  const map = await readPresence();
  if (!(id in map)) return;
  delete map[id];
  cache = map;
  enqueueWrite(map);
}

export async function isAgentOnline(userId: string, now = Date.now()): Promise<boolean> {
  const id = String(userId || "").trim();
  if (!id) return false;
  const map = await readPresence();
  const last = map[id];
  if (!last) return false;
  const ts = Date.parse(last);
  if (!Number.isFinite(ts)) return false;
  return now - ts <= AGENT_ONLINE_TTL_MS;
}

export async function listOnlineAgentIds(now = Date.now()): Promise<string[]> {
  const map = await readPresence();
  return Object.entries(map)
    .filter(([, iso]) => {
      const ts = Date.parse(iso);
      return Number.isFinite(ts) && now - ts <= AGENT_ONLINE_TTL_MS;
    })
    .map(([id]) => id);
}
