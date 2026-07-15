import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSystemSettingsFn, saveSystemSettingsFn } from "@/lib/config/settings.server";
import type { SettingsSaveSection } from "@/lib/config/settings.repository";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/config/settings-defaults";
import type { SystemSettings } from "@/lib/config/settings-types";

export function useSystemSettings() {
  const getSettings = useServerFn(getSystemSettingsFn);
  const saveSettings = useServerFn(saveSystemSettingsFn);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((data) => {
        if (active) setSettings(data);
      })
      .catch(() => {
        if (active) setSettings(DEFAULT_SYSTEM_SETTINGS);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [getSettings]);

  const persist = useCallback(
    async (next: SystemSettings, section: SettingsSaveSection = "all") => {
      const saved = await saveSettings({ data: { settings: next, section } });
      setSettings(saved);
      window.dispatchEvent(new CustomEvent("sinal-verde-settings-changed", { detail: saved }));
      return saved;
    },
    [saveSettings],
  );

  return { settings, setSettings: persist, loading };
}
