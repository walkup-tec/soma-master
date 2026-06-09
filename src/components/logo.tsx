import logoHorizontal from "@/assets/logo-sinal-verde.png";
import logoStacked from "@/assets/logo-sinal-verde-stacked.png";
import { cn } from "@/lib/utils";

type LogoSize = "default" | "lg" | "xl" | "lg-login" | "xl-login";

const sizeClass: Record<LogoSize, string> = {
  default: "h-14 w-auto max-w-[min(100%,320px)]",
  lg: "h-16 w-auto max-w-[min(100%,380px)]",
  xl: "h-24 w-auto max-w-[min(100%,480px)]",
  "lg-login": "h-[3.2rem] w-auto max-w-[min(100%,304px)]",
  "xl-login": "h-[4.8rem] w-auto max-w-[min(100%,384px)]",
};

export function Logo({
  className,
  compact = false,
  variant = "horizontal",
  size = "default",
}: {
  className?: string;
  compact?: boolean;
  variant?: "horizontal" | "stacked";
  size?: LogoSize;
}) {
  const src = variant === "stacked" ? logoStacked : logoHorizontal;

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={src}
        alt="Sinal Verde — Sinal aberto para você o tempo inteiro"
        width={300}
        height={110}
        className={cn(
          "object-contain object-left",
          compact
            ? "h-9 w-9 max-w-9 overflow-hidden rounded-md"
            : variant === "stacked"
              ? "h-28 w-auto max-w-[200px]"
              : sizeClass[size],
        )}
        draggable={false}
      />
    </div>
  );
}
