import express          from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import cron             from "node-cron";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, "dist")));

// ─── Firebase Admin (для отправки FCM) ──────────────────────────
// Подключаем только если есть переменная FIREBASE_ADMIN_KEY
// (объект serviceAccount из Firebase Console → Project Settings → Service accounts)
let adminMessaging = null;
let adminDb        = null;

async function initAdmin() {
  const keyJson = process.env.FIREBASE_ADMIN_KEY;
  if (!keyJson) {
    console.log("ℹ️  FIREBASE_ADMIN_KEY не задан — FCM-рассылка отключена");
    return;
  }
  try {
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    const { getMessaging }                 = await import("firebase-admin/messaging");
    const { getFirestore }                 = await import("firebase-admin/firestore");

    if (!getApps().length) {
      // Railway вставляет реальные управляющие символы внутрь строк JSON.
      // Проходим посимвольно и переэкранируем их только внутри строковых значений.
      function sanitizeKeyJson(raw) {
        let out = "", inStr = false, esc = false;
        for (const ch of raw) {
          if (esc)                          { out += ch; esc = false; continue; }
          if (ch === "\\" && inStr)       { out += ch; esc = true;  continue; }
          if (ch === "\"")                 { out += ch; inStr = !inStr; continue; }
          if (inStr && ch === "\n")        { out += "\\n"; continue; }
          if (inStr && ch === "\r")        { out += "\\r"; continue; }
          if (inStr && ch === "\t")        { out += "\\t"; continue; }
          out += ch;
        }
        return out;
      }
      const serviceAccount = JSON.parse(sanitizeKeyJson(keyJson));
      initializeApp({ credential: cert(serviceAccount) });
    }
    adminMessaging = getMessaging();
    adminDb        = getFirestore();
    console.log("✓ Firebase Admin инициализирован");
  } catch (e) {
    console.error("Firebase Admin init error:", e.message);
  }
}

// ─── Вспомогательная функция отправки ────────────────────────────
async function sendPushToUser({ fcmToken, title, body }) {
  if (!adminMessaging || !fcmToken) return false;
  try {
    await adminMessaging.send({
      token: fcmToken,
      notification: { title, body },
      webpush: {
        notification: {
          icon:  "/icon-192.png",
          badge: "/icon-192.png",
          tag:   "questly-daily",
          renotify: false,
        },
        fcmOptions: { link: "/" },
      },
    });
    return true;
  } catch (e) {
    // Токен устарел или отозван — помечаем для очистки
    if (e.code === "messaging/registration-token-not-registered") {
      return "stale";
    }
    console.warn("sendPushToUser error:", e.message);
    return false;
  }
}

// ─── Основная рассылка напоминаний ───────────────────────────────
// Запускается каждую минуту; проверяет, у кого сейчас время напоминания.
// Время хранится в Firestore как "HH:MM" в UTC (клиент конвертирует из локального).
async function sendDailyReminders() {
  if (!adminDb || !adminMessaging) return;

  const nowUTC = new Date();
  const hh     = String(nowUTC.getUTCHours()).padStart(2, "0");
  const mm     = String(nowUTC.getUTCMinutes()).padStart(2, "0");
  const nowStr = `${hh}:${mm}`;

  let snapshot;
  try {
    snapshot = await adminDb.collection("userData")
      .where("notifEnabled",  "==",  true)
      .where("reminderTime",  "==",  nowStr)
      .get();
  } catch (e) {
    console.warn("Firestore query error:", e.message);
    return;
  }

  if (snapshot.empty) return;
  console.log(`[${nowStr} UTC] Отправляем напоминания: ${snapshot.size} пользователей`);

  const batch = adminDb.batch();
  const sends = snapshot.docs.map(async (docSnap) => {
    const { fcmToken, nickname } = docSnap.data();
    const name  = nickname ?? "Герой";
    const result = await sendPushToUser({
      fcmToken,
      title: `Привет, ${name}! 🗡️`,
      body:  "Пора выполнить ежедневные квесты и не потерять серию!",
    });
    if (result === "stale") {
      // Очищаем протухший токен
      batch.update(docSnap.ref, { fcmToken: null, notifEnabled: false });
    }
  });

  await Promise.allSettled(sends);

  try {
    await batch.commit();
  } catch {
    // Игнорируем — батч пустой если все токены живые
  }
}

// ─── Ручная проверка (для отладки) ───────────────────────────────
// POST /api/test-notify  { "fcmToken": "...", "title": "...", "body": "..." }
app.post("/api/test-notify", async (req, res) => {
  const { fcmToken, title = "Тест 🗡️", body = "Questly работает!" } = req.body ?? {};
  if (!fcmToken) return res.status(400).json({ error: "fcmToken required" });

  const ok = await sendPushToUser({ fcmToken, title, body });
  if (ok === true)     return res.json({ ok: true });
  if (ok === "stale")  return res.status(410).json({ error: "token stale" });
  return res.status(500).json({ error: "send failed" });
});

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// ─── Старт ────────────────────────────────────────────────────────
await initAdmin();

// Крон: каждую минуту проверяем, у кого время напоминания совпало
cron.schedule("* * * * *", sendDailyReminders, { timezone: "UTC" });

app.listen(PORT, () => {
  console.log(`🗡️  Questly сервер запущен на порту ${PORT}`);
});
