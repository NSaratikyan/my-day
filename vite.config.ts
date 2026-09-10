import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { config } from "./src/config";
export default defineConfig(({ mode }) => {
  const base = mode === 'github-pages' ? config.githubPages.base : '/';
  return {
  base,
  build: {
    rollupOptions: {
      output: { manualChunks: (id) => id.includes('@formatjs') ? 'armenian-calendar' : undefined },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon-192.png", "icon-512.png", "maskable-512.png"],
      manifest: {
        id: base,
        name: config.name,
        short_name: config.name,
        lang: "hy",
        start_url: base,
        scope: base,
        display: "standalone",
        theme_color: "#167C70",
        background_color: "#EDF3F1",
        icons: [
          { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png" },
          {
            src: `${base}maskable-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
};
});
