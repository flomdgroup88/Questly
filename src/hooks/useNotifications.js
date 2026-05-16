import { useEffect, useRef, useState } from "react";
import {
  requestNotificationPermission,
  getFCMToken,
  saveNotificationPrefs,
  loadNotificationPrefs,
  onForegroundMessage,
} from "../firebase.js";

/**
 * Хук управляет пуш-уведомлениями:
 *  - загружает текущие настройки из Firestore при инициализации
 *  - предоставляет enable/disable функции
 *  - слушает foreground-уведомления и показывает их как in-app баннер
 *
 * @param {string|null} userKey — ключ пользователя из useCloudSync
 */
export function useNotifications(userKey) {
  const [notifEnabled,    setNotifEnabled]    = useState(false);
  const [reminderTime,    setReminderTime]    = useState("09:00");
  const [permissionState, setPermissionState] = useState("default"); // default | granted | denied
  const [saving,          setSaving]          = useState(false);
  const [foregroundNotif, setForegroundNotif] = useState(null); // для in-app баннера
  const unsubRef = useRef(null);

  // ── Загрузка настроек из Firestore ────────────────────────────
  useEffect(() => {
    if (!userKey) return;
    loadNotificationPrefs(userKey).then((prefs) => {
      if (!prefs) return;
      setNotifEnabled(prefs.enabled);
      setReminderTime(prefs.reminderTime ?? "09:00");
    });
  }, [userKey]);

  // ── Читаем текущее разрешение браузера ────────────────────────
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermissionState(Notification.permission);
    }
  }, []);

  // ── Слушаем foreground-уведомления ───────────────────────────
  useEffect(() => {
    if (!notifEnabled) return;
    unsubRef.current = onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? "Questly";
      const body  = payload.notification?.body  ?? "Не забудь про задачи!";
      setForegroundNotif({ title, body, id: Date.now() });
      // Прячем баннер через 5 сек
      setTimeout(() => setForegroundNotif(null), 5000);
    });
    return () => {
      if (typeof unsubRef.current === "function") unsubRef.current();
    };
  }, [notifEnabled]);

  // ── Включить уведомления ──────────────────────────────────────
  async function enableNotifications(time = reminderTime) {
    setSaving(true);
    try {
      const { granted, reason } = await requestNotificationPermission();
      setPermissionState(Notification.permission);

      if (!granted) {
        return { ok: false, reason };
      }

      const token = await getFCMToken();
      if (!token) {
        return { ok: false, reason: "token_failed" };
      }

      const ok = await saveNotificationPrefs(userKey, {
        fcmToken: token,
        enabled: true,
        reminderTime: time,
      });

      if (ok) {
        setNotifEnabled(true);
        setReminderTime(time);
      }
      return { ok, token };
    } catch (e) {
      console.warn("enableNotifications error:", e);
      return { ok: false, reason: "error" };
    } finally {
      setSaving(false);
    }
  }

  // ── Выключить уведомления ─────────────────────────────────────
  async function disableNotifications() {
    setSaving(true);
    try {
      await saveNotificationPrefs(userKey, {
        fcmToken: null,
        enabled: false,
        reminderTime,
      });
      setNotifEnabled(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Изменить время напоминания (без повторного запроса разрешения) ─
  async function updateReminderTime(time) {
    setReminderTime(time);
    if (!userKey || !notifEnabled) return;
    // Получаем актуальный токен (он мог обновиться)
    const token = await getFCMToken();
    await saveNotificationPrefs(userKey, { fcmToken: token, enabled: true, reminderTime: time });
  }

  return {
    notifEnabled,
    reminderTime,
    permissionState,
    saving,
    foregroundNotif,
    enableNotifications,
    disableNotifications,
    updateReminderTime,
    dismissForeground: () => setForegroundNotif(null),
  };
}
