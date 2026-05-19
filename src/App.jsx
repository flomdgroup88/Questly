/**
 * App.jsx — точка входа приложения.
 *
 * БЫЛО: 739 строк — стейт, хуки, 3 inline-компонента, вся логика.
 * СТАЛО: ~180 строк — только монтаж, роутинг вкладок, оверлеи.
 *
 * Что куда вынесено:
 *  • ErrorBoundary       → src/components/ErrorBoundary.tsx
 *  • OnboardingModal     → src/components/OnboardingModal.tsx
 *  • NicknameGateModal   → src/components/NicknameGateModal.tsx
 *  • Весь стейт + хуки   → src/hooks/useAppState.ts
 *  • nickname / avatar   → src/context/UserContext.tsx
 */

import { useState, useCallback, useEffect } from "react";
import { T, applyTheme, loadThemeIsDark } from "./theme.js";
import { RANKS, RANK_ICONS } from "./constants.js";
import { lvlOf, progOf, loadState } from "./utils";
import { initUserSync, cloudPublishProfile } from "./firebase.js";
import { XPBar }             from "./components/ui.jsx";
import { ErrorBoundary }     from "./components/ErrorBoundary";
import { OnboardingModal }   from "./components/OnboardingModal";
import { NicknameGateModal } from "./components/NicknameGateModal";
import { UserProvider, useUser } from "./context/UserContext";
import { useAppState }       from "./hooks/useAppState";
import { useAchievements }   from "./hooks/useAchievements";
import { AchievementToast }  from "./components/AchievementToast.jsx";
import AuthScreen            from "./screens/AuthScreen.jsx";
import OverviewScreen        from "./OverviewScreen.jsx";
import TaskModal             from "./screens/TaskModal.jsx";
import TasksScreen           from "./screens/TasksScreen.jsx";
import CalendarScreen        from "./screens/CalendarScreen.jsx";
import ProfileScreen         from "./screens/ProfileScreen.jsx";
import SocialScreen          from "./screens/SocialScreen.jsx";

// ─── Telegram WebApp init ──────────────────────────────────────────────
const tg = typeof window !== "undefined" && window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor("#07071C"); tg.setBackgroundColor("#07071C"); }

const TABS = [
  { id: "overview",  label: "Главная",   icon: "🏠" },
  { id: "tasks",     label: "Квесты",    icon: "⚔️" },
  { id: "calendar",  label: "Календарь", icon: "📅" },
  { id: "social",    label: "Союзники",  icon: "🤝" },
  { id: "profile",   label: "Герой",     icon: "🧙" },
];

// ─── Внутренний компонент — читает UserContext ─────────────────────────
function AppInner() {
  const { nickname, userAvatar, setNickname, setUserAvatar } = useUser();

  // ── Тема ──────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    const d = loadThemeIsDark();
    applyTheme(d);
    return d;
  });
  const toggleTheme = () => {
    const next = !isDark;
    applyTheme(next);
    setIsDark(next);
    if (tg) {
      const bg = next ? "#07071C" : "#FBFAFF";
      tg.setHeaderColor(bg);
      tg.setBackgroundColor(bg);
    }
  };

  const {
    authReady, firebaseUser, handleLogout,
    tasks, events, challenges, sharedGoals,
    xp, xpAnim, lvlUpAnim,
    syncStatus, syncIcon, isLoading, showOfflineToast, syncErrorCode,
    notif,
    loginBonus,
    tab, setTab,
    showOnboarding, setShowOnboarding,
    showGlobalCreate, setShowGlobalCreate,
    showNicknameGate, setShowNicknameGate,
    overviewEditTask, setOverviewEditTask,
    handleToggle, handleSave, handleDelete, handleShopToggle,
    handleReorder,
    handleImport,
    handleAddEvent, handleEditEvent, handleDeleteEvent,
    handleUpdateCh, handleUpdateSg,
    handleDeleteCh, handleDeleteSg,
    handleCreateCh, handleCreateSg,
  } = useAppState();

  const isTelegram  = !!(tg && window.Telegram?.WebApp?.initDataUnsafe?.user?.id);
  // Анонимный вход (initUserSync) не считается настоящим — пользователь должен
  // зарегистрироваться через email/пароль или зайти через Telegram.
  const isRealUser  = !!(firebaseUser && !firebaseUser.isAnonymous);
  const level      = lvlOf(xp);

  // ── Ачивки ────────────────────────────────────────────────────────
  const { achievementQueue, dismissAchievement } = useAchievements({
    tasks, xp, events, challenges, isLoading,
  });

  // Публикуем профиль в Firestore при изменении никнейма, аватара или соревнований.
  // Используем debounce 2 сек чтобы не спамить при быстрых изменениях.
  useEffect(() => {
    if (!nickname) return;
    const timer = setTimeout(() => {
      initUserSync().then(key => {
        if (key) cloudPublishProfile(key, nickname, userAvatar, challenges);
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [nickname, userAvatar, challenges]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback((id) => {
    if (id === "social" && !nickname) setShowNicknameGate(true);
    else setTab(id);
  }, [nickname, setShowNicknameGate, setTab]);

  const shellStyle = {
    width: "100%", maxWidth: 420, margin: "0 auto",
    background: T.bg0, minHeight: "100vh",
    fontFamily: "'Nunito','Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif",
    color: T.text, display: "flex", flexDirection: "column",
  };

  if (!authReady) return (
    <div style={{ ...shellStyle, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ fontSize: 48, animation: "sparkle 1.5s linear infinite" }}>⚡</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: T.purpL }}>
        <span style={{ color: T.gold }}>Q</span>uestly
      </div>
    </div>
  );

  // Не авторизован — сначала регистрация / вход
  if (!isRealUser && !isTelegram) return (
    <div style={shellStyle}><AuthScreen /></div>
  );

  // Авторизован, но онбординг ещё не показывали — показываем после входа
  if (!isTelegram && showOnboarding) return (
    <div style={shellStyle}>
      <OnboardingModal
        onDone={() => {
          localStorage.setItem("questly_onboarding_done", "1");
          setShowOnboarding(false);
        }}
        onCreateFirst={() => {
          localStorage.setItem("questly_onboarding_done", "1");
          setShowOnboarding(false);
        }}
      />
    </div>
  );

  return (
    <div style={{ ...shellStyle, maxHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:${isDark?"invert(0.7)":"invert(0.3)"};cursor:pointer;}
        input[type=date]{color-scheme:${isDark?"dark":"light"};}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:${T.brd};border-radius:2px;}
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes xpFloat{0%{opacity:0;transform:translateY(10px) scale(.7)}15%{opacity:1;transform:translateY(-5px) scale(1.2)}70%{opacity:1;transform:translateY(-50px) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(.8)}}
        @keyframes lvlGlow{0%,100%{opacity:0;transform:scale(.8)}20%,80%{opacity:1;transform:scale(1)}}
        @keyframes sparkle{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.1)}100%{transform:rotate(360deg) scale(1)}}
        @keyframes toastSlide{0%{opacity:0;transform:translateX(-50%) translateY(20px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}85%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(10px)}}
        @keyframes bonusSlide{0%{opacity:0;transform:translateX(-50%) translateY(-32px) scale(0.9)}12%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}80%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-16px) scale(0.95)}}
      `}</style>

      {showNicknameGate && (
        <NicknameGateModal
          onDone={() => { setShowNicknameGate(false); setTab("social"); }}
          onClose={() => { setShowNicknameGate(false); setTab("social"); }}
        />
      )}
      {isLoading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: T.bg0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 48, animation: "sparkle 1.5s linear infinite" }}>⚡</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.purpL }}><span style={{ color: T.gold }}>Q</span>uestly</div>
          <div style={{ fontSize: 13, color: T.sub }}>Загружаем твои квесты…</div>
        </div>
      )}
      {showOfflineToast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 400, pointerEvents: "none", animation: "toastSlide 4s ease forwards", background: T.bg1, border: `1px solid ${T.rose}55`, borderRadius: 24, padding: "10px 18px", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", boxShadow: "0 4px 20px #0008" }}>
          <span>📶</span><span style={{ fontSize: 13, color: T.sub }}>
            {syncErrorCode === "permission-denied"
              ? "Ошибка доступа — перезайди в аккаунт"
              : syncErrorCode === "resource-exhausted"
              ? "Лимит Firebase исчерпан — сохранится позже"
              : syncErrorCode === "unauthenticated"
              ? "Сессия истекла — войди заново"
              : syncErrorCode && syncErrorCode !== "unknown"
              ? `Ошибка синка: ${syncErrorCode}`
              : "Нет соединения — данные сохранены локально"}
          </span>
        </div>
      )}
      {notif.foregroundNotif && (
        <div onClick={notif.dismissForeground} style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, maxWidth: 340, width: "calc(100% - 32px)", background: T.bg2, border: `1px solid ${T.purp}55`, borderRadius: 16, padding: "14px 18px", boxShadow: `0 8px 32px ${T.purp}33`, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>🗡️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 2 }}>{notif.foregroundNotif.title}</div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.4 }}>{notif.foregroundNotif.body}</div>
          </div>
          <div style={{ color: T.dim }}>✕</div>
        </div>
      )}

      {loginBonus && (
        <div style={{ position: "fixed", top: 20, left: "50%", zIndex: 9000, pointerEvents: "none", animation: "bonusSlide 4.5s ease forwards", background: `linear-gradient(135deg, ${T.bg2}, ${T.bg3})`, border: `1px solid ${T.gold}66`, borderRadius: 20, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: `0 4px 24px ${T.bg0}88, 0 0 24px ${T.gold}33`, whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 32, flexShrink: 0 }}>
            {loginBonus.streak >= 7 ? "🔥" : loginBonus.streak >= 3 ? "✨" : "☀️"}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.gold, marginBottom: 2 }}>
              Бонус за вход · День {loginBonus.streak}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>
              +{loginBonus.xp} XP
              {loginBonus.streak > 1 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: T.goldL, marginLeft: 8 }}>
                  🔥 {loginBonus.streak}-дневная серия!
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {xpAnim && (
        <div style={{ position: "fixed", top: "25%", left: "50%", transform: "translateX(-50%)", zIndex: 300, pointerEvents: "none", textAlign: "center", animation: "xpFloat 2.2s ease forwards" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: xpAnim.negative ? T.rose : T.gold }}>
            {xpAnim.negative ? "−" : "+"}{xpAnim.amount} XP
          </div>
          <div style={{ fontSize: 14, color: xpAnim.negative ? T.rose : T.goldL, marginTop: 2 }}>
            {xpAnim.negative ? "↩️ Квест отменён" : xpAnim.bonus ? "☀️ Бонус за вход!" : "✨ Квест выполнен!"}
          </div>
        </div>
      )}
      {lvlUpAnim && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", animation: "lvlGlow 3s ease forwards", background: `${T.purp}26` }}>
          <div style={{ background: T.bg1, border: `2px solid ${T.gold}`, borderRadius: 20, padding: "28px 40px", textAlign: "center", boxShadow: `0 0 60px ${T.purp}88` }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⭐</div>
            <div style={{ fontSize: 13, color: T.sub, textTransform: "uppercase", letterSpacing: "0.1em" }}>Новый уровень</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: T.gold }}>Уровень {level}</div>
            <div style={{ fontSize: 16, color: T.purpL, marginTop: 4 }}>{RANKS[Math.min(level - 1, RANKS.length - 1)]}</div>
          </div>
        </div>
      )}

      {tab !== "calendar" && tab !== "overview" && (
        <div style={{ padding: `calc(14px + env(safe-area-inset-top,0px)) 16px 12px`, background: T.bg1, borderBottom: `1px solid ${T.brd}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}><span style={{ color: T.gold }}>Q</span><span style={{ color: T.text }}>uestly</span></div>
              <div style={{ fontSize: 11, color: T.sub }}>RPG-трекер задач</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginBottom: 4 }}>
                {syncIcon && <span style={{ fontSize: 11, color: syncStatus === "error" ? T.rose : T.teal }}>{syncIcon}</span>}
                <span style={{ fontSize: 11, color: T.sub }}>Ур.{level}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.purpL }}>{RANK_ICONS[Math.min(level - 1, RANK_ICONS.length - 1)]} {RANKS[Math.min(level - 1, RANKS.length - 1)]}</span>
              </div>
              <span style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>⚡ {xp.toLocaleString()} XP</span>
            </div>
          </div>
          <XPBar progress={progOf(xp)} height={5} />
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <ErrorBoundary key={tab}>
          {tab === "overview"  && <OverviewScreen tasks={tasks} xp={xp} level={level} rank={RANKS[Math.min(level-1,RANKS.length-1)]} rankIcon={RANK_ICONS[Math.min(level-1,RANK_ICONS.length-1)]} xpProgress={progOf(xp)} onEditTask={setOverviewEditTask} onToggle={handleToggle} />}
          {tab === "tasks"     && <TasksScreen    tasks={tasks} onToggle={handleToggle} onSave={handleSave} onDelete={handleDelete} onShopToggle={handleShopToggle} onReorder={handleReorder} />}
          {tab === "calendar"  && <CalendarScreen events={events} tasks={tasks} onAddEvent={handleAddEvent} onEditEvent={handleEditEvent} onDeleteEvent={handleDeleteEvent} onSaveTask={handleSave} onDeleteTask={handleDelete} />}
          {tab === "social"    && <SocialScreen   challenges={challenges} sharedGoals={sharedGoals} onUpdateCh={handleUpdateCh} onUpdateSg={handleUpdateSg} onDeleteCh={handleDeleteCh} onDeleteSg={handleDeleteSg} onCreateCh={handleCreateCh} onCreateSg={handleCreateSg} nickname={nickname} userAvatar={userAvatar} xp={xp} tasks={tasks} />}
          {tab === "profile"   && <ProfileScreen  xp={xp} tasks={tasks} events={events} challenges={challenges} nickname={nickname} userAvatar={userAvatar} onSetNickname={setNickname} onSetAvatar={setUserAvatar} onImport={handleImport} onLogout={handleLogout} notifEnabled={notif.notifEnabled} reminderTime={notif.reminderTime} permissionState={notif.permissionState} notifSaving={notif.saving} onEnableNotif={notif.enableNotifications} onDisableNotif={notif.disableNotifications} onUpdateReminderTime={notif.updateReminderTime} isDark={isDark} onToggleTheme={toggleTheme} />}
        </ErrorBoundary>
      </div>

      <div style={{ display: "flex", background: T.bg1, borderTop: `1px solid ${T.brd}`, flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom,8px)" }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => handleTabChange(t.id)} style={{ flex: 1, padding: "10px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ fontSize: 22, transform: tab === t.id ? "scale(1.15)" : "scale(1)", transition: "transform 0.2s cubic-bezier(.34,1.56,.64,1)" }}>{t.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: tab === t.id ? T.purpL : T.dim }}>{t.label}</div>
            {tab === t.id && <div style={{ width: 20, height: 3, borderRadius: 2, background: T.purp }} />}
          </div>
        ))}
      </div>

      {achievementQueue.length > 0 && (
        <AchievementToast
          key={achievementQueue[0].label}
          achievement={achievementQueue[0]}
          onDismiss={dismissAchievement}
          queueLength={achievementQueue.length - 1}
        />
      )}

      {showGlobalCreate && <TaskModal onClose={() => setShowGlobalCreate(false)} onSave={t => { handleSave(t); setShowGlobalCreate(false); }} />}
      {overviewEditTask  && <TaskModal existing={overviewEditTask} onClose={() => setOverviewEditTask(null)} onSave={t => { handleSave(t); setOverviewEditTask(null); }} onDelete={id => { handleDelete(id); setOverviewEditTask(null); }} />}
    </div>
  );
}

// ─── Корень — оборачиваем в UserProvider ──────────────────────────────
export default function App() {
  const saved = loadState();
  return (
    <UserProvider initialNickname={saved?.nickname ?? ""} initialAvatar={saved?.userAvatar ?? "🧙"}>
      <AppInner />
    </UserProvider>
  );
}
