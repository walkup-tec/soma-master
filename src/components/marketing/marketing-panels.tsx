import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Filter, Flame, Phone, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listWabaAquecedorInstancesFn } from "@/lib/waba/waba-aquecedor.server";
import {
  wabaAvatarProxyUrl,
  type WabaAquecedorInstance,
} from "@/lib/waba/waba-aquecedor.adapter";
import { cn } from "@/lib/utils";

const REFRESH_MS = 45_000;

function formatCount(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR");
}

function WarmthFlames({ level, label }: { level: number; label: string }) {
  const lit = Math.max(0, Math.min(3, Math.floor(level)));
  return (
    <div className="flex items-center gap-0.5" title={label}>
      {[1, 2, 3].map((step) => (
        <Flame
          key={step}
          className={cn(
            "size-4",
            step <= lit
              ? "fill-orange-500 text-orange-500"
              : "fill-transparent text-muted-foreground/35",
          )}
          aria-hidden
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

function InstanceAvatar({ item }: { item: WabaAquecedorInstance }) {
  const src = wabaAvatarProxyUrl(item.profilePicUrl);
  const initial = (item.whatsappName || item.instanceName || "?").slice(0, 1).toUpperCase();
  if (!src) {
    return (
      <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {initial}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="size-9 rounded-full object-cover ring-1 ring-border/60"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export function MarketingWhatsAppNumbersPanel() {
  const listInstances = useServerFn(listWabaAquecedorInstancesFn);
  const [items, setItems] = useState<WabaAquecedorInstance[]>([]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listInstances();
      if (!result.ok) {
        setError(result.error || "Não foi possível carregar as instâncias.");
        setItems([]);
        return;
      }
      setError(null);
      setOwnerEmail(result.ownerEmail || "");
      setItems(result.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar Números WhatsApp.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [listInstances]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="font-display text-base">Números WhatsApp</CardTitle>
          <CardDescription>
            Instâncias do aquecedor WABA
            {ownerEmail ? (
              <>
                {" "}
                · conta <span className="text-foreground">{ownerEmail}</span>
              </>
            ) : null}
            . Novas instâncias da conta aparecem automaticamente neste painel.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            void refresh().then(() => toast.success("Lista atualizada."));
          }}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Quente</TableHead>
                  <TableHead className="w-14" />
                  <TableHead>Número</TableHead>
                  <TableHead>Nome (WhatsApp)</TableHead>
                  <TableHead>Nome da Instância</TableHead>
                  <TableHead className="text-right">Contatos</TableHead>
                  <TableHead className="text-right">Mensagens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      Carregando instâncias do aquecedor…
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      Nenhuma instância do aquecedor encontrada para esta conta.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.instanceName}>
                      <TableCell>
                        <WarmthFlames level={item.warmthLevel} label={item.warmthLabel} />
                      </TableCell>
                      <TableCell>
                        <InstanceAvatar item={item} />
                      </TableCell>
                      <TableCell className="font-mono text-sm tabular-nums">
                        {item.number || "—"}
                      </TableCell>
                      <TableCell className="font-medium">{item.whatsappName || "—"}</TableCell>
                      <TableCell>{item.instanceAlias || item.instanceName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(item.contacts)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(item.messages)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
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
