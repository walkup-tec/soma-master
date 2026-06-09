import { useCallback, useEffect, useState } from "react";
import { loadSystemSettings, saveSystemSettings } from "@/lib/config/settings-store";
import type { SystemSettings } from "@/lib/config/settings-types";

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(() => loadSystemSettings());

  useEffect(() => {
    const onChange = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail) setSettings(custom.detail);
      else setSettings(loadSystemSettings());
    };
    window.addEventListener("sinal-verde-settings-changed", onChange);
    return () => window.removeEventListener("sinal-verde-settings-changed", onChange);
  }, []);

  const persist = useCallback((next: SystemSettings) => {
    const saved = saveSystemSettings(next);
    setSettings(saved);
    return saved;
  }, []);

  return { settings, setSettings: persist };
}
