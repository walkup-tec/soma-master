// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Easypanel/VPS: DEPLOY_TARGET=node → Nitro (.output) em vez de Cloudflare Workers.
const isNodeDeploy = process.env.DEPLOY_TARGET === "node";

export default defineConfig({
  cloudflare: isNodeDeploy ? false : undefined,
  tanstackStart: {
    server: { entry: "server" },
  },
  // Preset explícito: build com Bun não pode emitir Bun.serve (runtime Easypanel = Node).
  plugins: isNodeDeploy ? [nitro({ preset: "node-server" })] : [],
  vite: {
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
    },
    server: {
      port: 3090,
      strictPort: true,
      host: "127.0.0.1",
    },
  },
});
