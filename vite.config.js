import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// ─── Плагин: подставляет Firebase env-переменные в SW при сборке ──
function generateFCMServiceWorker() {
  return {
    name: "vite-plugin-fcm-sw",
    // Запускается после записи всех файлов в dist/
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
        "__VITE_FIREBASE_API_KEY__":             process.env.VITE_FIREBASE_API_KEY             ?? "",
        "__VITE_FIREBASE_AUTH_DOMAIN__":         process.env.VITE_FIREBASE_AUTH_DOMAIN         ?? "",
        "__VITE_FIREBASE_PROJECT_ID__":          process.env.VITE_FIREBASE_PROJECT_ID          ?? "",
        "__VITE_FIREBASE_STORAGE_BUCKET__":      process.env.VITE_FIREBASE_STORAGE_BUCKET      ?? "",
        "__VITE_FIREBASE_MESSAGING_SENDER_ID__": process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
        "__VITE_FIREBASE_APP_ID__":              process.env.VITE_FIREBASE_APP_ID              ?? "",
      };

      for (const [placeholder, value] of Object.entries(replacements)) {
        sw = sw.replaceAll(placeholder, value);
      }

      writeFileSync(swPath, sw, "utf-8");
      console.log("✓ firebase-messaging-sw.js: env-переменные подставлены");
    },
  };
}

export default defineConfig({
  plugins: [react(), generateFCMServiceWorker()],
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
});
