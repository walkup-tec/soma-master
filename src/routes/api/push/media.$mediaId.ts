import { createFileRoute } from "@tanstack/react-router";
import { readFileSync } from "node:fs";
import { resolvePushMediaFile } from "@/lib/push/push-media.service";

export const Route = createFileRoute("/api/push/media/$mediaId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = resolvePushMediaFile(params.mediaId);
        if (!file) {
          return new Response("Mídia não encontrada.", { status: 404 });
        }
        const bytes = readFileSync(file.absolutePath);
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": file.mimeType,
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
          },
        });
      },
    },
  },
});
