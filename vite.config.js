import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    // Тесты utils.ts не требуют DOM — используем node для скорости
    environment: "node",
    // globals: true позволяет писать describe/it/expect без импорта
    globals: true,
  },
});
