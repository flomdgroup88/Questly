import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Подставляет Firebase env-переменные в firebase-messaging-sw.js после билда
function generateFCMServiceWorker(env) {
  return {
    name: "vite-plugin-fcm-sw",
    closeBundle() {
      const swPath = resolve("dist/firebase-messaging-sw.js");
      let sw;
      try {
        sw = readFileSync(swPath, "utf-8");
      } catch {
        console.warn("⚠️  firebase-messaging-sw.js не найден в dist — пропускаем подстановку");
        return;
      }
      const replacements = {
        "__VITE_FIREBASE_API_KEY__":             env.VITE_FIREBASE_API_KEY             ?? "",
        "__VITE_FIREBASE_AUTH_DOMAIN__":         env.VITE_FIREBASE_AUTH_DOMAIN         ?? "",
        "__VITE_FIREBASE_PROJECT_ID__":          env.VITE_FIREBASE_PROJECT_ID          ?? "",
        "__VITE_FIREBASE_STORAGE_BUCKET__":      env.VITE_FIREBASE_STORAGE_BUCKET      ?? "",
        "__VITE_FIREBASE_MESSAGING_SENDER_ID__": env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
        "__VITE_FIREBASE_APP_ID__":              env.VITE_FIREBASE_APP_ID              ?? "",
      };
      for (const [placeholder, value] of Object.entries(replacements)) {
        sw = sw.replaceAll(placeholder, value);
      }
      writeFileSync(swPath, sw, "utf-8");
      console.log("✓ firebase-messaging-sw.js: env-переменные подставлены");
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      VitePWA({
        // SW автоматически обновляется при новом деплое
        registerType: "autoUpdate",

        // injectManifest — используем наш собственный sw.js,
        // плагин только вставляет в него список файлов для прекэша
        strategies: "injectManifest",
        srcDir: "public",
        filename: "sw.js",

        injectManifest: {
          // Кэшируем все статические ассеты приложения
          globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2,webp}"],
          // Не кэшируем firebase-messaging-sw — у него своя задача
          globIgnores: ["firebase-messaging-sw.js"],
        },

        // manifest.json — плагин вставит его ссылку в HTML автоматически.
        // Свой /public/manifest.json при этом можно оставить как fallback.
        manifest: {
          name: "Questly",
          short_name: "Questly",
          description: "Геймификация задач и квестов",
          start_url: "/",
          display: "standalone",
          background_color: "#07071C",
          theme_color: "#07071C",
          orientation: "portrait",
          icons: [
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },

        // Не запускать SW в dev-режиме — мешает HMR
        devOptions: {
          enabled: false,
        },
      }),
      generateFCMServiceWorker(env),
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      host: true,
    },
    test: {
      environment: "node",
      globals: true,
    },
  };
});
