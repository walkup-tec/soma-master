import { useEffect, useMemo, useState } from "react";
import logoClaroFallback from "@/assets/brand/logo-claro.svg";
import logoEscuroFallback from "@/assets/brand/logo-escuro.svg";
import { cn } from "@/lib/utils";
import { readStoredSomaTheme, type SomaThemeMode } from "@/lib/theme/soma-theme";

type LogoSize = "default" | "lg" | "xl" | "lg-login" | "xl-login";

/**
 * - brand → sempre logo colorida (logo-claro) — menu lateral
 * - on-light → logo colorida (fundos claros)
 * - on-dark → logo clara/branca (fundos escuros)
 * - auto → acompanha tema claro/escuro
 */
type LogoSurface = "auto" | "brand" | "on-light" | "on-dark";

const sizeClass: Record<LogoSize, string> = {
  default: "h-14 w-auto max-w-[min(100%,320px)]",
  lg: "h-16 w-auto max-w-[min(100%,380px)]",
  xl: "h-24 w-auto max-w-[min(100%,480px)]",
  "lg-login": "h-[3.2rem] w-auto max-w-[min(100%,304px)]",
  "xl-login": "h-[4.8rem] w-auto max-w-[min(100%,384px)]",
};

/**
 * Oficiais em public/brand (PNG) têm prioridade.
 * Fonte canônica: D:\SOMA Promotora\Sistema SOMA\logo-claro.png | Logo-escuro.png
 */
const PUBLIC_CANDIDATES = {
  light: ["/brand/logo-claro.png?v=5", "/brand/logo-claro.webp", "/brand/logo-claro.svg"],
  dark: ["/brand/logo-escuro.png?v=5", "/brand/logo-escuro.webp", "/brand/logo-escuro.svg"],
} as const;

function useThemeMode(): SomaThemeMode {
  const [mode, setMode] = useState<SomaThemeMode>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : readStoredSomaTheme(),
  );

  useEffect(() => {
    const sync = () => {
      setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}

function resolveSurface(surface: LogoSurface, theme: SomaThemeMode): "light" | "dark" {
  // brand e on-light = sempre colorida (logo-claro)
  if (surface === "brand" || surface === "on-light") return "light";
  if (surface === "on-dark") return "dark";
  return theme === "dark" ? "dark" : "light";
}

export function Logo({
  className,
  compact = false,
  size = "default",
  surface = "auto",
}: {
  className?: string;
  compact?: boolean;
  size?: LogoSize;
  surface?: LogoSurface;
}) {
  const theme = useThemeMode();
  const tone = resolveSurface(surface, theme);
  const candidates = useMemo(() => {
    const list = tone === "dark" ? PUBLIC_CANDIDATES.dark : PUBLIC_CANDIDATES.light;
    const fallback = tone === "dark" ? logoEscuroFallback : logoClaroFallback;
    return [...list, fallback];
  }, [tone]);

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [tone]);

  const src = candidates[Math.min(index, candidates.length - 1)];

  if (failed) {
    return (
      <div className={cn("flex items-center gap-2 font-display font-extrabold tracking-tight", className)}>
        <span
          className={cn(
            "grid place-items-center rounded-lg bg-highlight text-brand-magenta",
            compact ? "size-9 text-sm" : "size-11 text-lg",
          )}
          aria-hidden
        >
          S
        </span>
        <span className={cn(compact ? "text-base" : "text-2xl", tone === "dark" ? "text-white" : "text-foreground")}>
          Soma
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <img
        key={`${tone}-${index}-${String(src).slice(0, 64)}`}
        src={src}
        alt="Soma Promotora"
        width={compact ? 36 : 300}
        height={compact ? 36 : 110}
        className={cn(
          "object-contain object-left",
          compact ? "h-9 w-9 max-w-9 overflow-hidden rounded-md" : sizeClass[size],
        )}
        draggable={false}
        onError={() => {
          setIndex((current) => {
            const next = current + 1;
            if (next >= candidates.length) {
              setFailed(true);
              return current;
            }
            return next;
          });
        }}
      />
    </div>
  );
}
