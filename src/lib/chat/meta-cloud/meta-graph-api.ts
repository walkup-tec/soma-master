import { createHmac } from "node:crypto";
import {
  readMetaAppSecret,
  readMetaGraphBase,
  readMetaGraphVersion,
} from "@/lib/chat/meta-cloud/meta-config";

export type MetaGraphJsonResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown> | null;
  body: string;
  graphCode: string | null;
  wamid: string | null;
};

function readGraphCode(json: unknown): string | null {
  const err = (json as { error?: { code?: unknown } } | null)?.error;
  if (err?.code === undefined || err.code === null) return null;
  return String(err.code);
}

function readWamid(json: unknown): string | null {
  const messages = (json as { messages?: Array<{ id?: string }> } | null)?.messages;
  const id = messages?.[0]?.id ? String(messages[0].id).trim() : "";
  return id || null;
}

function withProof(endpoint: string, token: string): string {
  const appSecret = readMetaAppSecret();
  if (!appSecret) return endpoint;
  const proof = createHmac("sha256", appSecret).update(token).digest("hex");
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}appsecret_proof=${proof}`;
}

export async function callMetaGraphJson(input: {
  token: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<MetaGraphJsonResult> {
  const token = String(input.token || "").trim();
  const path = String(input.path || "")
    .trim()
    .replace(/^\/+/, "");
  if (!token) throw new Error("Token da Meta não informado.");
  if (!path) throw new Error("Path da API da Meta não informado.");

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input.query || {})) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  const endpoint = `${readMetaGraphBase()}/${readMetaGraphVersion()}/${path}${qs ? `?${qs}` : ""}`;
  const url = withProof(endpoint, token);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs ?? 12_000);
  try {
    const response = await fetch(url, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(input.body ? { "Content-Type": "application/json" } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      json,
      body: text,
      graphCode: readGraphCode(json),
      wamid: readWamid(json),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function postMetaCloudMessage(input: {
  token: string;
  phoneNumberId: string;
  body: Record<string, unknown>;
}): Promise<MetaGraphJsonResult> {
  const phoneNumberId = String(input.phoneNumberId || "").trim();
  if (!phoneNumberId) throw new Error("phone_number_id ausente.");
  return callMetaGraphJson({
    token: input.token,
    method: "POST",
    path: `${phoneNumberId}/messages`,
    body: input.body,
  });
}

export function publicGraphError(result: MetaGraphJsonResult): string {
  const json = result.json;
  const err = json && typeof json === "object" ? (json.error as Record<string, unknown> | undefined) : undefined;
  const message = String(err?.error_user_msg || err?.message || result.body || "").trim();
  const code = result.graphCode;
  if (code === "131047") {
    return "Janela de 24h encerrada. O lead precisa enviar uma mensagem (ou use um template aprovado).";
  }
  if (code === "131026" || code === "130429") {
    return "Número destinatário inválido ou indisponível na Cloud API.";
  }
  if (result.status === 401 || code === "190") {
    return "Token da Meta expirado ou inválido. Reconecte o número oficial no ChatBot.";
  }
  return message.slice(0, 280) || `Falha na Graph (${result.status || 0}).`;
}
