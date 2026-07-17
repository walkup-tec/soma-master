import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, ImagePlus, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listPushHistoryFn,
  reviewPushMessageFn,
  sendPushMessageFn,
  uploadPushImageFn,
} from "@/lib/push/push.server";
import type {
  SomaPushAudience,
  SomaPushImageAttachment,
  SomaPushMessage,
  SomaPushUserRole,
} from "@/lib/push/push.types";
import { cn } from "@/lib/utils";

const AUDIENCE_OPTIONS: Array<{ id: SomaPushAudience; label: string; hint: string }> = [
  { id: "users", label: "Usuários", hint: "Sininho no sistema" },
  { id: "partners", label: "Parceiros", hint: "Sininho para parceiros ativos" },
  { id: "community", label: "Comunidade WhatsApp", hint: "Grupo de anúncios" },
  { id: "email", label: "E-mail", hint: "SMTP para os destinos marcados" },
];

const ROLE_OPTIONS: Array<{ id: SomaPushUserRole; label: string }> = [
  { id: "master", label: "Master" },
  { id: "user", label: "Usuário" },
];

function statusLabel(status: SomaPushMessage["status"]): string {
  switch (status) {
    case "sent":
      return "Enviado";
    case "partial":
      return "Parcial";
    case "failed":
      return "Falhou";
    case "sending":
      return "Enviando";
    default:
      return status;
  }
}

export function PushScreen() {
  const listHistory = useServerFn(listPushHistoryFn);
  const reviewMessage = useServerFn(reviewPushMessageFn);
  const uploadImage = useServerFn(uploadPushImageFn);
  const sendMessage = useServerFn(sendPushMessageFn);

  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [reviewedText, setReviewedText] = useState("");
  const [audiences, setAudiences] = useState<SomaPushAudience[]>(["users", "partners"]);
  const [userRoles, setUserRoles] = useState<SomaPushUserRole[]>(["master", "user"]);
  const [image, setImage] = useState<SomaPushImageAttachment | null>(null);
  const [history, setHistory] = useState<SomaPushMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listHistory();
      setHistory(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar o Push.");
    } finally {
      setLoading(false);
    }
  }, [listHistory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleAudience = (id: SomaPushAudience) => {
    setAudiences((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleRole = (id: SomaPushUserRole) => {
    setUserRoles((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const finalText = useMemo(
    () => reviewedText.trim() || originalText.trim(),
    [reviewedText, originalText],
  );

  const handleReview = async () => {
    if (!originalText.trim()) {
      toast.error("Informe o texto original para revisar.");
      return;
    }
    setReviewing(true);
    try {
      const result = await reviewMessage({ data: { title, text: originalText } });
      setReviewedText(result.reviewedText);
      toast.success("Texto revisado pela IA.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na revisão com IA.");
    } finally {
      setReviewing(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const base64 = btoa(binary);
      const uploaded = await uploadImage({
        data: {
          fileName: file.name,
          mimeType: file.type,
          base64,
        },
      });
      setImage(uploaded);
      if (!audiences.includes("community")) {
        setAudiences((current) => [...current, "community"]);
      }
      toast.success("Imagem pronta para a comunidade.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload da imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!audiences.length) {
      toast.error("Selecione ao menos um destino.");
      return;
    }
    setSending(true);
    try {
      const result = await sendMessage({
        data: {
          title,
          originalText,
          reviewedText: finalText,
          audiences,
          userRoles: audiences.includes("users") ? userRoles : [],
          image,
          waitForDelivery: true,
        },
      });
      if (result.deduplicated) {
        toast.message("Este comunicado já foi enviado recentemente.");
      } else if (result.message.status === "sent") {
        toast.success("Comunicado enviado.");
      } else if (result.message.status === "partial") {
        const communityDetail = result.message.deliveryResults?.community?.detail;
        const emailDetail = result.message.deliveryResults?.email?.detail;
        const bits = [
          communityDetail && result.message.deliveryResults?.community?.ok === false
            ? `Comunidade: ${communityDetail}`
            : null,
          emailDetail && (result.message.deliveryResults?.email?.sent ?? 0) === 0
            ? `E-mail: ${emailDetail}`
            : null,
        ].filter(Boolean);
        toast.warning(
          bits.length
            ? `Envio parcial. ${bits.join(" · ")}`
            : "Comunicado parcialmente enviado. Veja o histórico.",
        );
      } else {
        toast.warning(`Status: ${statusLabel(result.message.status)}`);
      }
      setTitle("");
      setOriginalText("");
      setReviewedText("");
      setImage(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o push.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando Push…
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-base">Novo comunicado</CardTitle>
            <CardDescription>
              Envie para o sininho do sistema, parceiros, e-mail e/ou comunidade WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="push-title">
                Título
              </label>
              <Input
                id="push-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Atualização da plataforma"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="push-original">
                Mensagem
              </label>
              <Textarea
                id="push-original"
                value={originalText}
                onChange={(event) => setOriginalText(event.target.value)}
                rows={5}
                placeholder="Escreva o comunicado…"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleReview()}
                disabled={reviewing}
              >
                {reviewing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Revisar com IA
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" asChild disabled={uploading}>
                  <span>
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ImagePlus className="size-4" />
                    )}
                    Imagem (só comunidade)
                  </span>
                </Button>
              </label>
              {image ? (
                <Badge variant="secondary" className="gap-1">
                  <Check className="size-3" />
                  {image.fileName}
                  <button type="button" className="ml-1 underline" onClick={() => setImage(null)}>
                    remover
                  </button>
                </Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="push-reviewed">
                Texto final
              </label>
              <Textarea
                id="push-reviewed"
                value={reviewedText}
                onChange={(event) => setReviewedText(event.target.value)}
                rows={5}
                placeholder="Após revisar com IA, o texto final aparece aqui (pode editar)."
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Destinos</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {AUDIENCE_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3",
                      audiences.includes(option.id) && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={audiences.includes(option.id)}
                      onCheckedChange={() => toggleAudience(option.id)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {audiences.includes("users") ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Tipos de usuário</p>
                <div className="flex flex-wrap gap-3">
                  {ROLE_OPTIONS.map((option) => (
                    <label key={option.id} className="inline-flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={userRoles.includes(option.id)}
                        onCheckedChange={() => toggleRole(option.id)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <Button
              type="button"
              className="bg-primary text-primary-foreground"
              onClick={() => void handleSend()}
              disabled={sending}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Enviar comunicado
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base">
            <Bell className="size-4 text-primary" />
            Histórico
          </CardTitle>
          <CardDescription>Últimos comunicados enviados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum comunicado ainda.</p>
          ) : (
            history.map((row) => (
              <div key={row.id} className="rounded-xl border border-border/60 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{row.title}</p>
                  <Badge variant="secondary">{statusLabel(row.status)}</Badge>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground whitespace-pre-wrap">
                  {row.reviewedText || row.originalText}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {new Date(row.sentAt || row.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {row.audiences.join(", ")}
                </p>
                {row.deliveryResults?.community || row.deliveryResults?.email ? (
                  <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                    {row.deliveryResults.community ? (
                      <p>
                        Comunidade:{" "}
                        {row.deliveryResults.community.ok ? "OK" : "falhou"} —{" "}
                        {row.deliveryResults.community.detail}
                      </p>
                    ) : null}
                    {row.deliveryResults.email ? (
                      <p>
                        E-mail: {row.deliveryResults.email.sent} ok /{" "}
                        {row.deliveryResults.email.failed} falha
                        {row.deliveryResults.email.detail
                          ? ` — ${row.deliveryResults.email.detail}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
