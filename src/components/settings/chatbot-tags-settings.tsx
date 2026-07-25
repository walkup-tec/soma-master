import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/clients/status-badge";
import { createEmptyChatTag } from "@/lib/config/settings-defaults";
import { DEFAULT_STATUS_COLOR, normalizeStatusColor } from "@/lib/config/status-colors";
import type { ChatTagConfig, SystemSettings } from "@/lib/config/settings-types";
import { listStoredBotFlows } from "@/lib/bots/bot-flow.storage";

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => void | Promise<unknown>;
};

export function ChatbotTagsSettings({ settings, onChange }: Props) {
  const [tags, setTags] = useState<ChatTagConfig[]>(settings.chatTags ?? []);
  const bots = useMemo(() => listStoredBotFlows(), [settings.chatTags]);

  useEffect(() => {
    setTags(settings.chatTags ?? []);
  }, [settings.chatTags]);

  const updateTag = (id: string, patch: Partial<ChatTagConfig>) => {
    setTags((prev) => prev.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };

  const addTag = () => setTags((prev) => [...prev, createEmptyChatTag()]);
  const removeTag = (id: string) => setTags((prev) => prev.filter((tag) => tag.id !== id));

  const saveTags = () => {
    const filled = tags
      .filter((tag) => tag.label.trim())
      .map((tag) => ({
        ...tag,
        label: tag.label.trim(),
        color: normalizeStatusColor(tag.color, DEFAULT_STATUS_COLOR),
        transferBotId: tag.transferBotId?.trim() || null,
      }));
    void onChange({ ...settings, chatTags: filled });
    toast.success("Tags salvas.");
  };

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-base">Tags</CardTitle>
        <CardDescription>
          Crie tags para classificar o atendimento. Em{" "}
          <span className="font-medium text-foreground">Transferir Bot</span>, escolha um fluxo: ao
          aplicar a tag no cliente, ele entra nesse bot automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Os bots listados vêm de <span className="font-medium text-foreground">Bots</span> neste
          navegador. Sem bot selecionado, a tag apenas marca o cliente.
        </div>

        <div className="space-y-3">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma tag ainda. Clique em &quot;Adicionar tag&quot;.
            </p>
          ) : (
            tags.map((tag, index) => (
              <div
                key={tag.id}
                className="flex flex-col gap-3 rounded-lg border border-border/50 p-3 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <div className="w-full max-w-[13.5rem] space-y-2 sm:w-[13.5rem]">
                  <Label htmlFor={`tag-${tag.id}`}>Tag {index + 1}</Label>
                  <Input
                    id={`tag-${tag.id}`}
                    value={tag.label}
                    onChange={(event) => updateTag(tag.id, { label: event.target.value })}
                    placeholder="Nome da tag"
                  />
                </div>

                <input
                  type="color"
                  value={normalizeStatusColor(tag.color)}
                  onChange={(event) => updateTag(tag.id, { color: event.target.value })}
                  className="mb-0.5 h-9 w-9 shrink-0 cursor-pointer appearance-none border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
                  aria-label={`Cor da tag ${tag.label || index + 1}`}
                  title="Cor"
                />

                <div className="min-w-[14rem] flex-1 space-y-2">
                  <Label htmlFor={`tag-bot-${tag.id}`}>Transferir Bot</Label>
                  <select
                    id={`tag-bot-${tag.id}`}
                    className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
                    value={tag.transferBotId || ""}
                    onChange={(event) =>
                      updateTag(tag.id, {
                        transferBotId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">Sem transferir</option>
                    {bots.map((bot) => (
                      <option key={bot.id} value={bot.id}>
                        {bot.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 sm:mb-0.5">
                  <StatusBadge label={tag.label.trim() || "Prévia"} color={tag.color} />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => removeTag(tag.id)}
                    aria-label="Remover tag"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={addTag}>
            <Plus className="size-4" /> Adicionar tag
          </Button>
          <Button type="button" className="cursor-pointer" onClick={saveTags}>
            Salvar tags
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
