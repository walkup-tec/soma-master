import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  appendClientAttachmentChunkFn,
  deleteClientAttachmentFn,
  finalizeClientAttachmentUploadFn,
  initClientAttachmentUploadFn,
  issueClientAttachmentDownloadFn,
  listClientAttachmentsFn,
} from "@/lib/clients/clients.server";
import type { ClientAttachmentRecord } from "@/lib/clients/client.types";
import { formatFileSize } from "@/lib/clients/format-file-size";
import { UPLOAD_CHUNK_BYTES } from "@/lib/clients/parse-excel";
import { readFileInChunks } from "@/lib/clients/upload-file-chunks";

type Props = {
  clientId: string;
  enabled?: boolean;
  onAttachmentsChange?: (hasAttachments: boolean) => void;
};

type UploadState = {
  fileName: string;
  progress: number;
};

function formatAttachmentDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ClientAttachmentsPanel({
  clientId,
  enabled = true,
  onAttachmentsChange,
}: Props) {
  const listAttachments = useServerFn(listClientAttachmentsFn);
  const initUpload = useServerFn(initClientAttachmentUploadFn);
  const appendChunk = useServerFn(appendClientAttachmentChunkFn);
  const finalizeUpload = useServerFn(finalizeClientAttachmentUploadFn);
  const deleteAttachment = useServerFn(deleteClientAttachmentFn);
  const issueDownload = useServerFn(issueClientAttachmentDownloadFn);

  const inputRef = useRef<HTMLInputElement>(null);
  const listAttachmentsRef = useRef(listAttachments);
  const initUploadRef = useRef(initUpload);
  const appendChunkRef = useRef(appendChunk);
  const finalizeUploadRef = useRef(finalizeUpload);
  const deleteAttachmentRef = useRef(deleteAttachment);
  const issueDownloadRef = useRef(issueDownload);
  listAttachmentsRef.current = listAttachments;
  initUploadRef.current = initUpload;
  appendChunkRef.current = appendChunk;
  finalizeUploadRef.current = finalizeUpload;
  deleteAttachmentRef.current = deleteAttachment;
  issueDownloadRef.current = issueDownload;

  const [attachments, setAttachments] = useState<ClientAttachmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<UploadState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const items = await listAttachmentsRef.current({ data: { clientId } });
      setAttachments(items);
      onAttachmentsChange?.(items.length > 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar anexos.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!enabled || !clientId) {
      setAttachments([]);
      return;
    }
    void refresh();
  }, [enabled, clientId, refresh]);

  const uploadSingleFile = async (file: File) => {
    const totalChunks = Math.ceil(file.size / UPLOAD_CHUNK_BYTES);
    setUploading({ fileName: file.name, progress: 0 });

    const meta = await initUploadRef.current({
      data: {
        clientId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || null,
        totalChunks,
      },
    });

    await readFileInChunks(file, UPLOAD_CHUNK_BYTES, async (chunkIndex, chunks, base64) => {
      await appendChunkRef.current({
        data: {
          attachmentId: meta.attachmentId,
          chunkIndex,
          chunkBase64: base64,
        },
      });
      setUploading({
        fileName: file.name,
        progress: Math.round(((chunkIndex + 1) / chunks) * 100),
      });
    });

    const created = await finalizeUploadRef.current({
      data: { attachmentId: meta.attachmentId, clientId },
    });

    setAttachments((current) => {
      const next = [created, ...current];
      onAttachmentsChange?.(next.length > 0);
      return next;
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    try {
      for (const file of list) {
        await uploadSingleFile(file);
      }
      toast.success(list.length === 1 ? "Arquivo anexado." : `${list.length} arquivos anexados.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar anexo.");
      await refresh();
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDownload = async (attachment: ClientAttachmentRecord) => {
    try {
      const { url } = await issueDownloadRef.current({
        data: { attachmentId: attachment.id, clientId },
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o arquivo.");
    }
  };

  const handleDelete = async (attachment: ClientAttachmentRecord) => {
    setDeletingId(attachment.id);
    try {
      await deleteAttachmentRef.current({
        data: { attachmentId: attachment.id, clientId },
      });
      setAttachments((current) => {
        const next = current.filter((item) => item.id !== attachment.id);
        onAttachmentsChange?.(next.length > 0);
        return next;
      });
      toast.success("Anexo removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o anexo.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Anexos</h3>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center transition-colors hover:bg-muted/35 ${
          uploading ? "pointer-events-none opacity-70" : ""
        }`}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!uploading) void handleFiles(event.dataTransfer.files);
        }}
      >
        <Upload className="mb-2 size-5 text-muted-foreground" />
        <p className="text-sm font-medium">Clique ou arraste arquivos aqui</p>
        <p className="mt-1 text-xs text-muted-foreground">Qualquer tipo e tamanho</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
          }}
        />
      </label>

      {uploading ? (
        <div className="space-y-2 rounded-lg border border-border/60 px-3 py-3">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">Enviando {uploading.fileName}</span>
            <span>{uploading.progress}%</span>
          </div>
          <Progress value={uploading.progress} className="h-2" />
        </div>
      ) : null}

      {loading && attachments.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando anexos…
        </div>
      ) : attachments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-4 py-5 text-center text-sm text-muted-foreground">
          Nenhum arquivo anexado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-background px-3 py-3"
            >
              <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.fileSize)} · {formatAttachmentDate(attachment.createdAt)} ·{" "}
                  {attachment.userName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Baixar anexo"
                  onClick={() => void handleDownload(attachment)}
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  aria-label="Remover anexo"
                  disabled={deletingId === attachment.id}
                  onClick={() => void handleDelete(attachment)}
                >
                  {deletingId === attachment.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
