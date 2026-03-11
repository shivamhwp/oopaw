import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";

const config = defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  plugins: [
    devtools(),
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    VitePWA({
      injectRegister: null,
      registerType: "autoUpdate",
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,webmanifest}"],
        navigateFallback: "/",
      },
      manifest: false,
      includeAssets: [
        "favicon.ico",
        "oop-logo.svg",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "pwa-maskable-512x512.png",
        "manifest.json",
      ],
    }),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
