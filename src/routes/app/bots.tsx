import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { BotsPanel } from "@/components/bots/bots-panel";

export const Route = createFileRoute("/app/bots")({
  component: BotsPage,
});

function BotsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Bot className="size-5" />
          <span className="text-sm font-medium">Bots</span>
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Bots</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Construtor visual de fluxos híbridos: Chatbot, Inteligência Artificial e Sistema.
        </p>
      </div>

      <BotsPanel />
    </div>
  );
}
