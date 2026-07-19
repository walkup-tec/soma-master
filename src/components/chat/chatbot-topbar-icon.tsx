import { Button } from "@/components/ui/button";
import { WhatsAppOutlineIcon } from "@/components/chat/whatsapp-outline-icon";
import { useChatbotAlert } from "@/components/chat/chatbot-alert-context";
import { cn } from "@/lib/utils";

/**
 * Indicador visual (sem link): fica verde e pulsa o anel quando há
 * mensagem não lida no Chatbot WhatsApp.
 */
export function ChatbotTopbarIcon() {
  const { active, pendingCount } = useChatbotAlert();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative cursor-default"
      aria-label={
        active
          ? `${pendingCount} contato(s) aguardando no Chatbot WhatsApp`
          : "Chatbot WhatsApp — sem contatos novos"
      }
      title={
        active
          ? `${pendingCount} contato(s) aguardando no Chatbot`
          : "Chatbot WhatsApp"
      }
    >
      {active ? (
        <>
          <span
            className="pointer-events-none absolute inset-0 m-auto size-7 animate-ping rounded-full bg-emerald-500/35"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute inset-0 m-auto size-7 rounded-full ring-2 ring-emerald-500/60"
            aria-hidden
          />
        </>
      ) : null}
      <WhatsAppOutlineIcon
        className={cn(
          "relative size-[18px] transition-colors",
          active ? "text-emerald-500" : "text-foreground/90",
        )}
      />
    </Button>
  );
}
