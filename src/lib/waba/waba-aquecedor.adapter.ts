export type WabaAquecedorInstance = {
  instanceName: string;
  number: string;
  whatsappName: string;
  instanceAlias: string;
  contacts: number;
  messages: number;
  profilePicUrl: string;
  avatarVersion: string;
  connectionStatus: string;
  warmthLevel: number;
  warmthLabel: string;
};

export type WabaAquecedorInstancesResponse = {
  ok: boolean;
  ownerEmail: string;
  total: number;
  cacheUpdatedAt: string;
  items: WabaAquecedorInstance[];
  error?: string;
};

function resolveWabaBaseUrl(): string {
  return String(process.env.WABA_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

function resolveIntegrationKey(): string {
  return String(process.env.SOMA_WABA_INTEGRATION_KEY || "").trim();
}

/** URL pública do proxy de avatar do WABA (não exige sessão). */
export function wabaAvatarProxyUrl(profilePicUrl: string): string | null {
  const base = resolveWabaBaseUrl();
  const pic = String(profilePicUrl || "").trim();
  if (!base || !pic) return null;
  return `${base}/instancias/avatar?url=${encodeURIComponent(pic)}`;
}

function isConnectedInstance(item: WabaAquecedorInstance): boolean {
  const status = String(item.connectionStatus || "").trim().toLowerCase();
  return status === "open" || status.includes("open") || status === "connected";
}

/**
 * Lista instâncias do aquecedor WABA do owner configurado no servidor WABA
 * (padrão mozart.pmo@gmail.com).
 */
export async function fetchWabaAquecedorInstances(): Promise<WabaAquecedorInstancesResponse> {
  const base = resolveWabaBaseUrl();
  const key = resolveIntegrationKey();
  if (!base) {
    return {
      ok: false,
      ownerEmail: "",
      total: 0,
      cacheUpdatedAt: "",
      items: [],
      error: "WABA_API_BASE_URL não configurada no Soma.",
    };
  }
  if (!key) {
    return {
      ok: false,
      ownerEmail: "",
      total: 0,
      cacheUpdatedAt: "",
      items: [],
      error: "SOMA_WABA_INTEGRATION_KEY não configurada no Soma.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${base}/integrations/soma/aquecedor-instances`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Soma-Waba-Key": key,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as WabaAquecedorInstancesResponse | null;
    if (!response.ok || !data?.ok) {
      return {
        ok: false,
        ownerEmail: data?.ownerEmail || "",
        total: 0,
        cacheUpdatedAt: "",
        items: [],
        error: data?.error || `WABA respondeu ${response.status}.`,
      };
    }
    const connected = (Array.isArray(data.items) ? data.items : []).filter(isConnectedInstance);
    return {
      ok: true,
      ownerEmail: data.ownerEmail || "",
      total: connected.length,
      cacheUpdatedAt: data.cacheUpdatedAt || "",
      items: connected,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Timeout ao consultar o WABA."
        : error instanceof Error
          ? error.message
          : "Falha de rede ao consultar o WABA.";
    return {
      ok: false,
      ownerEmail: "",
      total: 0,
      cacheUpdatedAt: "",
      items: [],
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
