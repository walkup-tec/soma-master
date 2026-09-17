/** Credenciais do mesmo Meta App já autorizado no Drax/WABA (Embedded Signup + Graph). */

const readEnv = (key: string): string => String(process.env[key] || "").trim();

export function readMetaConfigId(): string {
  return readEnv("META_CONFIG_ID") || readEnv("META_ES_CONFIG_ID");
}

export function readMetaAppId(): string {
  return readEnv("META_APP_ID");
}

export function readMetaAppSecret(): string {
  return readEnv("META_APP_SECRET");
}

export function readMetaGraphBase(): string {
  return (readEnv("META_GRAPH_BASE") || "https://graph.facebook.com").replace(/\/+$/, "");
}

export function readMetaGraphVersion(): string {
  return readEnv("META_GRAPH_VERSION") || "v22.0";
}

export function readMetaJsSdkGraphVersion(): string {
  return readEnv("META_ES_JS_SDK_GRAPH_VERSION") || "v26.0";
}

export function isMetaCloudConfigured(): boolean {
  return Boolean(readMetaAppId() && readMetaAppSecret() && readMetaConfigId());
}

export function toPublicMetaEsConfig(): {
  ok: boolean;
  appId?: string;
  configId?: string;
  graphVersion: string;
} {
  const appId = readMetaAppId();
  const configId = readMetaConfigId();
  return {
    ok: Boolean(appId && configId),
    appId: appId || undefined,
    configId: configId || undefined,
    graphVersion: readMetaJsSdkGraphVersion(),
  };
}
