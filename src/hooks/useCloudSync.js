import { useEffect, useRef, useState } from "react";
import { initUserSync, cloudSaveUserData, cloudLoadUserData } from "../firebase.js";
import { autoRollover, spawnRecurring, today } from "../utils.js";

const CLOUD_DEBOUNCE_MS = 4000;
// Принудительная запись раз в 20 сек при непрерывных изменениях.
// Без maxWait данные могут не попасть в облако долго при активной работе.
const CLOUD_MAX_WAIT_MS = 20000;

/**
 * Хук управляет облачным синком:
 *  - при старте авторизует пользователя и загружает данные из Firebase
 *  - при каждом изменении данных сохраняет в облако с дебаунсом 4 сек
 *  - maxWait 20 сек гарантирует запись даже при непрерывных изменениях
 *
 * Возвращает:
 *  - syncStatus: "idle" | "saving" | "saved" | "error"
 *  - syncIcon: эмодзи для отображения статуса
 *  - isLoading: true пока идёт первичная загрузка из Firebase
 *  - showOfflineToast: true когда нет соединения с облаком
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
  // isLoading: true с момента запуска до завершения первого запроса к Firebase.
  // Позволяет показать экран-заглушку, пока данные ещё не пришли из облака.
  const [isLoading, setIsLoading] = useState(true);
  // showOfflineToast: показывается на 4 сек после ошибки сохранения.
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const offlineToastTimer = useRef(null);
  const userKeyRef = useRef(null);
  const syncTimerRef = useRef(null);
  const maxWaitTimerRef = useRef(null); // принудительная запись при maxWait

  // ── Инициализация: auth + загрузка облачных данных ───────────────
  useEffect(() => {
    initUserSync().then(async (key) => {
      if (!key) {
        // Firebase недоступен сразу — показываем локальные данные
        setIsLoading(false);
        return;
      }
      userKeyRef.current = key;

      const cloud = await cloudLoadUserData(key);

      const cloudTime = cloud?._savedAt ?? 0;
      if (cloud && cloudTime > savedLocalTime) {
        // Облако актуальнее localStorage → применяем
        onCloudLoaded({
          tasks: cloud.tasks
            ? spawnRecurring(autoRollover(cloud.tasks), cloud.events ?? [], today())
            : null,
          events: cloud.events ?? null,
          xp: cloud.xp ?? null,
          nickname: cloud.nickname ?? null,
        });
        setSyncStatus("saved");
      }

      // Загрузка завершена — скрываем экран ожидания
      setIsLoading(false);
    }).catch(() => {
      // Любая ошибка инициализации — показываем локальные данные
      setIsLoading(false);
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

    const doSave = async () => {
      // Сбрасываем maxWait при каждой реальной записи
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;

      setSyncStatus("saving");
      const ok = await cloudSaveUserData(userKeyRef.current, {
        xp,
        tasks,
        events,
        nickname,
        _savedAt: Date.now(),
      });

      if (ok) {
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus("idle"), 3000);
      } else {
        setSyncStatus("error");
        // Показываем тост «нет соединения» на 4 секунды
        clearTimeout(offlineToastTimer.current);
        setShowOfflineToast(true);
        offlineToastTimer.current = setTimeout(() => setShowOfflineToast(false), 4000);
        setTimeout(() => setSyncStatus("idle"), 3000);
      }
    };

    // Дебаунс: ждём паузы в 4 сек после последнего изменения
    syncTimerRef.current = setTimeout(doSave, CLOUD_DEBOUNCE_MS);

    // maxWait: если изменения идут непрерывно, всё равно пишем раз в 20 сек
    if (!maxWaitTimerRef.current) {
      maxWaitTimerRef.current = setTimeout(() => {
        clearTimeout(syncTimerRef.current);
        doSave();
      }, CLOUD_MAX_WAIT_MS);
    }

    return () => {
      clearTimeout(syncTimerRef.current);
      // maxWaitTimer не сбрасываем в cleanup — он должен сработать
      // даже если эффект перезапустился из-за нового изменения
    };
  }, [xp, tasks, events, nickname]);

  const syncIcon =
    syncStatus === "saving" ? "⏳" :
    syncStatus === "saved"  ? "☁️✓" :
    syncStatus === "error"  ? "⚠️" : null;

  return { syncStatus, syncIcon, isLoading, showOfflineToast };
}
