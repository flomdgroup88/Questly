import { useEffect, useRef, useState } from "react";
import { initUserSync, cloudSaveUserData, cloudLoadUserData } from "../firebase.js";
import { autoRollover, spawnRecurring, today } from "../utils.js";

const CLOUD_DEBOUNCE_MS = 4000;

/**
 * Хук управляет облачным синком:
 *  - при старте авторизует пользователя и загружает данные из Firebase
 *  - при каждом изменении данных сохраняет в облако с дебаунсом 4 сек
 *
 * Возвращает:
 *  - syncStatus: "idle" | "saving" | "saved" | "error"
 *  - syncIcon: эмодзи для отображения статуса
 */
export function useCloudSync({
  xp,
  tasks,
  events,
  nickname,
  savedLocalTime,
  onCloudLoaded,
}) {
  const [syncStatus, setSyncStatus] = useState("idle");
  const userKeyRef = useRef(null);
  const syncTimerRef = useRef(null);

  // ── Инициализация: auth + загрузка облачных данных ───────────────
  useEffect(() => {
    initUserSync().then(async (key) => {
      if (!key) return;
      userKeyRef.current = key;

      const cloud = await cloudLoadUserData(key);
      if (!cloud) return; // первый запуск — облако пустое

      const cloudTime = cloud._savedAt ?? 0;

      if (cloudTime > savedLocalTime) {
        // Облако актуальнее localStorage → применяем
        onCloudLoaded({
          tasks: cloud.tasks
            ? spawnRecurring(autoRollover(cloud.tasks), cloud.events ?? [], today)
            : null,
          events: cloud.events ?? null,
          xp: cloud.xp ?? null,
          nickname: cloud.nickname ?? null,
        });
        setSyncStatus("saved");
      }
    });
  // Запускается один раз при монтировании — savedLocalTime и onCloudLoaded
  // намеренно не в зависимостях: они не меняются после первого рендера.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Дебаунс-сохранение в облако при каждом изменении данных ──────
  useEffect(() => {
    if (!userKeyRef.current) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncStatus("idle");

    syncTimerRef.current = setTimeout(async () => {
      setSyncStatus("saving");
      const ok = await cloudSaveUserData(userKeyRef.current, {
        xp,
        tasks,
        events,
        nickname,
        _savedAt: Date.now(),
      });
      setSyncStatus(ok ? "saved" : "error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    }, CLOUD_DEBOUNCE_MS);

    return () => clearTimeout(syncTimerRef.current);
  }, [xp, tasks, events, nickname]);

  const syncIcon =
    syncStatus === "saving" ? "⏳" :
    syncStatus === "saved"  ? "☁️✓" :
    syncStatus === "error"  ? "⚠️" : null;

  return { syncStatus, syncIcon };
}
