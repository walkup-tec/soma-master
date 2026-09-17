/** Contrato do Facebook Login for Business / Embedded Signup (mesmo do Drax/WABA). */

export const META_ES_JS_SDK_GRAPH_VERSION = "v26.0";

export const META_ES_FINISH_EVENTS = [
  "FINISH",
  "FINISH_ONLY_WABA",
  "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
  "FINISH_GRANT_ONLY_API_ACCESS",
  "FINISH_OBO_MIGRATION",
] as const;

export type MetaEsFbLoginOptions = {
  config_id: string;
  response_type: "code";
  override_default_response_type: true;
  extras: { setup: Record<string, unknown> };
};

export function buildMetaEsFbLoginOptions(configId: string): MetaEsFbLoginOptions | null {
  const id = String(configId || "").trim();
  if (!id) return null;
  return {
    config_id: id,
    response_type: "code",
    override_default_response_type: true,
    extras: { setup: {} },
  };
}

export function isMetaEsFinishEvent(eventName: string): boolean {
  return (META_ES_FINISH_EVENTS as readonly string[]).includes(String(eventName || "").trim());
}
