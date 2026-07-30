import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const RR_FILE = join(DATA_DIR, "bot-transfer-round-robin.json");

type RoundRobinState = { nextIndex: number };

let mutex: Promise<unknown> = Promise.resolve();

async function readState(): Promise<RoundRobinState> {
  try {
    const raw = await readFile(RR_FILE, "utf8");
    const parsed = JSON.parse(raw) as RoundRobinState;
    const nextIndex = Number(parsed?.nextIndex);
    return { nextIndex: Number.isFinite(nextIndex) && nextIndex >= 0 ? Math.floor(nextIndex) : 0 };
  } catch {
    return { nextIndex: 0 };
  }
}

async function writeState(state: RoundRobinState): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(RR_FILE, JSON.stringify(state, null, 2), "utf8");
}

/**
 * Pega o próximo índice da fila 1-para-1 e avança o cursor (ciclo).
 * Serializa leituras/escritas para manter distribuição igualitária.
 */
export async function takeRoundRobinIndex(poolSize: number): Promise<number> {
  if (poolSize <= 0) return 0;

  const run = mutex.then(async () => {
    const state = await readState();
    const index = state.nextIndex % poolSize;
    await writeState({ nextIndex: state.nextIndex + 1 });
    return index;
  });

  mutex = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
