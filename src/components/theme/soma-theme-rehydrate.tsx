import { useLayoutEffect } from "react";
import { applySomaTheme, readStoredSomaTheme } from "@/lib/theme/soma-theme";

/**
 * Reaplica o tema depois que o React hidrata o <html> (que limpa class="dark").
 * Sem isto, POST/reload (ex.: Atualizar status) volta sempre ao modo claro.
 */
export function SomaThemeRehydrate() {
  useLayoutEffect(() => {
    const sync = () => applySomaTheme(readStoredSomaTheme());
    sync();
    const t1 = window.setTimeout(sync, 0);
    const t2 = window.setTimeout(sync, 100);
    const t3 = window.setTimeout(sync, 300);
    window.addEventListener("pageshow", sync);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  return null;
}
