import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: { port: 5174, strictPort: true },
  plugins: [
    react(),
    tailwindcss(),
    // Solo el shell de la app se cachea (instalable). Los datos siempre van a
    // la red: el modo offline de verdad llega con el hub y el outbox (Fase 5).
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Resto Zest — Mozos",
        short_name: "Mozos",
        lang: "es",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#18181b",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
    }),
  ],
});
