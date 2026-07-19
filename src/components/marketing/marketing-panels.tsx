import { Phone, Filter, Zap } from "lucide-react";

export function MarketingWhatsAppNumbersPanel() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="mb-2 flex items-center gap-2 text-primary">
        <Phone className="size-4" />
        <h3 className="font-display text-lg font-semibold tracking-tight">Números WhatsApp</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Cadastro e gestão dos números usados em disparos e integração WhatsApp.
      </p>
    </div>
  );
}

export function MarketingFunnelPanel() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="mb-2 flex items-center gap-2 text-primary">
        <Filter className="size-4" />
        <h3 className="font-display text-lg font-semibold tracking-tight">Funil</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Configuração do funil de marketing e etapas de conversão.
      </p>
    </div>
  );
}

export function MarketingApiAlternativaPanel() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="mb-2 flex items-center gap-2 text-primary">
        <Zap className="size-4" />
        <h3 className="font-display text-lg font-semibold tracking-tight">API Alternativa</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Parâmetros e operação da API Alternativa para envio de mensagens.
      </p>
    </div>
  );
}
