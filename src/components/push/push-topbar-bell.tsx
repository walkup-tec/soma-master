import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dismissPushAlertFn, listPushAlertsFn } from "@/lib/push/push.server";
import type { SomaPushAlertView } from "@/lib/push/push.types";
import { cn } from "@/lib/utils";

export function PushTopbarBell() {
  const listAlerts = useServerFn(listPushAlertsFn);
  const dismissAlert = useServerFn(dismissPushAlertFn);
  const [alerts, setAlerts] = useState<SomaPushAlertView[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await listAlerts();
      setAlerts(next);
    } catch {
      /* sem sessão ou rede */
    }
  }, [listAlerts]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 45_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const handleDismiss = async (pushId: string) => {
    setDismissingId(pushId);
    try {
      await dismissAlert({ data: { pushId } });
      setAlerts((current) => current.filter((item) => item.id !== pushId));
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Comunicados"
          title="Comunicados"
        >
          <Bell className={cn("size-4", alerts.length > 0 && "text-primary")} />
          {alerts.length > 0 ? (
            <Badge
              variant="secondary"
              className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
            >
              {alerts.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold">Comunicados</p>
          <p className="text-xs text-muted-foreground">
            Alertas enviados pela gestão Soma Promotora.
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {alerts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum comunicado pendente.
            </p>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="border-b border-border/50 px-4 py-3 last:border-b-0">
                <p className="text-sm font-semibold">{alert.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                  {alert.message}
                </p>
                {alert.imageUrl ? (
                  <img
                    src={alert.imageUrl}
                    alt=""
                    className="mt-2 max-h-36 w-full rounded-lg object-cover"
                  />
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(alert.sentAt).toLocaleString("pt-BR")}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={dismissingId === alert.id}
                    onClick={() => void handleDismiss(alert.id)}
                  >
                    <Check className="size-3.5" />
                    Marcar como lido
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
