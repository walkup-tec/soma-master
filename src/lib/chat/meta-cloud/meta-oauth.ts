import {
  readMetaAppId,
  readMetaAppSecret,
  readMetaGraphBase,
  readMetaGraphVersion,
} from "@/lib/chat/meta-cloud/meta-config";

export type MetaOauthExchangeResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number | null;
};

export async function exchangeEmbeddedSignupCode(input: {
  code: string;
}): Promise<MetaOauthExchangeResult> {
  const code = String(input.code || "").trim();
  const appId = readMetaAppId();
  const appSecret = readMetaAppSecret();
  if (!code) throw new Error("Campo 'code' é obrigatório.");
  if (!appId || !appSecret) {
    throw new Error("Servidor sem META_APP_ID / META_APP_SECRET.");
  }

  const url = new URL(`${readMetaGraphBase()}/${readMetaGraphVersion()}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url.toString(), { method: "GET", signal: controller.signal });
    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const detail = String(
        (json?.error as { message?: string } | undefined)?.message ||
          json?.error_description ||
          text ||
          "",
      ).slice(0, 200);
      throw new Error(detail || "Falha ao trocar código por token na Meta.");
    }
    const accessToken = String(json?.access_token || "").trim();
    if (!accessToken) throw new Error("Resposta da Meta sem access_token.");
    const expiresInRaw = Number(json?.expires_in);
    return {
      accessToken,
      tokenType: String(json?.token_type || "bearer"),
      expiresIn: Number.isFinite(expiresInRaw) && expiresInRaw > 0 ? expiresInRaw : null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
