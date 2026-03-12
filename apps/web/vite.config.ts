import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const enableTanStackDevtools = process.env.TANSTACK_DEVTOOLS === "true";

const config = defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    headers: {
      "Cache-Control": "no-store",
    },
  },
  plugins: [
    ...(enableTanStackDevtools ? [devtools({ eventBusConfig: { enabled: false } })] : []),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
});

export default config;
