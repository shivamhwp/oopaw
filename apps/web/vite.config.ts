import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
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
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script",
      includeAssets: ["favicon.ico", "oop-logo.svg", "robots.txt", "icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "oopaw",
        short_name: "oopaw",
        description:
          "Track fresh posts from direct RSS and Atom feeds in a clean split-pane reader.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#faf8f8",
        theme_color: "#faf8f8",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});

export default config;
