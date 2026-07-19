import { cn } from "@/lib/utils";

/** Ícone WhatsApp só contorno (stroke), alinhado ao Bell do topbar. */
export function WhatsAppOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      aria-hidden
    >
      <path
        d="M12 2.5c-5.1 0-9.25 4.01-9.25 8.95 0 1.58.43 3.06 1.18 4.35L3 21.5l5.9-1.55A9.1 9.1 0 0 0 12 20.4c5.1 0 9.25-4.01 9.25-8.95S17.1 2.5 12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.85c.18-.4.37-.42.54-.43h.46c.15 0 .36-.06.56.43.2.49.68 1.66.74 1.78.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.11-.24.23-.1.45.14.22.62 1.02 1.33 1.65.91.81 1.68 1.06 1.92 1.18.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.14 1.14-.2.56-1.16 1.08-1.6 1.15-.44.07-.85.2-2.86-.6-2.42-.96-3.96-3.4-4.08-3.56-.12-.16-.96-1.28-.96-2.44 0-1.16.61-1.73.82-1.97Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}
