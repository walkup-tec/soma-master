/**
 * Adapter Evolution API — WhatsApp send + conexão QR + instância isolada Soma.
 *
 * Doc oficial (v2):
 * - https://doc.evolution-api.com/v2/en/configuration/webhooks
 * - https://evolutionapi-evolution-api-90.mintlify.app/concepts/instances
 * - https://doc.evolution-api.com/v2/api-reference/instance-controller/instance-connect
 * - Connection State / Connect / Create / sendText
 *
 * Isolamento: SOMA só opera em instâncias com prefixo `soma-` (padrão `soma-crm`).
 * Nunca logout/delete/send em instâncias WABA ou de outros apps no mesmo Easypanel.
 * Múltiplos canais: várias instâncias `soma-*` no mesmo Evolution (URL/KEY no .env).
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

/** Instância padrão (env) — usada no bootstrap e como fallback de envio. */
export function getDefaultSomaEvolutionInstance(): string {
  return evolutionEnv().instance;
}

function resolveTargetInstance(instanceName?: string | null): string {
  const target = String(instanceName || evolutionEnv().instance).trim() || SOMA_EVOLUTION_INSTANCE_DEFAULT;
  assertSomaOwnedInstance(target);
  return target;
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
  const { base, apiKey } = evolutionEnv();
  return Boolean(base && apiKey);
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
  return {
    configured: Boolean(base && apiKey),
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
  const { base, apiKey } = evolutionEnv();
  if (!base || !apiKey) {
    return {
      ok: false,
      status: 0,
      raw: null,
      error: "Evolution API não configurada (EVOLUTION_API_URL / KEY).",
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

function extractEvolutionSendKeyId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const key = record.key;
  if (key && typeof key === "object") {
    const id = (key as Record<string, unknown>).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  if (typeof record.id === "string" && record.id.trim()) return record.id.trim();
  return null;
}

function extractEvolutionSendStatus(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.status === "string" && record.status.trim()) {
    return record.status.trim().toUpperCase();
  }
  return null;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTP 201 da Evolution não garante entrega: muitas vezes volta PENDING e depois ERROR.
 * Confirma o status real antes de o CRM assumir sucesso.
 */
async function confirmEvolutionOutboundDelivery(input: {
  instance: string;
  raw: unknown;
}): Promise<{ ok: boolean; raw: unknown; error?: string }> {
  const initialStatus = extractEvolutionSendStatus(input.raw);
  const keyId = extractEvolutionSendKeyId(input.raw);

  if (initialStatus === "ERROR") {
    return {
      ok: false,
      raw: input.raw,
      error: "Evolution recusou a entrega (status ERROR).",
    };
  }

  // Já acusou recebimento no servidor WhatsApp.
  if (
    initialStatus === "SERVER_ACK" ||
    initialStatus === "DELIVERY_ACK" ||
    initialStatus === "READ" ||
    initialStatus === "PLAYED"
  ) {
    return { ok: true, raw: input.raw };
  }

  if (!keyId) {
    // Sem id para auditar — mantém o comportamento anterior (HTTP ok).
    return { ok: true, raw: input.raw };
  }

  // PENDING / ausente: consulta o status real por alguns segundos.
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleepMs(1500);
    const statusResult = await evolutionFetch(
      `/chat/findStatusMessage/${encodeURIComponent(input.instance)}`,
      {
        method: "POST",
        body: JSON.stringify({ where: { id: keyId } }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!statusResult.ok) continue;

    const rows = Array.isArray(statusResult.raw)
      ? statusResult.raw
      : statusResult.raw
        ? [statusResult.raw]
        : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const status = String((row as Record<string, unknown>).status ?? "")
        .trim()
        .toUpperCase();
      if (!status) continue;
      if (status === "ERROR" || status === "INACTIVE") {
        return {
          ok: false,
          raw: input.raw,
          error: `Evolution não entregou no WhatsApp (status ${status}). Reconecte a instância ou peça para o contato enviar uma nova mensagem.`,
        };
      }
      if (
        status === "SERVER_ACK" ||
        status === "DELIVERY_ACK" ||
        status === "READ" ||
        status === "PLAYED"
      ) {
        return { ok: true, raw: input.raw };
      }
    }
  }

  return {
    ok: false,
    raw: input.raw,
    error:
      "Evolution aceitou o envio, mas a mensagem ficou PENDING sem confirmação. Ela provavelmente não chegou no WhatsApp.",
  };
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

/** Extrai dígitos do número conectado (ownerJid / number / owner). */
export function extractConnectedWhatsAppPhone(raw: unknown): string | null {
  const candidates: unknown[] = [];

  const pushFrom = (value: unknown) => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      candidates.push(value);
      return;
    }
    if (typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    candidates.push(
      record.number,
      record.ownerJid,
      record.owner,
      record.wuid,
      record.wid,
    );
    if (record.instance && typeof record.instance === "object") {
      pushFrom(record.instance);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) pushFrom(item);
  } else {
    pushFrom(raw);
  }

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const text = String(candidate).trim();
    if (!text) continue;
    const withoutJid = text.split("@")[0] ?? text;
    const digits = withoutJid.replace(/\D+/g, "");
    if (digits.length >= 10 && digits.length <= 15) return digits;
  }
  return null;
}

/**
 * Busca o número WhatsApp vinculado à instância (fetchInstances).
 * connectionState sozinho não devolve o telefone.
 */
export async function evolutionFetchInstancePhone(instanceName?: string | null): Promise<{
  ok: boolean;
  phone: string | null;
  raw?: unknown;
  error?: string;
}> {
  const instance = resolveTargetInstance(instanceName);
  if (!isEvolutionConfigured()) {
    return { ok: false, phone: null, error: "Evolution API não configurada." };
  }
  const result = await evolutionFetch(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`,
  );
  if (!result.ok) {
    return { ok: false, phone: null, raw: result.raw, error: result.error };
  }
  return {
    ok: true,
    phone: extractConnectedWhatsAppPhone(result.raw),
    raw: result.raw,
  };
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
  instanceName?: string | null;
}): Promise<{
  ok: boolean;
  created: boolean;
  error?: string;
}> {
  let instance: string;
  try {
    instance = resolveTargetInstance(options?.instanceName);
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
      await evolutionSetInstanceWebhook(webhookUrl, options?.webhookPublicBaseUrl, instance).catch(
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
      await evolutionSetInstanceWebhook(webhookUrl, options?.webhookPublicBaseUrl, instance).catch(
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
  instanceName?: string | null,
): Promise<{
  ok: boolean;
  error?: string;
  webhookUrl?: string | null;
}> {
  const instance = resolveTargetInstance(instanceName);
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

export async function evolutionConnectionState(instanceName?: string | null): Promise<{
  ok: boolean;
  state: EvolutionConnectionState;
  raw?: unknown;
  error?: string;
}> {
  const instance = resolveTargetInstance(instanceName);
  const result = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instance)}`);
  if (!result.ok) {
    return { ok: false, state: "unknown", raw: result.raw, error: result.error };
  }
  return { ok: true, state: normalizeState(result.raw), raw: result.raw };
}

/** Gera/atualiza QR — cria a instância soma-* se ainda não existir.
 * Se `phoneNumber` for informado, a Evolution também devolve pairingCode
 * (WhatsApp → Aparelhos conectados → Conectar com número).
 */
export async function evolutionConnectQr(
  instanceName?: string | null,
  phoneNumber?: string | null,
): Promise<{
  ok: boolean;
  state: EvolutionConnectionState;
  qr: EvolutionQrPayload;
  raw?: unknown;
  error?: string;
}> {
  const instance = resolveTargetInstance(instanceName);
  const ensured = await ensureSomaEvolutionInstance({ instanceName: instance });
  if (!ensured.ok) {
    return {
      ok: false,
      state: "unknown",
      qr: {},
      error: ensured.error,
    };
  }

  const digits = String(phoneNumber || "").replace(/\D+/g, "");
  const qs = digits ? `?number=${encodeURIComponent(digits)}` : "";
  const result = await evolutionFetch(`/instance/connect/${encodeURIComponent(instance)}${qs}`, {
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
    state !== "unknown"
      ? state
      : qr.base64 || qr.code || qr.pairingCode
        ? "connecting"
        : "unknown";

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
      signal: AbortSignal.timeout(12_000),
    });
    if (result.ok) {
      return confirmEvolutionOutboundDelivery({ instance, raw: result.raw });
    }
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

/** Envia mensagem com botões de resposta rápida (até 3 no WhatsApp). */
export async function evolutionSendButtons(input: {
  phone: string;
  title: string;
  description?: string;
  footer?: string;
  buttons: Array<{ id: string; displayText: string }>;
  instanceName?: string;
}): Promise<{ ok: boolean; raw?: unknown; error?: string }> {
  if (!isEvolutionConfigured()) {
    return { ok: false, error: "Evolution API não configurada (EVOLUTION_API_URL / KEY / INSTANCE)." };
  }

  const { instance: defaultInstance } = evolutionEnv();
  const instance = String(input.instanceName || defaultInstance).trim() || defaultInstance;
  assertSomaOwnedInstance(instance);
  const number = String(input.phone || "").replace(/\D+/g, "");
  const title = String(input.title || "").trim();
  const buttons = (input.buttons || [])
    .map((btn) => ({
      type: "reply" as const,
      id: String(btn.id || "").trim().slice(0, 256),
      displayText: String(btn.displayText || "").trim().slice(0, 20),
    }))
    .filter((btn) => btn.id && btn.displayText)
    .slice(0, 3);

  if (!number || !title || buttons.length === 0) {
    return { ok: false, error: "Destino, título ou botões inválidos para Evolution." };
  }

  const body = {
    number,
    title,
    description: String(input.description || "").trim() || undefined,
    footer: String(input.footer || "").trim() || undefined,
    buttons,
  };

  const result = await evolutionFetch(`/message/sendButtons/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!result.ok) {
    return { ok: false, raw: result.raw, error: result.error || "Falha ao enviar botões na Evolution." };
  }

  // Evolution 2.3.7: viewOnce wrapping = botões fantasma.
  // Evolution 2.4.0+: interactiveMessage + nativeFlowMessage (sem viewOnce) é o formato válido.
  const rawText = JSON.stringify(result.raw ?? "");
  if (rawText.includes("viewOnceMessage")) {
    return {
      ok: false,
      raw: result.raw,
      error:
        "Evolution gerou botões fantasma (viewOnce). Atualize a Evolution (≥2.4.0) ou use Cloud API.",
    };
  }

  return confirmEvolutionOutboundDelivery({ instance, raw: result.raw });
}

/** Envia lista interativa (menu) pela Evolution. */
export async function evolutionSendList(input: {
  phone: string;
  title: string;
  description?: string;
  buttonText?: string;
  footer?: string;
  sections: Array<{
    title: string;
    rows: Array<{ rowId: string; title: string; description?: string }>;
  }>;
  instanceName?: string;
}): Promise<{ ok: boolean; raw?: unknown; error?: string }> {
  if (!isEvolutionConfigured()) {
    return { ok: false, error: "Evolution API não configurada (EVOLUTION_API_URL / KEY / INSTANCE)." };
  }

  const { instance: defaultInstance } = evolutionEnv();
  const instance = String(input.instanceName || defaultInstance).trim() || defaultInstance;
  assertSomaOwnedInstance(instance);
  const number = String(input.phone || "").replace(/\D+/g, "");
  const title = String(input.title || "").trim();
  const sections = input.sections || [];
  if (!number || !title || sections.length === 0) {
    return { ok: false, error: "Destino, título ou seções inválidos para lista Evolution." };
  }

  const body = {
    number,
    title,
    description: String(input.description || "").trim() || undefined,
    buttonText: String(input.buttonText || "Ver opções").trim() || "Ver opções",
    footer: String(input.footer || "").trim() || undefined,
    sections,
  };

  const result = await evolutionFetch(`/message/sendList/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (result.ok) return confirmEvolutionOutboundDelivery({ instance, raw: result.raw });
  return { ok: false, raw: result.raw, error: result.error || "Falha ao enviar lista na Evolution." };
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
    if (result.ok) {
      return confirmEvolutionOutboundDelivery({ instance, raw: result.raw });
    }
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

/** Remove permanentemente uma instância soma-* no Evolution. */
export async function evolutionDeleteInstance(instanceName: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  let instance: string;
  try {
    instance = resolveTargetInstance(instanceName);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Instância inválida" };
  }
  if (!isEvolutionConfigured()) {
    return { ok: false, error: "Evolution API não configurada (EVOLUTION_API_URL / KEY)." };
  }
  const result = await evolutionFetch(`/instance/delete/${encodeURIComponent(instance)}`, {
    method: "DELETE",
  });
  if (result.ok || result.status === 404) {
    return { ok: true };
  }
  if (/does not exist|not found|não exist/i.test(result.error || "")) {
    return { ok: true };
  }
  return { ok: false, error: result.error ?? `Falha ao excluir instância ${instance}` };
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
  const got = extractEvolutionInstanceName(payload)?.toLowerCase();
  // Sem nome no payload: rejeita (evita processar eventos globais de outras apps)
  if (!got) return false;
  try {
    assertSomaOwnedInstance(got);
    return true;
  } catch {
    return false;
  }
}
