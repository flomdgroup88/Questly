/**
 * UserContext — глобальный контекст профиля пользователя.
 *
 * Что даёт:
 *  - ProfileScreen больше не получает nickname/avatar/syncStatus через пропсы
 *  - SocialScreen читает nickname/avatar напрямую из контекста
 *  - Любой будущий компонент подключается одной строкой: useUser()
 *
 * Что НЕ лежит здесь (намеренно):
 *  - tasks, events, challenges — меняются часто, держим в App-стейте
 *  - notif-настройки — специфичны для ProfileScreen, передаём пропсами
 */

import {
  createContext, useContext, useState, useEffect,
  type ReactNode, type Dispatch, type SetStateAction,
} from "react";
import type { SyncStatus } from "../types.js";

// LS-ключ совпадает с constants.js
const LS_KEY = "questly_v2";

function persistUserFields(nickname: string, userAvatar: string) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    localStorage.setItem(LS_KEY, JSON.stringify({ ...existing, nickname, userAvatar }));
  } catch { /* ignore */ }
}

// ─── Форма контекста ────────────────────────────────────────────────
interface UserContextValue {
  nickname:     string;
  userAvatar:   string;
  syncStatus:   SyncStatus;
  setNickname:  Dispatch<SetStateAction<string>>;
  setUserAvatar: Dispatch<SetStateAction<string>>;
  setSyncStatus: Dispatch<SetStateAction<SyncStatus>>;
}

// ─── Создание контекста ─────────────────────────────────────────────
const UserContext = createContext<UserContextValue | null>(null);

// ─── Хук для потребителей ───────────────────────────────────────────
export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside <UserProvider>");
  return ctx;
}

// ─── Провайдер ──────────────────────────────────────────────────────
interface UserProviderProps {
  children:        ReactNode;
  initialNickname: string;
  initialAvatar:   string;
}

export function UserProvider({ children, initialNickname, initialAvatar }: UserProviderProps) {
  const [nickname,    setNickname]    = useState(initialNickname);
  const [userAvatar,  setUserAvatar]  = useState(initialAvatar);
  const [syncStatus,  setSyncStatus]  = useState<SyncStatus>("idle");

  // ── Сохраняем nickname и userAvatar в localStorage при каждом изменении ──
  useEffect(() => {
    persistUserFields(nickname, userAvatar);
  }, [nickname, userAvatar]);

  return (
    <UserContext.Provider value={{
      nickname, userAvatar, syncStatus,
      setNickname, setUserAvatar, setSyncStatus,
    }}>
      {children}
    </UserContext.Provider>
  );
}
