import logoSrc from "@/assets/logo-sinal-verde.png";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={logoSrc}
        alt="Sinal Verde — Sinal aberto para você o tempo inteiro"
        className={cn(
          "object-contain object-left",
          compact ? "h-9 w-9 max-w-9 overflow-hidden rounded-lg" : "h-12 w-auto max-w-[240px]",
        )}
        draggable={false}
      />
    </div>
  );
}
