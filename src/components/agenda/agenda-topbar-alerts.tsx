import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAgendaAlertsFn } from "@/lib/clients/agenda.server";
import type { AgendaAlertCounts } from "@/lib/clients/client.types";
import { cn } from "@/lib/utils";

const EMPTY_COUNTS: AgendaAlertCounts = { todayPending: 0, overduePending: 0 };

export function AgendaTopbarAlerts() {
  const getAlerts = useServerFn(getAgendaAlertsFn);
  const [counts, setCounts] = useState<AgendaAlertCounts>(EMPTY_COUNTS);

  const refresh = useCallback(async () => {
    try {
      const next = await getAlerts();
      setCounts(next);
    } catch {
      /* sem permissão ou rede */
    }
  }, [getAlerts]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const { todayPending, overduePending } = counts;

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Button
        asChild
        size="sm"
        variant="outline"
        className={cn(
          "h-9 gap-2 border-transparent bg-muted/50 shadow-none",
          todayPending > 0 &&
            "border-amber-500/40 bg-amber-500/10 text-amber-900 hover:bg-amber-500/15 dark:text-amber-100",
        )}
      >
        <Link to="/app/agenda" search={{ filter: "today", pending: "1" }}>
          {todayPending > 0 ? (
            <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span>Agenda do dia</span>
          {todayPending > 0 ? (
            <Badge
              variant="secondary"
              className="h-5 min-w-5 justify-center rounded-full bg-amber-600 px-1.5 text-[10px] font-semibold text-white"
            >
              {todayPending}
            </Badge>
          ) : null}
        </Link>
      </Button>

      <Button
        asChild
        size="sm"
        variant={overduePending > 0 ? "destructive" : "ghost"}
        className={cn(
          "h-9 gap-2",
          overduePending === 0 && "text-muted-foreground hover:text-foreground",
        )}
      >
        <Link to="/app/agenda" search={{ filter: "overdue" }}>
          <span>Agenda atrasada</span>
          {overduePending > 0 ? (
            <Badge
              variant="secondary"
              className="h-5 min-w-5 justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-semibold text-white"
            >
              {overduePending}
            </Badge>
          ) : null}
        </Link>
      </Button>
    </div>
  );
}
