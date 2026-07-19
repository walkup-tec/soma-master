import { useState } from "react";
import {
  Clock,
  Mail,
  Megaphone,
  Pause,
  Play,
  Split,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FunnelAudienceModal } from "@/components/marketing/funnel/funnel-audience-modal";
import { FunnelDisparoModal } from "@/components/marketing/funnel/funnel-disparo-modal";
import {
  FUNNEL_FEEDBACK_HANDLES,
  defaultAudienceConfig,
  defaultDisparoConfig,
  defaultEmailMktConfig,
  defaultPauseConfig,
  defaultStartConfig,
  formatPauseLabel,
  type FunnelPauseUnit,
  type FunnelStepData,
} from "@/lib/marketing/funnel.types";
import type { AttendanceStatusConfig, ProductConfig } from "@/lib/config/settings-types";

const EMAIL_VARS = ["{{nome}}", "{{telefone}}", "{{email}}"] as const;

export function FunnelStepEditor({
  data,
  onChange,
  onDelete,
  canDelete,
  products,
  attendanceStatuses,
  upstreamAudienceCount = null,
}: {
  data: FunnelStepData;
  onChange: (next: FunnelStepData) => void;
  onDelete: () => void;
  canDelete: boolean;
  products: ProductConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
  /** Contagem do Público a montante — usada no modal de Disparo */
  upstreamAudienceCount?: number | null;
}) {
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [disparoOpen, setDisparoOpen] = useState(false);
  const [emailFocus, setEmailFocus] = useState<"subject" | "body">("body");

  function insertVar(variable: string) {
    const email = data.emailMkt ?? defaultEmailMktConfig();
    if (emailFocus === "subject") {
      onChange({
        ...data,
        emailMkt: { ...email, subject: `${email.subject}${variable}` },
      });
      return;
    }
    onChange({
      ...data,
      emailMkt: { ...email, body: `${email.body}${variable}` },
    });
  }

  return (
    <div className="space-y-3 p-3">
      <div>
        <Label className="text-[11px]">Título no canvas</Label>
        <Input
          className="mt-1 h-9"
          value={data.label}
          onChange={(event) => onChange({ ...data, label: event.target.value })}
          disabled={data.kind === "start"}
        />
      </div>

      {data.kind === "start" ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Play className="size-4 text-emerald-600" />
            Quando iniciar
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={(data.start ?? defaultStartConfig()).mode === "immediate" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                onChange({
                  ...data,
                  start: {
                    ...(data.start ?? defaultStartConfig()),
                    mode: "immediate",
                    scheduledAt: null,
                  },
                  description: "Início imediato",
                })
              }
            >
              Imediato
            </Button>
            <Button
              type="button"
              size="sm"
              variant={(data.start ?? defaultStartConfig()).mode === "scheduled" ? "default" : "outline"}
              className="cursor-pointer gap-1"
              onClick={() =>
                onChange({
                  ...data,
                  start: {
                    ...(data.start ?? defaultStartConfig()),
                    mode: "scheduled",
                    scheduledAt:
                      data.start?.scheduledAt ||
                      new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
                  },
                  description: "Agendado",
                })
              }
            >
              <Clock className="size-3.5" />
              Agendado
            </Button>
          </div>
          {(data.start ?? defaultStartConfig()).mode === "scheduled" ? (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Data e hora</Label>
              <Input
                type="datetime-local"
                className="h-9"
                value={(data.start?.scheduledAt || "").slice(0, 16)}
                onChange={(event) =>
                  onChange({
                    ...data,
                    start: {
                      ...(data.start ?? defaultStartConfig()),
                      mode: "scheduled",
                      scheduledAt: event.target.value
                        ? new Date(event.target.value).toISOString()
                        : null,
                    },
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                O badge <strong>Agendado</strong> aparece no canvas até o funil iniciar de fato.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {data.kind === "pause" ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Pause className="size-4 text-amber-600" />
            Duração da pausa
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              className="h-9 w-24"
              value={(data.pause ?? defaultPauseConfig()).amount}
              onChange={(event) => {
                const amount = Math.max(1, Number(event.target.value) || 1);
                const pause = { ...(data.pause ?? defaultPauseConfig()), amount };
                onChange({
                  ...data,
                  pause,
                  description: formatPauseLabel(pause),
                });
              }}
            />
            <div className="flex flex-1 flex-wrap gap-1">
              {(
                [
                  ["minutes", "Min"],
                  ["hours", "Horas"],
                  ["days", "Dias"],
                  ["months", "Meses"],
                ] as const
              ).map(([unit, label]) => (
                <Button
                  key={unit}
                  type="button"
                  size="sm"
                  variant={(data.pause ?? defaultPauseConfig()).unit === unit ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    const pause = {
                      ...(data.pause ?? defaultPauseConfig()),
                      unit: unit as FunnelPauseUnit,
                    };
                    onChange({
                      ...data,
                      pause,
                      description: formatPauseLabel(pause),
                    });
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {data.kind === "audience" ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4 text-sky-600" />
            Público
          </div>
          <p className="text-xs text-muted-foreground">
            {(data.audience ?? defaultAudienceConfig()).audienceCount != null
              ? `${(data.audience ?? defaultAudienceConfig()).audienceCount!.toLocaleString("pt-BR")} contatos`
              : "Nenhum público definido ainda"}
            {(data.audience?.tags.length ?? 0) > 0
              ? ` · ${data.audience!.tags.length} tag(s)`
              : ""}
          </p>
          <Button
            type="button"
            className="w-full cursor-pointer"
            onClick={() => setAudienceOpen(true)}
          >
            Configurar público
          </Button>
          <FunnelAudienceModal
            open={audienceOpen}
            onOpenChange={setAudienceOpen}
            value={data.audience ?? defaultAudienceConfig()}
            products={products}
            attendanceStatuses={attendanceStatuses}
            onSave={(audience) =>
              onChange({
                ...data,
                audience,
                description:
                  audience.audienceCount != null
                    ? `${audience.audienceCount.toLocaleString("pt-BR")} contatos`
                    : "Público definido",
              })
            }
          />
        </div>
      ) : null}

      {data.kind === "disparo" ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Megaphone className="size-4 text-orange-600" />
            Disparo WABA
          </div>
          <p className="text-xs text-muted-foreground">
            {(data.disparo ?? defaultDisparoConfig()).campaignName || "Campanha não configurada"}
            {(data.disparo?.wabaCampaignId
              ? ` · ID ${data.disparo.wabaCampaignId.slice(0, 10)}…`
              : "")}
          </p>
          <Button
            type="button"
            className="w-full cursor-pointer"
            onClick={() => setDisparoOpen(true)}
          >
            Abrir configuração de disparo
          </Button>
          <FunnelDisparoModal
            open={disparoOpen}
            onOpenChange={setDisparoOpen}
            value={data.disparo ?? defaultDisparoConfig()}
            audienceCount={upstreamAudienceCount}
            onSave={(disparo) =>
              onChange({
                ...data,
                disparo,
                description: disparo.campaignName || "Disparo",
              })
            }
          />
        </div>
      ) : null}

      {data.kind === "feedback" ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Split className="size-4 text-violet-600" />
            Saídas do feedback
          </div>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {FUNNEL_FEEDBACK_HANDLES.map((branch) => (
              <li key={branch.id}>
                <span className="font-medium text-foreground">{branch.label}</span>
                <span className="block">{branch.hint}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Conecte cada bolinha da direita a uma etapa seguinte (ex.: pausa, e-mail ou fim).
          </p>
        </div>
      ) : null}

      {data.kind === "email_mkt" ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="size-4 text-indigo-600" />
            E-mail marketing
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Assunto</Label>
            <Input
              className="h-9"
              value={(data.emailMkt ?? defaultEmailMktConfig()).subject}
              onFocus={() => setEmailFocus("subject")}
              onChange={(event) =>
                onChange({
                  ...data,
                  emailMkt: {
                    ...(data.emailMkt ?? defaultEmailMktConfig()),
                    subject: event.target.value,
                  },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Corpo</Label>
            <Textarea
              className="min-h-[140px]"
              value={(data.emailMkt ?? defaultEmailMktConfig()).body}
              onFocus={() => setEmailFocus("body")}
              onChange={(event) =>
                onChange({
                  ...data,
                  emailMkt: {
                    ...(data.emailMkt ?? defaultEmailMktConfig()),
                    body: event.target.value,
                  },
                })
              }
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="w-full text-[11px] text-muted-foreground">
              Inserir variável no {emailFocus === "subject" ? "assunto" : "corpo"}:
            </span>
            {EMAIL_VARS.map((variable) => (
              <Button
                key={variable}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer font-mono text-[11px]"
                onClick={() => insertVar(variable)}
              >
                {variable}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {data.kind === "end" ? (
        <p className="text-xs text-muted-foreground">
          Esta etapa encerra o funil para os contatos que chegarem aqui — nenhuma ação adicional.
        </p>
      ) : null}

      {canDelete ? (
        <Button
          type="button"
          variant="outline"
          className="w-full cursor-pointer gap-1.5 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
          Remover etapa
        </Button>
      ) : null}
    </div>
  );
}
