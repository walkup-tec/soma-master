import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BOT_MAP_FIELD_OPTIONS } from "@/lib/bots/bot.types";
import type {
  BotJson,
  BotMapFieldId,
  BotNodeData,
  BotNodeExecuteResult,
  BotNodeLogEntry,
} from "@/lib/bots/bot.types";
import { getBotNodeDefinition } from "@/lib/bots/bot-node.registry";
import { mapBotDataFn, testBotNodeFn } from "@/lib/bots/bots.server";
import type { AttendanceStatusConfig, ProductConfig } from "@/lib/config/settings-types";

export function BotNodeConfigPanel({
  data,
  onChange,
  products,
  attendanceStatuses,
  nodeId,
}: {
  data: BotNodeData;
  onChange: (next: BotNodeData) => void;
  products: ProductConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
  nodeId: string;
}) {
  const testNode = useServerFn(testBotNodeFn);
  const mapData = useServerFn(mapBotDataFn);
  const [busy, setBusy] = useState(false);
  const [mapFileBusy, setMapFileBusy] = useState(false);
  const definition = getBotNodeDefinition(data.kind);

  const patchConfig = (patch: Partial<BotNodeData["config"]>) => {
    onChange({ ...data, config: { ...data.config, ...patch } });
  };

  const selectedMapFields = useMemo(
    () => new Set(data.config.mapFields || []),
    [data.config.mapFields],
  );

  async function handleTest() {
    setBusy(true);
    try {
      const result = (await testNode({
        data: {
          node: {
            id: nodeId,
            type: "botStep",
            position: { x: 0, y: 0 },
            data,
          },
          variables: data.variables || {},
        },
      })) as BotNodeExecuteResult;
      const logEntry: BotNodeLogEntry = {
        at: new Date().toISOString(),
        level: result.ok ? "info" : "error",
        message: result.message,
        data: result.data,
      };
      onChange({
        ...data,
        status: result.status,
        lastTestAt: new Date().toISOString(),
        lastTestResult: result.message,
        logs: [...(data.logs || []), logEntry].slice(-40),
        variables: { ...data.variables, ...(result.variables || {}) },
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no teste do node");
    } finally {
      setBusy(false);
    }
  }

  async function handleMapFile(file: File | null) {
    if (!file) return;
    setMapFileBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      const mediaBase64 = btoa(binary);
      const result = await mapData({
        data: {
          mediaBase64,
          mimeType: file.type || "application/pdf",
          fields: (data.config.mapFields || []) as BotMapFieldId[],
          productId: data.config.productId,
        },
      });
      if (!result.ok) {
        toast.error(result.error || "Falha ao mapear dados");
        return;
      }
      const outKey = data.config.outputVariable || "dados_mapeados";
      const mapLog: BotNodeLogEntry = {
        at: new Date().toISOString(),
        level: "info",
        message: "Mapear dados OK",
        data: result.data as Record<string, BotJson> | undefined,
      };
      onChange({
        ...data,
        status: "success",
        variables: { ...data.variables, [outKey]: result.data },
        lastTestAt: new Date().toISOString(),
        lastTestResult: "Dados mapeados com sucesso",
        logs: [...(data.logs || []), mapLog].slice(-40),
      });
      toast.success("Dados extraídos do documento");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no Mapear dados");
    } finally {
      setMapFileBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {definition?.category || data.category}
        </p>
        <Input
          value={data.title}
          onChange={(event) => onChange({ ...data, title: event.target.value })}
          className="mt-1 h-8 border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
        />
        <p className="text-xs text-muted-foreground">{definition?.description}</p>
      </div>

      <Tabs defaultValue="config" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 grid w-auto grid-cols-4">
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="ports">I/O</TabsTrigger>
          <TabsTrigger value="vars">Vars</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <ScrollArea className="min-h-0 flex-1 px-4 py-3">
          <TabsContent value="config" className="mt-0 space-y-3">
            {(data.kind === "message" ||
              data.kind === "buttons" ||
              data.kind === "list" ||
              data.kind === "menu" ||
              data.kind === "confirm_data" ||
              data.kind === "prompt") && (
              <div className="space-y-1.5">
                <Label>{data.kind === "prompt" ? "Prompt" : "Texto"}</Label>
                <Textarea
                  value={
                    data.kind === "prompt" ? data.config.prompt || "" : data.config.text || ""
                  }
                  onChange={(event) =>
                    data.kind === "prompt"
                      ? patchConfig({ prompt: event.target.value })
                      : patchConfig({ text: event.target.value })
                  }
                  rows={4}
                />
              </div>
            )}

            {(data.kind === "delay" || data.kind === "wait_reply") && (
              <div className="space-y-1.5">
                <Label>{data.kind === "delay" ? "Delay (segundos)" : "Timeout (segundos)"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={
                    data.kind === "delay"
                      ? data.config.delaySeconds ?? 0
                      : data.config.timeoutSeconds ?? 300
                  }
                  onChange={(event) =>
                    data.kind === "delay"
                      ? patchConfig({ delaySeconds: Number(event.target.value) || 0 })
                      : patchConfig({ timeoutSeconds: Number(event.target.value) || 0 })
                  }
                />
              </div>
            )}

            {(data.kind === "condition" || data.kind === "switch") && (
              <div className="space-y-1.5">
                <Label>Expressão</Label>
                <Input
                  value={data.config.expression || ""}
                  onChange={(event) => patchConfig({ expression: event.target.value })}
                  placeholder="{{ultima_resposta}} contém sim"
                />
              </div>
            )}

            {(data.kind === "image" ||
              data.kind === "pdf" ||
              data.kind === "audio" ||
              data.kind === "video") && (
              <>
                <div className="space-y-1.5">
                  <Label>URL da mídia</Label>
                  <Input
                    value={data.config.mediaUrl || ""}
                    onChange={(event) => patchConfig({ mediaUrl: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Legenda</Label>
                  <Input
                    value={data.config.mediaCaption || ""}
                    onChange={(event) => patchConfig({ mediaCaption: event.target.value })}
                  />
                </div>
              </>
            )}

            {(data.kind === "buttons" || data.kind === "list" || data.kind === "menu") && (
              <div className="space-y-1.5">
                <Label>Opções (uma por linha: rótulo|valor)</Label>
                <Textarea
                  rows={4}
                  value={(data.config.options || [])
                    .map((opt) => `${opt.label}|${opt.value || opt.id}`)
                    .join("\n")}
                  onChange={(event) => {
                    const options = event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, index) => {
                        const [label, value] = line.split("|").map((part) => part.trim());
                        const id = `opt-${index + 1}`;
                        return { id, label: label || id, value: value || label || id };
                      });
                    patchConfig({ options });
                  }}
                />
              </div>
            )}

            {data.kind === "map_data" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Produto (campos de referência)</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={data.config.productId || ""}
                    onChange={(event) => patchConfig({ productId: event.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Campos a extrair</Label>
                  <div className="space-y-2 rounded-lg border border-border/60 p-2">
                    {BOT_MAP_FIELD_OPTIONS.map((field) => {
                      const checked = selectedMapFields.has(field.id);
                      return (
                        <label key={field.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const next = new Set(selectedMapFields);
                              if (value === true) next.add(field.id);
                              else next.delete(field.id);
                              patchConfig({ mapFields: Array.from(next) });
                            }}
                          />
                          {field.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Testar OCR + LLM (PDF/imagem)</Label>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={mapFileBusy}
                    onChange={(event) => void handleMapFile(event.target.files?.[0] || null)}
                  />
                </div>
              </div>
            )}

            {data.kind === "add_tags" && (
              <div className="space-y-1.5">
                <Label>Tags (vírgula)</Label>
                <Input
                  value={(data.config.tags || []).join(", ")}
                  onChange={(event) =>
                    patchConfig({
                      tags: event.target.value
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            )}

            {data.kind === "add_status" && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={data.config.statusId || ""}
                  onChange={(event) => patchConfig({ statusId: event.target.value })}
                >
                  <option value="">Selecione…</option>
                  {attendanceStatuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Variável de saída</Label>
              <Input
                value={data.config.outputVariable || ""}
                onChange={(event) => patchConfig({ outputVariable: event.target.value })}
                placeholder="ex.: dados_mapeados"
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">
              Status: <span className="font-medium text-foreground">{data.status}</span>
              {data.lastTestResult ? ` · ${data.lastTestResult}` : ""}
            </div>
          </TabsContent>

          <TabsContent value="ports" className="mt-0 space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Entradas</p>
              <ul className="space-y-1 text-sm">
                {(definition?.inputs || []).map((port) => (
                  <li key={port.id} className="rounded-md border border-border/60 px-2 py-1">
                    {port.label} <span className="text-muted-foreground">({port.id})</span>
                  </li>
                ))}
                {(definition?.inputs || []).length === 0 ? (
                  <li className="text-muted-foreground">Nenhuma</li>
                ) : null}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Saídas</p>
              <ul className="space-y-1 text-sm">
                {(definition?.outputs || []).map((port) => (
                  <li key={port.id} className="rounded-md border border-border/60 px-2 py-1">
                    {port.label} <span className="text-muted-foreground">({port.id})</span>
                  </li>
                ))}
                {(definition?.outputs || []).length === 0 ? (
                  <li className="text-muted-foreground">Nenhuma</li>
                ) : null}
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="vars" className="mt-0">
            <pre className="overflow-auto rounded-lg border border-border/60 bg-muted/20 p-2 text-xs">
              {JSON.stringify(data.variables || {}, null, 2)}
            </pre>
          </TabsContent>

          <TabsContent value="logs" className="mt-0 space-y-2">
            {(data.logs || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem logs ainda.</p>
            ) : (
              (data.logs || [])
                .slice()
                .reverse()
                .map((entry, index) => (
                  <div key={`${entry.at}-${index}`} className="rounded-md border border-border/60 p-2 text-xs">
                    <p className="font-medium text-foreground">
                      [{entry.level}] {entry.message}
                    </p>
                    <p className="text-muted-foreground">{new Date(entry.at).toLocaleString("pt-BR")}</p>
                  </div>
                ))
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="border-t border-border p-3">
        <Button
          type="button"
          className="w-full cursor-pointer gap-1.5"
          disabled={busy || mapFileBusy}
          onClick={() => void handleTest()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
          Teste individual
        </Button>
      </div>
    </div>
  );
}
