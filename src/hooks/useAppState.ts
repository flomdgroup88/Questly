/**
 * useAppState — центральный хук приложения.
 *
 * Раньше весь этот код жил прямо в теле App() и делал его нечитаемым.
 * Теперь App() просто вызывает хук и получает готовые данные + колбэки.
 *
 * Что внутри:
 *  - задачи / события / соцфичи
 *  - localStorage ↔ Firebase синк
 *  - полуночный перенос задач
 *  - push-уведомления
 *  - все обработчики событий
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, logOut, cloudSave } from "../firebase.js";
import {
  lvlOf, today,
  loadState, saveState, loadSocial, saveSocial,
  autoRollover, spawnRecurring,
} from "../utils";
import { useTasks }           from "./useTasks.js";
import { useCloudSync }       from "./useCloudSync.js";
import { useNotifications }   from "./useNotifications.js";
import { useMidnightRollover } from "./useMidnightRollover.js";
import type { Task, QuestlyEvent, Challenge, SharedGoal } from "../types.js";
import { useUser } from "../context/UserContext.js";

export function useAppState() {
  // ── Auth ──────────────────────────────────────────────────────────
  const [authReady,    setAuthReady]    = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<null | object>(null);

  // Никнейм и аватар живут в UserContext — берём сеттеры отсюда
  const { nickname, userAvatar, setNickname, setUserAvatar } = useUser();

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setFirebaseUser(user ?? null);
      setAuthReady(true);
    });
  }, []);

  const handleLogout = useCallback(async () => { await logOut(); }, []);

  // ── Начальная загрузка из localStorage (один раз) ─────────────────
  const [saved]    = useState(() => loadState());
  const [savedSoc] = useState(() => loadSocial());

  // ── Задачи и XP ───────────────────────────────────────────────────
  const {
    tasks, setTasks,
    xp, setXP,
    xpAnim, lvlUpAnim,
    handleToggle, handleSave, handleDelete, handleShopToggle,
    grantXP,
  } = useTasks(saved?.tasks ?? [], saved?.xp ?? 0);

  // ── Бонус за ежедневный вход ──────────────────────────────────────
  const [loginBonus, setLoginBonus] = useState<{xp: number, streak: number} | null>(null);

  useEffect(() => {
    const LS_LOGIN = "questly_login_v1";
    const todayDate = today();
    try {
      const raw  = localStorage.getItem(LS_LOGIN);
      const data = raw ? JSON.parse(raw) : { lastDate: null, streak: 0 };
      if (data.lastDate === todayDate) return; // уже получил бонус сегодня

      // Считаем стрик: бонус если вчера тоже заходил
      const d = new Date(); d.setDate(d.getDate() - 1);
      const yesterday = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const newStreak = data.lastDate === yesterday ? (data.streak || 0) + 1 : 1;

      // XP: 10 базовых + по 2 за каждый день стрика, максимум 40
      const bonusXP = Math.min(10 + (newStreak - 1) * 2, 40);

      localStorage.setItem(LS_LOGIN, JSON.stringify({ lastDate: todayDate, streak: newStreak }));

      // Задержка — приложение успевает смонтироваться
      setTimeout(() => {
        grantXP(bonusXP);
        setLoginBonus({ xp: bonusXP, streak: newStreak });
        setTimeout(() => setLoginBonus(null), 4500);
      }, 1500);
    } catch { /* не критично */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── События и соцфичи ─────────────────────────────────────────────
  const [events,      setEvts]       = useState<QuestlyEvent[]>(saved?.events      ?? []);
  const [challenges,  setChallenges] = useState<Challenge[]>   (savedSoc?.challenges  ?? []);
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]> (savedSoc?.sharedGoals ?? []);

  // ── UI-стейт ──────────────────────────────────────────────────────
  const [tab,             setTab]           = useState("overview");
  const [showOnboarding,  setShowOnboarding] = useState(() => !loadState());
  const [showGlobalCreate, setShowGlobalCreate] = useState(false);
  const [showNicknameGate, setShowNicknameGate] = useState(false);
  const [overviewEditTask, setOverviewEditTask] = useState<Task | null>(null);

  // ── Спаун повторяющихся задач при старте ──────────────────────────
  useEffect(() => {
    // eslint-disable-next-line — events здесь только начальное значение,
    // добавление его в deps вызовет пересчёт при каждом новом событии
    setTasks(prev => spawnRecurring(autoRollover(prev), events, today()));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Сохранение в localStorage ─────────────────────────────────────
  useEffect(() => {
    saveState({ xp, tasks, events, nickname, userAvatar, _savedAt: Date.now() });
    saveSocial({ challenges, sharedGoals });
  }, [xp, tasks, events, nickname, userAvatar, challenges, sharedGoals]);
  // nickname/userAvatar теперь сохраняются и здесь, и через persistUserFields в UserContext (дублирование безопасно)

  // ── Облачный синк ─────────────────────────────────────────────────
  const handleCloudLoaded = useCallback(({
    tasks: t, events: e, xp: x, challenges: ch, sharedGoals: sg,
    nickname: n, userAvatar: av,
  }: Partial<ReturnType<typeof loadState> & ReturnType<typeof loadSocial> & { nickname: string; userAvatar: string }>) => {
    if (t)           setTasks(t);
    if (e)           setEvts(e);
    if (x != null)   setXP(x);
    if (ch)          setChallenges(ch);
    if (sg)          setSharedGoals(sg);
    // Восстанавливаем никнейм и аватар из облака (критично для поиска по никнейму)
    if (n)           setNickname(n);
    if (av)          setUserAvatar(av);
  // Сеттеры от useState/useUser стабильны — deps пустой намеренно
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { syncStatus, syncIcon, isLoading, showOfflineToast, syncErrorCode } = useCloudSync({
    xp, tasks, events, nickname, challenges, sharedGoals,
    savedLocalTime: saved?._savedAt ?? 0,
    onCloudLoaded: handleCloudLoaded,
  });

  // ── Полуночный перенос ────────────────────────────────────────────
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useMidnightRollover({ setTasks, eventsRef });

  // ── Push-уведомления ──────────────────────────────────────────────
  const [notifUserKey, setNotifUserKey] = useState<string | null>(null);
  useEffect(() => {
    import("../firebase.js").then(({ initUserSync }) =>
      initUserSync().then(key => { if (key) setNotifUserKey(key); })
    );
  }, []);
  const notif = useNotifications(notifUserKey);

  // ── Обработчики событий ───────────────────────────────────────────
  const handleImport = useCallback((data: Partial<ReturnType<typeof loadState>>) => {
    if (data.tasks)           setTasks(data.tasks);
    if (data.events)          setEvts(data.events!);
    if (data.xp !== undefined) setXP(data.xp);
  }, [setTasks, setXP]);

  const handleAddEvent = useCallback((ev: QuestlyEvent, autoTasks?: Task[]) => {
    if (ev)                setEvts(p => [ev, ...p]);
    if (autoTasks?.length) setTasks(p => [...autoTasks, ...p]);
  }, [setTasks]);

  const handleEditEvent = useCallback((ev: QuestlyEvent) => {
    setEvts(p => {
      const i = p.findIndex(e => e.id === ev.id);
      if (i === -1) return p;
      const updated = [...p];
      updated[i] = { ...p[i], ...ev };
      return updated;
    });
  }, []);

  const handleDeleteEvent = useCallback((id: string) => {
    setEvts(p => p.filter(e => e.id !== id));
    setTasks(p => p.filter(t => t.eventId !== id));
  }, [setTasks]);

  // ── Соцфичи ───────────────────────────────────────────────────────
  const handleUpdateCh = useCallback((id: string, updFn: (c: Challenge) => Challenge) =>
    setChallenges(p => p.map(c => c.id === id ? updFn(c) : c)), []);

  const handleUpdateSg = useCallback((id: string, updFn: (s: SharedGoal) => SharedGoal) =>
    setSharedGoals(p => p.map(s => s.id === id ? updFn(s) : s)), []);

  const handleDeleteCh = useCallback((id: string) =>
    setChallenges(p => p.filter(c => c.id !== id)), []);

  const handleDeleteSg = useCallback((id: string) =>
    setSharedGoals(p => p.filter(s => s.id !== id)), []);

  const handleCreateCh = useCallback((ch: Challenge, myName: string, myAvatar: string) => {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const myTgId = tgUser?.id ? String(tgUser.id) : null;

    setChallenges(p => [ch, ...p]);
    cloudSave("challenges", {
      ...ch,
      participants: [{
        name: myName, avatar: myAvatar,
        streak: 0, history: [], lastCompleted: null,
        ...(myTgId ? { tgId: myTgId } : {}),
      }],
    }).then(ok => { if (!ok) console.error("⚠️ Не удалось сохранить соревнование."); });
  }, []);

  const handleCreateSg = useCallback((sg: SharedGoal) => {
    setSharedGoals(p => [sg, ...p]);
    cloudSave("sharedGoals", sg)
      .then(ok => { if (!ok) console.error("⚠️ Не удалось сохранить цель."); });
  }, []);

  return {
    // Auth
    authReady, firebaseUser, handleLogout,
    // Данные
    tasks, events, challenges, sharedGoals,
    xp, xpAnim, lvlUpAnim,
    // Синк
    syncStatus, syncIcon, isLoading, showOfflineToast, syncErrorCode,
    // Уведомления
    notif,
    // Бонус за вход
    loginBonus,
    // UI
    tab, setTab,
    showOnboarding, setShowOnboarding,
    showGlobalCreate, setShowGlobalCreate,
    showNicknameGate, setShowNicknameGate,
    overviewEditTask, setOverviewEditTask,
    // Обработчики задач
    handleToggle, handleSave, handleDelete, handleShopToggle,
    handleImport,
    // Обработчики событий
    handleAddEvent, handleEditEvent, handleDeleteEvent,
    // Обработчики соцфич
    handleUpdateCh, handleUpdateSg,
    handleDeleteCh, handleDeleteSg,
    handleCreateCh, handleCreateSg,
  };
}
