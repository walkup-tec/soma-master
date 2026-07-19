import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * WhatsApp em contorno, estilo Lucide (stroke 2, round).
 * Evita stroke em glyph de marca preenchido — isso borrava em 16px.
 */
export function WhatsAppOutlineIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      aria-hidden
      {...props}
    >
      {/* Balão (MessageCircle) */}
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      {/* Fone geométrico limpo */}
      <path d="M9.55 8.7c.4-1.05 1.15-1.4 1.95-1.4.5 0 .85.25 1.05.8l.35 1.05c.1.3 0 .55-.25.8l-.55.45c.6 1.05 1.5 1.95 2.55 2.55l.45-.55c.25-.25.5-.35.8-.25l1.05.35c.55.2.8.55.8 1.05 0 .8-.4 1.55-1.4 1.95-1.2.45-2.75.1-4.3-1.45-1.55-1.55-1.9-3.1-1.45-4.3Z" />
    </svg>
  );
}
