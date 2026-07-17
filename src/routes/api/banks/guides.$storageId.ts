import { createFileRoute } from "@tanstack/react-router";
import { readFileSync } from "node:fs";
import { resolveBankGuideFile } from "@/lib/config/bank-guide-media.service";

export const Route = createFileRoute("/api/banks/guides/$storageId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = resolveBankGuideFile(params.storageId);
        if (!file) {
          return new Response("Roteiro não encontrado.", { status: 404 });
        }
        const bytes = readFileSync(file.absolutePath);
        const safeName = file.fileName.replace(/"/g, "");
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": `attachment; filename="${safeName}"`,
          },
        });
      },
    },
  },
});
