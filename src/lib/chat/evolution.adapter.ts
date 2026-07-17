/**
 * Adapter Evolution API — WhatsApp send + conexão QR + instância isolada Soma.
 *
 * Doc oficial (v2):
 * - https://doc.evolution-api.com/v2/en/configuration/webhooks
 * - https://evolutionapi-evolution-api-90.mintlify.app/concepts/instances
 * - https://doc.evolution-api.com/v2/api-reference/instance-controller/instance-connect
 * - Connection State / Connect / Create / sendText
 *
 * Isolamento: SOMA só opera em EVOLUTION_INSTANCE (padrão `soma-crm`).
 * Nunca logout/delete/send em instâncias WABA ou de outros apps no mesmo Easypanel.
 */

export type EvolutionConnectionState = "open" | "connecting" | "close" | "unknown";

export type EvolutionQrPayload = {
  base64?: string;
  code?: string;
  pairingCode?: string | null;
  count?: number;
};

/** Prefixo obrigatório do nome da instância deste CRM (compartilha EVO com WABA). */
export const SOMA_EVOLUTION_INSTANCE_PREFIX = "soma-";
export const SOMA_EVOLUTION_INSTANCE_DEFAULT = "soma-crm";

function evolutionEnv() {
  const base = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "") ?? "";
  const apiKey = process.env.EVOLUTION_API_KEY?.trim() ?? "";
  const instanceRaw = process.env.EVOLUTION_INSTANCE?.trim() || SOMA_EVOLUTION_INSTANCE_DEFAULT;
  return { base, apiKey, instance: instanceRaw };
}

/** Bloqueia operação se o nome da instância não for exclusiva do Soma. */
export function assertSomaOwnedInstance(instance: string): void {
  const name = instance.trim().toLowerCase();
  if (!name.startsWith(SOMA_EVOLUTION_INSTANCE_PREFIX)) {
    throw new Error(
      `Instância Evolution "${instance}" rejeitada: Soma só pode usar nomes com prefixo "${SOMA_EVOLUTION_INSTANCE_PREFIX}" (ex.: ${SOMA_EVOLUTION_INSTANCE_DEFAULT}).`,
    );
  }
}

export function isEvolutionConfigured(): boolean {
  const { base, apiKey, instance } = evolutionEnv();
  if (!base || !apiKey || !instance) return false;
  try {
    assertSomaOwnedInstance(instance);
    return true;
  } catch {
    return false;
  }
}

/** Resumo seguro para UI (sem API key). */
export function getEvolutionPublicConfig(): {
  configured: boolean;
  apiUrlHost: string | null;
  instance: string | null;
} {
  const { base, apiKey, instance } = evolutionEnv();
  let apiUrlHost: string | null = null;
  if (base) {
    try {
      apiUrlHost = new URL(base).host;
    } catch {
      apiUrlHost = base.slice(0, 80);
    }
  }
  let owned = false;
  try {
    assertSomaOwnedInstance(instance);
    owned = true;
  } catch {
    owned = false;
  }
  return {
    configured: Boolean(base && apiKey && instance && owned),
    apiUrlHost,
    instance: instance || null,
  };
}

async function evolutionFetch(path: string, init?: RequestInit): Promise<{
  ok: boolean;
  status: number;
  raw: unknown;
  error?: string;
}> {
  const { base, apiKey, instance } = evolutionEnv();
  if (!base || !apiKey) {
    return {
      ok: false,
      status: 0,
      raw: null,
      error: "Evolution API não configurada (EVOLUTION_API_URL / KEY).",
    };
  }
  try {
    assertSomaOwnedInstance(instance);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      raw: null,
      error: error instanceof Error ? error.message : "Instância não permitida",
    };
  }

  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        ...(init?.headers ?? {}),
      },
      signal: init?.signal ?? AbortSignal.timeout(45_000),
    });
    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        raw,
        error: formatEvolutionHttpError(response.status, raw),
      };
    }
    return { ok: true, status: response.status, raw };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      raw: null,
      error: error instanceof Error ? error.message : "Falha na Evolution API",
    };
  }
}

function formatEvolutionHttpError(status: number, raw: unknown): string {
  const detail = extractEvolutionErrorDetail(raw);
  return detail ? `Evolution HTTP ${status}: ${detail}` : `Evolution HTTP ${status}`;
}

function extractEvolutionErrorDetail(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.slice(0, 280);
  if (typeof raw !== "object") return String(raw).slice(0, 280);
  const record = raw as Record<string, unknown>;
  const response = record.response;
  if (typeof response === "string") return response.slice(0, 280);
  if (response && typeof response === "object") {
    const nested = response as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message.slice(0, 280);
    if (Array.isArray(nested.message)) {
      return nested.message
        .flat(Infinity)
        .map((item) => String(item))
        .join("; ")
        .slice(0, 280);
    }
  }
  if (typeof record.message === "string") return record.message.slice(0, 280);
  if (Array.isArray(record.message)) {
    return record.message
      .flat(Infinity)
      .map((item) => String(item))
      .join("; ")
      .slice(0, 280);
  }
  try {
    return JSON.stringify(raw).slice(0, 280);
  } catch {
    return "";
  }
}

function normalizeState(raw: unknown): EvolutionConnectionState {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const nested =
    record.instance && typeof record.instance === "object"
      ? (record.instance as Record<string, unknown>)
      : record;
  const state = String(nested.state ?? record.state ?? "").toLowerCase();
  if (state === "open") return "open";
  if (state === "connecting") return "connecting";
  if (state === "close" || state === "closed") return "close";
  return "unknown";
}

function extractQr(raw: unknown): EvolutionQrPayload {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const source =
    Array.isArray(raw) && raw[0] && typeof raw[0] === "object"
      ? (raw[0] as Record<string, unknown>)
      : record;

  let base64 = typeof source.base64 === "string" ? source.base64 : undefined;
  if (base64 && !base64.startsWith("data:")) {
    base64 = `data:image/png;base64,${base64}`;
  }

  return {
    base64,
    code: typeof source.code === "string" ? source.code : undefined,
    pairingCode: typeof source.pairingCode === "string" ? source.pairingCode : null,
    count: typeof source.count === "number" ? source.count : undefined,
  };
}

const WEBHOOK_PATH = "/api/chat/whatsapp-webhook";

/** Monta URL do webhook a partir de uma base pública (só o domínio HTTPS). */
export function resolveWebhookUrlFromBase(baseRaw: string | null | undefined): string | null {
  let base = (baseRaw ?? "").trim().replace(/\/+$/, "");
  if (!base) return null;
  // Evolution no VPS não alcança localhost — só URL pública
  if (/localhost|127\.0\.0\.1/i.test(base)) return null;
  // Se colaram a URL completa do webhook, não duplicar o path
  base = base.replace(/\/api\/chat\/whatsapp-webhook\/?$/i, "");
  if (!base) return null;
  return `${base}${WEBHOOK_PATH}`;
}

function resolveWebhookUrl(publicBaseOverride?: string | null): string | null {
  return (
    resolveWebhookUrlFromBase(publicBaseOverride) ||
    resolveWebhookUrlFromBase(process.env.CHAT_PUBLIC_BASE_URL) ||
    resolveWebhookUrlFromBase(process.env.APP_URL)
  );
}

export function getResolvedWebhookUrl(publicBaseOverride?: string | null): string | null {
  return resolveWebhookUrl(publicBaseOverride);
}

/**
 * Garante que a instância `soma-*` exista neste EVO compartilhado.
 * Não altera/remove/logout em nenhuma outra instância.
 */
export async function ensureSomaEvolutionInstance(options?: {
  webhookPublicBaseUrl?: string | null;
}): Promise<{
  ok: boolean;
  created: boolean;
  error?: string;
}> {
  const { instance } = evolutionEnv();
  try {
    assertSomaOwnedInstance(instance);
  } catch (error) {
    return {
      ok: false,
      created: false,
      error: error instanceof Error ? error.message : "Instância inválida",
    };
  }

  const webhookUrl = resolveWebhookUrl(options?.webhookPublicBaseUrl);
  const state = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instance)}`);
  if (state.ok) {
    // Mantém instâncias existentes atualizadas (inclui base64=true para imagens recebidas).
    if (webhookUrl) {
      await evolutionSetInstanceWebhook(webhookUrl, options?.webhookPublicBaseUrl).catch(
        () => undefined,
      );
    }
    return { ok: true, created: false };
  }
  // Rede/timeout: não cria no escuro
  if (state.status === 0) {
    return { ok: false, created: false, error: state.error };
  }
  // 404 (ou equivalente): cria só soma-*; 409 no create = já existe

  const secret = process.env.CHAT_WEBHOOK_SECRET?.trim();
  const createPayload: Record<string, unknown> = {
    instanceName: instance,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  };
  if (webhookUrl) {
    createPayload.webhook = {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: true,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      ...(secret
        ? {
            headers: {
              "x-soma-webhook-secret": secret,
            },
          }
        : {}),
    };
  }

  const created = await evolutionFetch(`/instance/create`, {
    method: "POST",
    body: JSON.stringify(createPayload),
  });

  if (created.ok || created.status === 409) {
    if (webhookUrl) {
      await evolutionSetInstanceWebhook(webhookUrl, options?.webhookPublicBaseUrl).catch(
        () => undefined,
      );
    }
    return { ok: true, created: created.ok && created.status !== 409 };
  }

  return {
    ok: false,
    created: false,
    error: created.error ?? `Falha ao criar instância ${instance}`,
  };
}

/** Webhook apenas desta instância (não global). */
export async function evolutionSetInstanceWebhook(
  webhookUrl?: string | null,
  publicBaseOverride?: string | null,
): Promise<{
  ok: boolean;
  error?: string;
  webhookUrl?: string | null;
}> {
  const { instance } = evolutionEnv();
  assertSomaOwnedInstance(instance);
  const url = webhookUrl ?? resolveWebhookUrl(publicBaseOverride);
  if (!url) {
    return {
      ok: false,
      error:
        "URL pública do webhook ausente. Informe um HTTPS público (não localhost) em Integração EVO.",
      webhookUrl: null,
    };
  }
  const secret = process.env.CHAT_WEBHOOK_SECRET?.trim();
  const result = await evolutionFetch(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: true,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        ...(secret
          ? {
              headers: {
                "x-soma-webhook-secret": secret,
              },
            }
          : {}),
      },
    }),
  });
  return { ok: result.ok, error: result.error, webhookUrl: url };
}

export async function evolutionConnectionState(): Promise<{
  ok: boolean;
  state: EvolutionConnectionState;
  raw?: unknown;
  error?: string;
}> {
  const { instance } = evolutionEnv();
  assertSomaOwnedInstance(instance);
  const result = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instance)}`);
  if (!result.ok) {
    return { ok: false, state: "unknown", raw: result.raw, error: result.error };
  }
  return { ok: true, state: normalizeState(result.raw), raw: result.raw };
}

/** Gera/atualiza QR — cria a instância soma-* se ainda não existir. */
export async function evolutionConnectQr(): Promise<{
  ok: boolean;
  state: EvolutionConnectionState;
  qr: EvolutionQrPayload;
  raw?: unknown;
  error?: string;
}> {
  const ensured = await ensureSomaEvolutionInstance();
  if (!ensured.ok) {
    return {
      ok: false,
      state: "unknown",
      qr: {},
      error: ensured.error,
    };
  }

  const { instance } = evolutionEnv();
  const result = await evolutionFetch(`/instance/connect/${encodeURIComponent(instance)}`, {
    method: "GET",
  });
  if (!result.ok) {
    return {
      ok: false,
      state: "unknown",
      qr: {},
      raw: result.raw,
      error: result.error,
    };
  }

  const qr = extractQr(result.raw);
  const state = normalizeState(result.raw);
  const inferred: EvolutionConnectionState =
    state !== "unknown" ? state : qr.base64 || qr.code ? "connecting" : "unknown";

  return { ok: true, state: inferred, qr, raw: result.raw };
}

export async function evolutionSendText(input: {
  phone: string;
  text: string;
  /** Sobrescreve EVOLUTION_INSTANCE (ex.: envio à comunidade). */
  instanceName?: string;
}): Promise<{ ok: boolean; raw?: unknown; error?: string }> {
  if (!isEvolutionConfigured()) {
    return { ok: false, error: "Evolution API não configurada (EVOLUTION_API_URL / KEY / INSTANCE)." };
  }

  const { instance: defaultInstance } = evolutionEnv();
  const instance = String(input.instanceName || defaultInstance).trim() || defaultInstance;
  assertSomaOwnedInstance(instance);
  const rawTarget = String(input.phone || "").trim();
  // Grupos/comunidade usam JID completo (ex.: 120363...@g.us); contatos usam só dígitos.
  const number = rawTarget.includes("@g.us")
    ? rawTarget
    : rawTarget.replace(/\D+/g, "");
  const text = String(input.text || "").trim();
  if (!number || !text) {
    return { ok: false, error: "Destino ou texto vazio para envio Evolution." };
  }

  const bodies: Array<Record<string, unknown>> = [
    { number, text },
    // Algumas builds antigas da Evolution ainda exigem o envelope v1.
    { number, textMessage: { text } },
  ];

  let lastError = "Falha ao enviar texto na Evolution.";
  let lastRaw: unknown = null;
  for (const body of bodies) {
    const result = await evolutionFetch(`/message/sendText/${encodeURIComponent(instance)}`, {
      method: "POST",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (result.ok) return { ok: true, raw: result.raw };
    lastError = result.error || lastError;
    lastRaw = result.raw;
    const detail = `${result.error || ""} ${JSON.stringify(result.raw ?? "")}`.toLowerCase();
    // Só tenta o payload alternativo quando o 400 aponta formato de texto.
    if (
      result.status !== 400 ||
      (!detail.includes("text") && !detail.includes("textmessage") && !detail.includes("property"))
    ) {
      break;
    }
  }

  return { ok: false, raw: lastRaw, error: lastError };
}

/**
 * Envia imagem pela Evolution v2.
 * Doc oficial: POST /message/sendMedia/{instance}; `media` aceita URL ou base64.
 *
 * Importante (mesmo fix do WABA): o validador da Evolution (`class-validator`)
 * usa `isBase64` / `isURL`. Data URI (`data:image/...;base64,...`) falha nos dois
 * e retorna HTTP 400 "Owned media must be a url or base64". Por isso tentamos
 * **base64 puro primeiro**, depois data URI, e por fim URLs (se passadas).
 * Ref: doc/LOG-2026-06-30__push-comunidade-imagem-tls-base64-fix.md (WABA).
 */
export function buildEvolutionMediaVariants(
  mediaOrDataUrl: string,
  mimeType = "image/jpeg",
): string[] {
  const trimmed = String(mediaOrDataUrl || "").replace(/\s+/g, "");
  if (!trimmed) return [];
  if (/^https?:\/\//i.test(trimmed)) return [trimmed];
  const raw = trimmed.replace(/^data:[^;]+;base64,/i, "");
  if (!raw) return [];
  const mime = String(mimeType || "image/jpeg").trim() || "image/jpeg";
  return Array.from(new Set([raw, `data:${mime};base64,${raw}`]));
}

function isEvolutionMediaFormatError(error?: string): boolean {
  const text = String(error || "").toLowerCase();
  return (
    text.includes("owned media") ||
    text.includes("must be a url or base64") ||
    text.includes("base64") ||
    text.includes("media")
  );
}

export async function evolutionSendImage(input: {
  phone: string;
  /** Data URI ou base64 puro (variantes são montadas automaticamente). */
  dataUrl?: string;
  /** Lista explícita de candidatos (URL e/ou base64), na ordem de tentativa. */
  mediaCandidates?: string[];
  mimeType: string;
  fileName: string;
  caption?: string;
  instanceName?: string;
}): Promise<{ ok: boolean; raw?: unknown; error?: string }> {
  if (!isEvolutionConfigured()) {
    return { ok: false, error: "Evolution API não configurada (EVOLUTION_API_URL / KEY / INSTANCE)." };
  }
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(input.mimeType)) {
    return { ok: false, error: "Formato de imagem não permitido." };
  }

  const { instance: defaultInstance } = evolutionEnv();
  const instance = String(input.instanceName || defaultInstance).trim() || defaultInstance;
  assertSomaOwnedInstance(instance);
  const rawTarget = String(input.phone || "").trim();
  const number = rawTarget.includes("@g.us")
    ? rawTarget
    : rawTarget.replace(/\D+/g, "");
  const fileName = String(input.fileName || "image.jpg").trim() || "image.jpg";
  const caption = input.caption?.trim() ?? "";

  const candidates =
    input.mediaCandidates && input.mediaCandidates.length > 0
      ? input.mediaCandidates.filter(Boolean)
      : buildEvolutionMediaVariants(String(input.dataUrl || ""), input.mimeType);

  if (!candidates.length) {
    return { ok: false, error: "Mídia vazia: informe URL ou base64." };
  }

  let lastError = "Falha ao enviar imagem.";
  let lastRaw: unknown = null;

  for (const media of candidates) {
    const result = await evolutionFetch(`/message/sendMedia/${encodeURIComponent(instance)}`, {
      method: "POST",
      body: JSON.stringify({
        number,
        mediatype: "image",
        mimetype: input.mimeType,
        caption,
        media,
        fileName,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (result.ok) return { ok: true, raw: result.raw };
    lastError = result.error || lastError;
    lastRaw = result.raw;
    // Formato inválido → tenta próxima variante (raw ↔ data URI ↔ URL).
    if (result.status === 400 && isEvolutionMediaFormatError(result.error)) {
      continue;
    }
    // Outros 400 (ex.: JID) não se resolvem trocando o formato da mídia.
    if (result.status === 400) break;
  }

  return { ok: false, raw: lastRaw, error: lastError };
}

/**
 * Fallback para webhooks sem base64 embutido.
 * Doc oficial: POST /chat/getBase64FromMediaMessage/{instance}.
 */
export async function evolutionGetMediaBase64(messageKey: Record<string, unknown>): Promise<{
  ok: boolean;
  base64?: string;
  mimeType?: string;
  error?: string;
}> {
  const { instance } = evolutionEnv();
  assertSomaOwnedInstance(instance);
  const result = await evolutionFetch(
    `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`,
    {
      method: "POST",
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!result.ok) return { ok: false, error: result.error };
  const raw = (result.raw && typeof result.raw === "object"
    ? result.raw
    : {}) as Record<string, unknown>;
  const base64 =
    (typeof raw.base64 === "string" && raw.base64) ||
    (typeof raw.media === "string" && raw.media) ||
    undefined;
  const mimeType =
    (typeof raw.mimetype === "string" && raw.mimetype) ||
    (typeof raw.mimeType === "string" && raw.mimeType) ||
    undefined;
  return base64
    ? { ok: true, base64, mimeType }
    : { ok: false, error: "Evolution não retornou o conteúdo da imagem." };
}

/** Extrai nome da instância no payload do webhook — ignora eventos de outras apps. */
export function extractEvolutionInstanceName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (typeof root.instance === "string") return root.instance;
  if (root.instance && typeof root.instance === "object") {
    const nested = root.instance as Record<string, unknown>;
    if (typeof nested.instanceName === "string") return nested.instanceName;
    if (typeof nested.name === "string") return nested.name;
  }
  if (typeof root.instanceName === "string") return root.instanceName;
  return null;
}

export function isWebhookForSomaInstance(payload: unknown): boolean {
  const expected = evolutionEnv().instance.toLowerCase();
  const got = extractEvolutionInstanceName(payload)?.toLowerCase();
  // Sem nome no payload: rejeita (evita processar eventos globais de outras apps)
  if (!got) return false;
  return got === expected;
}
