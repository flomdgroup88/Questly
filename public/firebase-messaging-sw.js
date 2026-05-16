// ─── FIREBASE MESSAGING SERVICE WORKER ───────────────────────────
// Этот файл АВТОМАТИЧЕСКИ ПЕРЕГЕНЕРИРУЕТСЯ при `vite build`
// через плагин в vite.config.js — не редактируй вручную.
//
// Firebase требует, чтобы этот файл лежал в корне сайта (/firebase-messaging-sw.js).
// Vite копирует его из /public → /dist при билде, плагин подставляет env-переменные.
//
// ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ: скрипт scripts/gen-sw.js генерирует
// этот файл с переменными из .env — запускай `npm run gen-sw` перед `npm run dev`.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Конфиг подставляется при сборке (см. vite.config.js → generateSW plugin)
firebase.initializeApp({
  apiKey:            "__VITE_FIREBASE_API_KEY__",
  authDomain:        "__VITE_FIREBASE_AUTH_DOMAIN__",
  projectId:         "__VITE_FIREBASE_PROJECT_ID__",
  storageBucket:     "__VITE_FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__VITE_FIREBASE_MESSAGING_SENDER_ID__",
  appId:             "__VITE_FIREBASE_APP_ID__",
});

const messaging = firebase.messaging();

// ── Фоновые пуш-уведомления (приложение свёрнуто / вкладка закрыта) ──
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, data } = payload.notification ?? payload.data ?? {};

  const notifTitle = title ?? "Questly 🗡️";
  const notifBody  = body  ?? "Пора выполнить задачи!";

  self.registration.showNotification(notifTitle, {
    body:    notifBody,
    icon:    icon ?? "/icon-192.png",
    badge:   "/icon-192.png",
    tag:     "questly-daily",          // заменяет старое уведомление, не дублирует
    renotify: false,
    data:    data ?? {},
    actions: [
      { action: "open",    title: "Открыть" },
      { action: "dismiss", title: "Позже"   },
    ],
  });
});

// ── Клик по уведомлению — открываем приложение ───────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Если вкладка уже открыта — фокусируемся
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Иначе открываем новую
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
