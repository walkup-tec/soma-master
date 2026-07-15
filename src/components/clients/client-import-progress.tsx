import { CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Progress } from "@/components/ui/progress";



export type ImportProgressState = {

  phase: "uploading" | "parsing" | "importing" | "done";

  label: string;

  current: number;

  total: number;

};



type Props = {

  progress: ImportProgressState;

  onCancel?: () => void;

  cancelling?: boolean;

};



export function ClientImportProgress({ progress, onCancel, cancelling }: Props) {

  const percent =

    progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;

  const isDone = progress.phase === "done";

  const canCancel = Boolean(onCancel) && !isDone;



  return (

    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/85 p-6 backdrop-blur-sm">

      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-lg">

        <div className="flex items-center gap-3">

          {isDone ? (

            <CheckCircle2 className="size-8 shrink-0 text-primary" />

          ) : progress.phase === "parsing" ? (

            <FileSpreadsheet className="size-8 shrink-0 animate-pulse text-primary" />

          ) : (

            <Loader2 className="size-8 shrink-0 animate-spin text-primary" />

          )}

          <div className="min-w-0">

            <p className="text-sm font-semibold">

              {progress.phase === "uploading"

                ? "Enviando planilha"

                : progress.phase === "parsing"

                  ? "Lendo planilha"

                  : progress.phase === "importing"

                    ? "Importando clientes"

                    : "Importação concluída"}

            </p>

            <p className="truncate text-xs text-muted-foreground">{progress.label}</p>

          </div>

        </div>



        <Progress

          value={isDone ? 100 : progress.phase === "parsing" && progress.current === 0 ? 35 : percent}

          className={progress.phase === "parsing" && progress.current === 0 ? "[&>div]:animate-pulse" : undefined}

        />



        <div className="flex items-center justify-between text-xs text-muted-foreground">

          <span>

            {progress.phase === "parsing" && progress.current === 0

              ? "Processando arquivo…"

              : `${progress.current.toLocaleString("pt-BR")} de ${progress.total.toLocaleString("pt-BR")}`}

          </span>

          <span>{isDone ? "100%" : progress.phase === "parsing" && progress.current === 0 ? "…" : `${percent}%`}</span>

        </div>



        {canCancel ? (

          <Button

            type="button"

            variant="outline"

            className="w-full"

            disabled={cancelling}

            onClick={onCancel}

          >

            {cancelling ? "Cancelando…" : "Cancelar importação"}

          </Button>

        ) : null}

      </div>

    </div>

  );

}

