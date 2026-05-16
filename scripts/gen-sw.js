#!/usr/bin/env node
// scripts/gen-sw.js — подставляет переменные из .env в firebase-messaging-sw.js
// Запуск: npm run gen-sw   (перед npm run dev)
//
// При production-сборке это делает плагин в vite.config.js автоматически.

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Загружаем .env вручную (без dotenv, чтобы не добавлять зависимость)
function loadEnv(file) {
  try {
    const raw = readFileSync(resolve(ROOT, file), "utf-8");
    const env = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

const env = { ...loadEnv(".env.example"), ...loadEnv(".env") };

const REPLACEMENTS = {
  "__VITE_FIREBASE_API_KEY__":            env.VITE_FIREBASE_API_KEY            ?? "",
  "__VITE_FIREBASE_AUTH_DOMAIN__":        env.VITE_FIREBASE_AUTH_DOMAIN        ?? "",
  "__VITE_FIREBASE_PROJECT_ID__":         env.VITE_FIREBASE_PROJECT_ID         ?? "",
  "__VITE_FIREBASE_STORAGE_BUCKET__":     env.VITE_FIREBASE_STORAGE_BUCKET     ?? "",
  "__VITE_FIREBASE_MESSAGING_SENDER_ID__":env.VITE_FIREBASE_MESSAGING_SENDER_ID?? "",
  "__VITE_FIREBASE_APP_ID__":             env.VITE_FIREBASE_APP_ID             ?? "",
};

const template = readFileSync(resolve(ROOT, "public/firebase-messaging-sw.js"), "utf-8");
let output = template;
for (const [placeholder, value] of Object.entries(REPLACEMENTS)) {
  output = output.replaceAll(placeholder, value);
}

// Записываем в public (перезаписываем шаблон реальными значениями)
writeFileSync(resolve(ROOT, "public/firebase-messaging-sw.js"), output, "utf-8");
console.log("✓ firebase-messaging-sw.js сгенерирован с реальными env-переменными");
