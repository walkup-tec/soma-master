export const SOMA_META_CLOUD_INSTANCE_PREFIX = "meta-";

export function isMetaCloudInstanceName(instanceName?: string | null): boolean {
  return String(instanceName || "")
    .trim()
    .toLowerCase()
    .startsWith(SOMA_META_CLOUD_INSTANCE_PREFIX);
}

export function metaCloudInstanceName(phoneNumberId: string): string {
  return `${SOMA_META_CLOUD_INSTANCE_PREFIX}${String(phoneNumberId || "").trim()}`;
}
