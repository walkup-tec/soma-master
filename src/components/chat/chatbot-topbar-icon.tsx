import { Button } from "@/components/ui/button";
import { WhatsAppOutlineIcon } from "@/components/chat/whatsapp-outline-icon";
import { useChatbotAlert } from "@/components/chat/chatbot-alert-context";
import { cn } from "@/lib/utils";

/**
 * Indicador visual (sem link): pulsa em verde quando um novo contato
 * chama no Chatbot WhatsApp.
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
          ? `${pendingCount} contato(s) novo(s) no Chatbot WhatsApp`
          : "Chatbot WhatsApp — sem contatos novos"
      }
      title={
        active
          ? `${pendingCount} contato(s) novo(s) no Chatbot`
          : "Chatbot WhatsApp"
      }
    >
      {active ? (
        <span
          className="absolute inset-0 m-auto size-7 animate-ping rounded-full bg-emerald-500/25"
          aria-hidden
        />
      ) : null}
      <WhatsAppOutlineIcon
        className={cn(
          "relative size-4 transition-colors",
          active ? "animate-pulse text-emerald-500" : "text-foreground",
        )}
      />
    </Button>
  );
}
