import { DEFAULT_SYSTEM_SETTINGS, normalizeSettings } from "@/lib/config/settings-defaults";
import type { SystemSettings } from "@/lib/config/settings-types";

const STORAGE_KEY = "sinal-verde-system-settings";

export function loadSystemSettings(): SystemSettings {
  if (typeof window === "undefined") return DEFAULT_SYSTEM_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SYSTEM_SETTINGS;
    return normalizeSettings({ ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(raw) } as SystemSettings);
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

export function saveSystemSettings(settings: SystemSettings): SystemSettings {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("sinal-verde-settings-changed", { detail: normalized }));
  return normalized;
}
