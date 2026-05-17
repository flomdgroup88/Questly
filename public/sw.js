// ─── Questly Service Worker ───────────────────────────────────────────────────
//
// При сборке vite-plugin-pwa автоматически заменяет self.__WB_MANIFEST
// на список всех файлов приложения с хэшами. Это обеспечивает:
//   • Полный оффлайн после первого визита
//   • Автоматическое обновление кэша при каждом деплое
//
// ВАЖНО: этот файл — шаблон. В dist/ попадает уже обработанная версия.
// ─────────────────────────────────────────────────────────────────────────────

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

// Прекэш всех статических ассетов (JS, CSS, HTML, иконки)
// Список подставляется автоматически при npm run build
precacheAndRoute(self.__WB_MANIFEST);

// Удаляем кэши от старых версий SW
cleanupOutdatedCaches();

// ─── Активация: сразу берём управление без ожидания перезагрузки ─────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Fetch: для внешних запросов (Firebase, Telegram) — только сеть ──────────
// precacheAndRoute уже обрабатывает все наши локальные файлы.
// Этот обработчик страхует остальные GET-запросы к origin.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Пропускаем Firebase, Telegram и любые внешние домены —
  // их не кэшируем, они должны работать только онлайн
  if (url.origin !== self.location.origin) return;

  // Для запросов к своему origin — workbox уже всё обработал через precacheAndRoute.
  // Ничего дополнительного делать не нужно.
});
