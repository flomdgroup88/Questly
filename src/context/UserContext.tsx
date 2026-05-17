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
  createContext, useContext, useState, useCallback,
  type ReactNode, type Dispatch, type SetStateAction,
} from "react";
import type { SyncStatus } from "../types.js";

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
  children:       ReactNode;
  initialNickname: string;
  initialAvatar:   string;
}

export function UserProvider({ children, initialNickname, initialAvatar }: UserProviderProps) {
  const [nickname,    setNickname]    = useState(initialNickname);
  const [userAvatar,  setUserAvatar]  = useState(initialAvatar);
  const [syncStatus,  setSyncStatus]  = useState<SyncStatus>("idle");

  return (
    <UserContext.Provider value={{
      nickname, userAvatar, syncStatus,
      setNickname, setUserAvatar, setSyncStatus,
    }}>
      {children}
    </UserContext.Provider>
  );
}
