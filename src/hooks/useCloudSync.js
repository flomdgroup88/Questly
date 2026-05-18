import { useEffect, useRef, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, cloudSaveUserData, cloudLoadUserData, initUserSync } from "../firebase.js";
import { autoRollover, spawnRecurring, today } from "../utils";

const CLOUD_DEBOUNCE_MS = 4000;
const CLOUD_MAX_WAIT_MS = 20000;

/**
 * Хук управляет облачным синком:
 *  - подписывается на onAuthStateChanged — реагирует на вход/выход в реальном времени
 *  - при смене пользователя загружает его данные из Firebase
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
  challenges,
  sharedGoals,
  savedLocalTime,
  onCloudLoaded,
}) {
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncErrorCode, setSyncErrorCode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const offlineToastTimer = useRef(null);
  // userKeyRef теперь всегда содержит UID залогиненного пользователя
  // (или null если не залогинен / анонимный не нужен)
  const userKeyRef = useRef(null);
  const syncTimerRef = useRef(null);
  const maxWaitTimerRef = useRef(null);
  // Флаг: первая загрузка для текущего пользователя уже выполнена
  const loadedForUserRef = useRef(null);
  // Флаг: идёт загрузка облака — блокирует дебаунс-сохранение
  // Это предотвращает race condition: loginBonus меняет xp через 1.5с,
  // запускает 4с дебаунс, а к моменту его срабатывания userKeyRef уже
  // указывает на emailUID — и пустые данные перезаписывают реальные.
  const cloudLoadingRef = useRef(false);

  // ── Подписка на Auth: реагируем на вход / выход / восстановление сессии ──
  useEffect(() => {
    // Запускаем анонимный вход заранее — иначе onAuthStateChanged может не сработать
    initUserSync().catch(() => {});

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Не залогинен — сбрасываем ключ, показываем локальные данные
        userKeyRef.current = null;
        loadedForUserRef.current = null;
        setIsLoading(false);
        return;
      }

      // Для Telegram-пользователей используем tg_{id} вместо нестабильного анонимного UID.
      // Для всех остальных (анонимных и email) используем Firebase UID.
      const tgUser = typeof window !== "undefined" && window.Telegram?.WebApp?.initDataUnsafe?.user;
      const key = (tgUser?.id) ? `tg_${tgUser.id}` : user.uid;

      // Новый пользователь — загружаем его данные
      if (loadedForUserRef.current !== key) {
        loadedForUserRef.current = key;
        userKeyRef.current = key;
        setIsLoading(true);
        cloudLoadingRef.current = true;
        // Отменяем любые дебаунс-таймеры старого пользователя
        clearTimeout(syncTimerRef.current);
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;

        try {
          const cloud = await cloudLoadUserData(key);
          const cloudTime = cloud?._savedAt ?? 0;
          if (cloud && cloudTime > savedLocalTime) {
            onCloudLoaded({
              tasks: cloud.tasks
                ? spawnRecurring(autoRollover(cloud.tasks), cloud.events ?? [], today())
                : null,
              events: cloud.events ?? null,
              xp: cloud.xp ?? null,
              nickname: cloud.nickname ?? null,
              userAvatar: cloud.userAvatar ?? null,
              challenges: cloud.challenges ?? null,
              sharedGoals: cloud.sharedGoals ?? null,
            });
            setSyncStatus("saved");
          }
        } catch (e) {
          console.warn("cloudLoadUserData error:", e);
        } finally {
          cloudLoadingRef.current = false;
          setIsLoading(false);
        }
      } else {
        // Уже загружали для этого пользователя
        userKeyRef.current = key;
        setIsLoading(false);
      }
    });

    return unsub;
  // savedLocalTime и onCloudLoaded намеренно не в зависимостях:
  // они стабильны после первого рендера (onCloudLoaded обёрнут в useCallback в App)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Дебаунс-сохранение в облако при каждом изменении данных ──────
  useEffect(() => {
    if (!userKeyRef.current) return;
    // Не сохраняем пока идёт загрузка облака — иначе пустой стейт
    // может перезаписать реальные данные до того, как они загрузились.
    if (cloudLoadingRef.current) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncStatus("idle");

    const doSave = async () => {
      if (!userKeyRef.current) return; // пользователь вышел пока ждали
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;

      setSyncStatus("saving");
      const result = await cloudSaveUserData(userKeyRef.current, {
        xp,
        tasks,
        events,
        nickname,
        challenges,
        sharedGoals,
        _savedAt: Date.now(),
      });

      if (result.ok) {
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus("idle"), 3000);
      } else {
        setSyncStatus("error");
        // Сохраняем код ошибки для отображения в тосте
        setSyncErrorCode(result.code ?? "unknown");
        clearTimeout(offlineToastTimer.current);
        setShowOfflineToast(true);
        offlineToastTimer.current = setTimeout(() => setShowOfflineToast(false), 5000);
        setTimeout(() => setSyncStatus("idle"), 3000);
      }
    };

    syncTimerRef.current = setTimeout(doSave, CLOUD_DEBOUNCE_MS);

    if (!maxWaitTimerRef.current) {
      maxWaitTimerRef.current = setTimeout(() => {
        clearTimeout(syncTimerRef.current);
        doSave();
      }, CLOUD_MAX_WAIT_MS);
    }

    return () => {
      clearTimeout(syncTimerRef.current);
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    };
  }, [xp, tasks, events, nickname, challenges, sharedGoals]);

  const syncIcon =
    syncStatus === "saving" ? "⏳" :
    syncStatus === "saved"  ? "☁️✓" :
    syncStatus === "error"  ? "⚠️" : null;

  return { syncStatus, syncIcon, isLoading, showOfflineToast, syncErrorCode };
}
