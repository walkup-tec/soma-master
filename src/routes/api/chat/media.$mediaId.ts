import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig } from "@/lib/auth/session-config";
import {
  chatImageStreamToWeb,
  openChatImageReadStream,
} from "@/lib/chat/chat-media.repository";

export const Route = createFileRoute("/api/chat/media/$mediaId")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await getSession(sessionConfig);
        const user = session.data;
        if (!user?.userId || !sessionCanAccessMenu(user, "chat")) {
          return new Response("Não autorizado.", { status: 401 });
        }

        const mediaId = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
        try {
          const { meta, stream } = await openChatImageReadStream(mediaId);
          return new Response(chatImageStreamToWeb(stream), {
            status: 200,
            headers: {
              "content-type": meta.mimeType,
              "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
              "cache-control": "private, max-age=3600",
              "x-content-type-options": "nosniff",
            },
          });
        } catch {
          return new Response("Imagem não encontrada.", { status: 404 });
        }
      },
    },
  },
});
