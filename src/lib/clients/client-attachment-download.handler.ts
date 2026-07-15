import {
  attachmentStreamToWeb,
  openClientAttachmentReadStream,
} from "@/lib/clients/client-attachment.repository";
import { consumeClientAttachmentDownloadToken } from "@/lib/clients/client-attachment-download";

export async function handleClientAttachmentDownload(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/client-attachments\/([^/]+)\/download$/);
  if (!match || request.method !== "GET") return null;

  const attachmentId = consumeClientAttachmentDownloadToken(match[1]!);
  if (!attachmentId) {
    return new Response("Link de download expirado ou inválido.", { status: 404 });
  }

  try {
    const { record, stream } = await openClientAttachmentReadStream(attachmentId);
    const encodedName = encodeURIComponent(record.fileName);
    return new Response(attachmentStreamToWeb(stream), {
      status: 200,
      headers: {
        "content-type": record.mimeType ?? "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodedName}`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao baixar anexo.";
    return new Response(message, { status: 404 });
  }
}
