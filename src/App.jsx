import { useState, useEffect, useCallback, useRef, Component } from "react";
import { cloudSave } from "./firebase.js";
import { auth, logOut } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import AuthScreen from "./screens/AuthScreen.jsx";
import OverviewScreen from "./OverviewScreen.jsx";
import { T } from "./theme.js";
import { RANKS, RANK_ICONS } from "./constants.js";
import {
  lvlOf, progOf, today,
  loadState, saveState, loadSocial, saveSocial,
  autoRollover, spawnRecurring,
  INIT_TASKS, INIT_EVENTS, INIT_CHALLENGES, INIT_SHARED_GOALS,
} from "./utils.js";
import { XPBar } from "./components/ui.jsx";
import TaskModal from "./screens/TaskModal.jsx";
import TasksScreen from "./screens/TasksScreen.jsx";
import CalendarScreen from "./screens/CalendarScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import SocialScreen from "./screens/SocialScreen.jsx";
import { useNotifications } from "./hooks/useNotifications.js";
import { useTasks } from "./hooks/useTasks.js";
import { useCloudSync } from "./hooks/useCloudSync.js";
import { useMidnightRollover } from "./hooks/useMidnightRollover.js";

// ─── ERROR BOUNDARY ───────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(err, info) {
    console.error("⚠️ Questly ErrorBoundary:", err, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, padding: 32,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 52 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.rose }}>
            Что-то пошло не так
          </div>
          <div style={{ fontSize: 13, color: T.sub, maxWidth: 260 }}>
            {this.state.error?.message ?? "Неизвестная ошибка"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8, padding: "10px 28px", borderRadius: 14,
              border: "none", background: T.purp, color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── ONBOARDING ───────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    emoji: "⚔️",
    title: "Добро пожаловать в Questly!",
    text: "Это RPG-трекер задач: выполняй квесты, зарабатывай опыт и прокачивай своего героя.",
  },
  {
    emoji: "⚡",
    title: "XP и уровни",
    text: "За каждую выполненную задачу ты получаешь XP. Набирай очки — и твой герой растёт в уровнях.",
  },
  {
    emoji: "🤝",
    title: "Союзники рядом",
    text: "В разделе «Союзники» можно соревноваться с друзьями или вести общие списки дел. Начнём?",
  },
];

function OnboardingModal({ onDone }) {
  const [step, setStep] = useState(0);
  const s = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(7,7,28,0.92)", backdropFilter: "blur(6px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 32,
    }}>
      <div style={{
        background: T.bg1, borderRadius: 24, padding: "36px 28px 28px",
        width: "100%", maxWidth: 340, textAlign: "center",
        border: `1px solid ${T.brd}`, boxShadow: `0 0 60px ${T.purp}44`,
      }}>
        {/* Steps dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 8, height: 8, borderRadius: 4,
              background: i === step ? T.purp : T.brd,
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{s.emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 10, lineHeight: 1.3 }}>
          {s.title}
        </div>
        <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.6, marginBottom: 32 }}>
          {s.text}
        </div>
        <button
          onClick={() => isLast ? onDone() : setStep(s => s + 1)}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 16,
            border: "none", background: T.purp, color: "#fff",
            fontSize: 15, fontWeight: 800, cursor: "pointer",
            boxShadow: `0 4px 20px ${T.purp}66`,
          }}
        >
          {isLast ? "Начать приключение! ⚡" : "Далее →"}
        </button>
        {!isLast && (
          <button
            onClick={onDone}
            style={{
              marginTop: 12, background: "none", border: "none",
              color: T.dim, fontSize: 13, cursor: "pointer",
            }}
          >
            Пропустить
          </button>
        )}
      </div>
    </div>
  );
}

// ─── NICKNAME GATE ────────────────────────────────────────────────
const AVATAR_OPTIONS = ["🧙","🦊","🐼","🦁","🐯","🐸","🐧","🦄","🤖","👾","🧸","🦋","🐉","🦅","🐬","🧠"];

function NicknameGateModal({ onSave, onClose, initialAvatar }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(initialAvatar || AVATAR_OPTIONS[0]);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(7,7,28,0.88)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: T.bg1, borderRadius: 20, padding: "28px 24px",
        width: "100%", maxWidth: 340, border: `1px solid ${T.brd}`,
        boxShadow: `0 0 40px ${T.purp}33`,
      }}>
        <div style={{ fontSize: 52, textAlign: "center", marginBottom: 10, lineHeight: 1 }}>{avatar}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.purpL, textAlign: "center", marginBottom: 4 }}>
          Как тебя зовут?
        </div>
        <div style={{ fontSize: 13, color: T.sub, textAlign: "center", marginBottom: 16 }}>
          Имя и аватар будут видны друзьям в соревнованиях
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Выбери аватар</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
            {AVATAR_OPTIONS.map(em => (
              <div
                key={em}
                onClick={() => setAvatar(em)}
                style={{
                  aspectRatio: "1", borderRadius: 10, fontSize: 22,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  background: avatar === em ? T.purp + "44" : T.bg0,
                  border: `2px solid ${avatar === em ? T.purp : T.brd}`,
                  transition: "all 0.15s",
                }}
              >{em}</div>
            ))}
          </div>
        </div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && onSave(name.trim(), avatar)}
          placeholder="Твоё имя или никнейм…"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 12,
            background: T.bg0, border: `1px solid ${T.brd}`,
            color: T.text, fontSize: 15, outline: "none",
            marginBottom: 16, boxSizing: "border-box", colorScheme: "dark",
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 12,
              background: T.bg0, border: `1px solid ${T.brd}`,
              color: T.sub, fontSize: 14, cursor: "pointer",
            }}
          >
            Позже
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim(), avatar)}
            disabled={!name.trim()}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 12,
              background: name.trim() ? T.purp : T.bg0,
              border: "none", color: name.trim() ? "#fff" : T.dim,
              fontSize: 14, fontWeight: 700, cursor: name.trim() ? "pointer" : "default",
              transition: "all 0.2s",
            }}
          >
            Сохранить ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TELEGRAM WEBAPP INIT ─────────────────────────────────────────
const tg = typeof window !== "undefined" && window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#07071C");
  tg.setBackgroundColor("#07071C");
}

export default function App() {
  // ── Auth state ────────────────────────────────────────────────
  // undefined = ещё загружается, null = не залогинен, object = залогинен
  const [authReady,    setAuthReady]    = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);

  // Слушаем Firebase Auth: срабатывает сразу при монтировании
  // и потом каждый раз когда пользователь входит или выходит.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user ?? null);
      setAuthReady(true);
    });
    return unsub; // отписываемся при размонтировании
  }, []);

  const isTelegram = !!(tg && window.Telegram?.WebApp?.initDataUnsafe?.user?.id);

  // ── Logout ────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await logOut();
    // onAuthStateChanged сам обновит firebaseUser → null → покажется AuthScreen
  }, []);

  // useState(() => fn) — читает localStorage только один раз при монтировании,
  // а не при каждой перерисовке компонента.
  const [saved]    = useState(() => loadState());
  const [savedSoc] = useState(() => loadSocial());

  // Показываем онбординг только новым пользователям (нет сохранённых данных).
  const [showOnboarding,   setShowOnboarding]   = useState(() => !loadState());
  // Показываем окно никнейма перед входом в «Союзники», если имя не задано.
  const [showNicknameGate, setShowNicknameGate] = useState(false);

  // ── Задачи и XP — через хук ───────────────────────────────────────
  const {
    tasks, setTasks,
    xp, setXP,
    xpAnim, lvlUpAnim,
    handleToggle, handleSave, handleDelete, handleShopToggle,
  } = useTasks(
    saved?.tasks ?? INIT_TASKS,
    saved?.xp    ?? 340
  );

  const [events,   setEvts]     = useState(saved?.events   ?? INIT_EVENTS);
  const [nickname, setNickname] = useState(saved?.nickname ?? "");
  const [userAvatar, setUserAvatar] = useState(saved?.userAvatar ?? "🧙");
  const [tab,      setTab]      = useState("overview");
  const [overviewEditTask, setOverviewEditTask] = useState(null);

  const [challenges,  setChallenges]  = useState(savedSoc?.challenges  ?? INIT_CHALLENGES);
  const [sharedGoals, setSharedGoals] = useState(savedSoc?.sharedGoals ?? INIT_SHARED_GOALS);

  // ── Спаун повторяющихся задач при старте ─────────────────────────
  // Запускается один раз при монтировании (как componentDidMount).
  // events здесь — начальное значение из localStorage, не меняется в этом эффекте.
  // Если добавить [events] в deps, то при каждом новом событии все задачи пересчитаются — баг.
  useEffect(() => {
    setTasks((prev) => spawnRecurring(autoRollover(prev), events, today()));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Сохранение в localStorage при каждом изменении ───────────────
  // Один эффект на все данные — не разбиваем на несколько,
  // чтобы не делать две записи в хранилище за один цикл рендера.
  useEffect(() => {
    saveState({ xp, tasks, events, nickname, userAvatar, _savedAt: Date.now() });
    saveSocial({ challenges, sharedGoals });
  }, [xp, tasks, events, nickname, userAvatar, challenges, sharedGoals]);

  // ── Облачный синк — через хук ─────────────────────────────────────
  // ── Ключ пользователя для уведомлений (появляется после auth) ────
  const [notifUserKey, setNotifUserKey] = useState(null);

  const { syncStatus, syncIcon, isLoading, showOfflineToast } = useCloudSync({
    xp,
    tasks,
    events,
    nickname,
    savedLocalTime: saved?._savedAt ?? 0,
    onCloudLoaded: ({ tasks: t, events: e, xp: x, nickname: n }) => {
      if (t)          setTasks(t);
      if (e)          setEvts(e);
      if (x !== null) setXP(x);
      if (n)          setNickname(n);
      if (data?.userAvatar) setUserAvatar(data.userAvatar);
    },
  });

  // ── Полуночный перенос задач (00:00 МСК) ─────────────────────────
  // eventsRef держит свежий массив событий без перезапуска эффекта при каждом изменении.
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useMidnightRollover({ setTasks, eventsRef });

  // ── Ключ пользователя для FCM (async, после Firebase auth) ───────
  useEffect(() => {
    import("./firebase.js").then(({ initUserSync }) => {
      initUserSync().then(key => { if (key) setNotifUserKey(key); });
    });
  }, []);

  const {
    notifEnabled, reminderTime, permissionState, saving: notifSaving,
    foregroundNotif, enableNotifications, disableNotifications,
    updateReminderTime, dismissForeground,
  } = useNotifications(notifUserKey);

  // ── Импорт данных из JSON-файла ───────────────────────────────────
  const handleImport = useCallback((data) => {
    if (data.tasks)            setTasks(data.tasks);
    if (data.events)           setEvts(data.events);
    if (data.xp !== undefined) setXP(data.xp);
    if (data.nickname)         setNickname(data.nickname);
    if (data.userAvatar)       setUserAvatar(data.userAvatar);
  }, [setTasks, setXP]);

  // ── Обработчики событий ───────────────────────────────────────────
  const handleAddEvent = useCallback((ev, autoTasks) => {
    if (ev)             setEvts((p) => [ev, ...p]);
    if (autoTasks?.length) setTasks((p) => [...autoTasks, ...p]);
  }, [setTasks]);

  const handleEditEvent = useCallback((ev) => {
    setEvts((p) => {
      const i = p.findIndex((e) => e.id === ev.id);
      if (i === -1) return p;
      const updated = [...p];
      updated[i] = { ...p[i], ...ev };
      return updated;
    });
  }, []);

  const handleDeleteEvent = useCallback((id) => {
    setEvts((p) => p.filter((e) => e.id !== id));
    setTasks((p) => p.filter((t) => t.eventId !== id));
  }, [setTasks]);

  // ── Обработчики соцфич ───────────────────────────────────────────
  const handleUpdateCh = useCallback((id, updFn) => {
    setChallenges((p) => p.map((c) => (c.id === id ? updFn(c) : c)));
  }, []);

  const handleUpdateSg = useCallback((id, updFn) => {
    setSharedGoals((p) => p.map((s) => (s.id === id ? updFn(s) : s)));
  }, []);

  const handleDeleteCh = useCallback((id) => {
    setChallenges((p) => p.filter((c) => c.id !== id));
  }, []);

  const handleDeleteSg = useCallback((id) => {
    setSharedGoals((p) => p.filter((s) => s.id !== id));
  }, []);

  const handleCreateCh = useCallback((ch) => {
    const tgUser = typeof window !== "undefined"
      && window.Telegram?.WebApp?.initDataUnsafe?.user;
    const myName = nickname || ch._myName || tgUser?.first_name || "Создатель";
    const myTgId = tgUser?.id ? String(tgUser.id) : null;

    setChallenges((p) => [ch, ...p]);
    cloudSave("challenges", {
      ...ch,
      participants: [{
        name: myName,
        avatar: userAvatar,
        streak: 0,
        history: [],
        lastCompleted: null,
        ...(myTgId ? { tgId: myTgId } : {}),
      }],
    }).then((ok) => {
      if (!ok) console.error("⚠️ Не удалось сохранить соревнование.");
    });
  }, [nickname]);

  const handleCreateSg = useCallback((sg) => {
    setSharedGoals((p) => [sg, ...p]);
    cloudSave("sharedGoals", sg).then((ok) => {
      if (!ok) console.error("⚠️ Не удалось сохранить цель.");
    });
  }, []);

  // ── Смена вкладки с проверкой никнейма ───────────────────────────
  const handleTabChange = useCallback((id) => {
    if (id === "social" && !nickname) {
      setShowNicknameGate(true);
    } else {
      setTab(id);
    }
  }, [nickname]);

  // ─────────────────────────────────────────────────────────────────
  const level = lvlOf(xp);

  // ── Auth gate ─────────────────────────────────────────────────
  // Пока Firebase не ответил — показываем загрузку
  if (!authReady) return (
    <div style={{
      width: "100%", maxWidth: 420, margin: "0 auto",
      background: T.bg0, minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
      fontFamily: "'Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif",
    }}>
      <div style={{ fontSize: 48, animation: "sparkle 1.5s linear infinite" }}>⚡</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: T.purpL, letterSpacing: "-0.02em" }}>
        <span style={{ color: T.gold }}>Q</span>uestly
      </div>
    </div>
  );

  // Не в Telegram и не залогинен — показываем экран входа
  if (!firebaseUser && !isTelegram) return (
    <div style={{
      width: "100%", maxWidth: 420, margin: "0 auto",
      background: T.bg0, minHeight: "100vh",
      fontFamily: "'Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif",
      color: T.text, display: "flex", flexDirection: "column",
    }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <AuthScreen />
    </div>
  );

  const TABS = [
    { id: "overview", label: "Главная",   icon: "🏠" },
    { id: "tasks",    label: "Квесты",    icon: "⚔️" },
    { id: "calendar", label: "Календарь", icon: "📅" },
    { id: "social",   label: "Союзники",  icon: "🤝" },
    { id: "profile",  label: "Герой",     icon: "🧙" },
  ];

  return (
    <div style={{
      width: "100%", maxWidth: 420, margin: "0 auto",
      background: T.bg0, minHeight: "100vh", maxHeight: "100vh",
      fontFamily: "'Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif",
      color: T.text, display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.7);cursor:pointer;}
        input[type=date]{color-scheme:dark;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:${T.brd};border-radius:2px;}
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes xpFloat{0%{opacity:0;transform:translateY(10px) scale(.7)}15%{opacity:1;transform:translateY(-5px) scale(1.2)}70%{opacity:1;transform:translateY(-50px) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(.8)}}
        @keyframes lvlGlow{0%,100%{opacity:0;transform:scale(.8)}20%,80%{opacity:1;transform:scale(1)}}
        @keyframes sparkle{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.1)}100%{transform:rotate(360deg) scale(1)}}
        @keyframes toastSlide{0%{opacity:0;transform:translateX(-50%) translateY(20px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}85%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(10px)}}
      `}</style>

      {/* Онбординг для новых пользователей */}
      {showOnboarding && (
        <OnboardingModal onDone={() => setShowOnboarding(false)} />
      )}

      {/* Foreground push-баннер */}
      {foregroundNotif && (
        <div onClick={dismissForeground} style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, maxWidth: 340, width: "calc(100% - 32px)",
          background: "linear-gradient(135deg,#1a1a3e,#2a1a4e)",
          border: "1px solid rgba(139,92,246,0.4)",
          borderRadius: 16, padding: "14px 18px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start",
          animation: "slideDown 0.3s ease",
        }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>🗡️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#e8d5ff", marginBottom: 2 }}>
              {foregroundNotif.title}
            </div>
            <div style={{ fontSize: 13, color: "rgba(232,213,255,0.7)", lineHeight: 1.4 }}>
              {foregroundNotif.body}
            </div>
          </div>
          <div style={{ fontSize: 16, color: "rgba(232,213,255,0.4)", flexShrink: 0 }}>✕</div>
        </div>
      )}

      {/* Гейт никнейма перед «Союзниками» */}
      {showNicknameGate && (
        <NicknameGateModal
          initialAvatar={userAvatar}
          onSave={(name, av) => {
            setNickname(name);
            setUserAvatar(av);
            setShowNicknameGate(false);
            setTab("social");
          }}
          onClose={() => {
            setShowNicknameGate(false);
            setTab("social");
          }}
        />
      )}

      {/* ── Экран загрузки ── показываем пока Firebase не ответил ─── */}
      {isLoading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 500,
          background: T.bg0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
        }}>
          <div style={{ fontSize: 48, animation: "sparkle 1.5s linear infinite" }}>⚡</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.purpL, letterSpacing: "-0.02em" }}>
            <span style={{ color: T.gold }}>Q</span>uestly
          </div>
          <div style={{ fontSize: 13, color: T.sub }}>Загружаем твои квесты…</div>
        </div>
      )}

      {/* ── Тост «нет интернета» ──────────────────────────────────── */}
      {showOfflineToast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%",
          transform: "translateX(-50%)",
          zIndex: 400, pointerEvents: "none",
          animation: "toastSlide 4s ease forwards",
          background: T.bg1, border: `1px solid ${T.rose}55`,
          borderRadius: 24, padding: "10px 18px",
          display: "flex", alignItems: "center", gap: 8,
          whiteSpace: "nowrap", boxShadow: `0 4px 20px #0008`,
        }}>
          <span style={{ fontSize: 16 }}>📶</span>
          <span style={{ fontSize: 13, color: T.sub }}>
            Нет соединения — данные сохранены локально
          </span>
        </div>
      )}

      {/* Анимация +XP / −XP */}
      {xpAnim && (
        <div style={{
          position: "fixed", top: "25%", left: "50%", transform: "translateX(-50%)",
          zIndex: 300, pointerEvents: "none", textAlign: "center",
          animation: "xpFloat 2.2s ease forwards",
        }}>
          <div style={{
            fontSize: 32, fontWeight: 900,
            color: xpAnim.negative ? T.rose : T.gold,
            textShadow: xpAnim.negative
              ? `0 0 30px ${T.rose},0 0 60px ${T.rose}88`
              : `0 0 30px ${T.gold},0 0 60px ${T.gold}88`,
          }}>
            {xpAnim.negative ? "−" : "+"}{xpAnim.amount} XP
          </div>
          <div style={{ fontSize: 14, color: xpAnim.negative ? T.rose : T.goldL, marginTop: 2 }}>
            {xpAnim.negative ? "↩️ Квест отменён" : "✨ Квест выполнен!"}
          </div>
        </div>
      )}

      {/* Анимация нового уровня */}
      {lvlUpAnim && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "lvlGlow 3s ease forwards", background: "rgba(139,92,246,0.15)",
        }}>
          <div style={{
            background: T.bg1, border: `2px solid ${T.gold}`, borderRadius: 20,
            padding: "28px 40px", textAlign: "center", boxShadow: `0 0 60px ${T.purp}88`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 8, animation: "sparkle 1s ease" }}>⭐</div>
            <div style={{ fontSize: 13, color: T.sub, textTransform: "uppercase", letterSpacing: "0.1em" }}>Новый уровень</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: T.gold }}>Уровень {level}</div>
            <div style={{ fontSize: 16, color: T.purpL, marginTop: 4 }}>
              {RANKS[Math.min(level - 1, RANKS.length - 1)]}
            </div>
          </div>
        </div>
      )}

      {/* Шапка (скрыта на overview и calendar) */}
      {tab !== "calendar" && tab !== "overview" && (
        <div style={{ padding: `calc(14px + env(safe-area-inset-top,0px)) 16px 12px`, background: T.bg1, borderBottom: `1px solid ${T.brd}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em" }}>
                <span style={{ color: T.gold }}>Q</span>
                <span style={{ color: T.text }}>uestly</span>
              </div>
              <div style={{ fontSize: 11, color: T.sub, letterSpacing: "0.05em" }}>RPG-трекер задач</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginBottom: 4 }}>
                {syncIcon && (
                  <span style={{ fontSize: 11, color: syncStatus === "error" ? T.rose : T.teal }}>
                    {syncIcon}
                  </span>
                )}
                <span style={{ fontSize: 11, color: T.sub }}>Ур.{level}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.purpL }}>
                  {RANK_ICONS[Math.min(level - 1, RANK_ICONS.length - 1)]} {RANKS[Math.min(level - 1, RANKS.length - 1)]}
                </span>
              </div>
              <span style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>⚡ {xp.toLocaleString()} XP</span>
            </div>
          </div>
          <XPBar progress={progOf(xp)} height={5} />
        </div>
      )}

      {/* Основной контент */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        <ErrorBoundary key={tab}>
          {tab === "overview"  && <OverviewScreen tasks={tasks} xp={xp} level={level} rank={RANKS[Math.min(level - 1, RANKS.length - 1)]} rankIcon={RANK_ICONS[Math.min(level - 1, RANK_ICONS.length - 1)]} xpProgress={progOf(xp)} onEditTask={setOverviewEditTask} onToggle={handleToggle} />}
          {tab === "tasks"     && <TasksScreen tasks={tasks} onToggle={handleToggle} onSave={handleSave} onDelete={handleDelete} onShopToggle={handleShopToggle} />}
          {tab === "calendar"  && <CalendarScreen events={events} tasks={tasks} onAddEvent={handleAddEvent} onEditEvent={handleEditEvent} onDeleteEvent={handleDeleteEvent} />}
          {tab === "social"    && <SocialScreen nickname={nickname} userAvatar={userAvatar} challenges={challenges} sharedGoals={sharedGoals} onUpdateCh={handleUpdateCh} onUpdateSg={handleUpdateSg} onDeleteCh={handleDeleteCh} onDeleteSg={handleDeleteSg} onCreateCh={handleCreateCh} onCreateSg={handleCreateSg} />}
          {tab === "profile"   && <ProfileScreen xp={xp} tasks={tasks} events={events} nickname={nickname} onSetNickname={setNickname} userAvatar={userAvatar} onSetAvatar={setUserAvatar} syncStatus={syncStatus} onImport={handleImport} onLogout={handleLogout} notifEnabled={notifEnabled} reminderTime={reminderTime} permissionState={permissionState} notifSaving={notifSaving} onEnableNotif={enableNotifications} onDisableNotif={disableNotifications} onUpdateReminderTime={updateReminderTime} />}
        </ErrorBoundary>
      </div>

      {/* Нижняя навигация */}
      <div style={{ display: "flex", background: T.bg1, borderTop: `1px solid ${T.brd}`, flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom,8px)" }}>
        {TABS.map((t) => (
          <div
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            style={{ flex: 1, padding: "10px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
          >
            <div style={{ fontSize: 22, transform: tab === t.id ? "scale(1.15)" : "scale(1)", transition: "transform 0.2s cubic-bezier(.34,1.56,.64,1)" }}>
              {t.icon}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", color: tab === t.id ? T.purpL : T.dim, transition: "color 0.2s" }}>
              {t.label}
            </div>
            {tab === t.id && <div style={{ width: 20, height: 3, borderRadius: 2, background: T.purp, marginTop: 1 }} />}
          </div>
        ))}
      </div>

      {/* Редактирование задачи с главного экрана */}
      {overviewEditTask && (
        <TaskModal
          existing={overviewEditTask}
          onClose={() => setOverviewEditTask(null)}
          onSave={(t) => { handleSave(t); setOverviewEditTask(null); }}
          onDelete={(id) => { handleDelete(id); setOverviewEditTask(null); }}
        />
      )}
    </div>
  );
}
