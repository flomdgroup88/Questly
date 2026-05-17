// ─── types.ts — единственный источник правды о форме данных ─────
// Импортируй нужные типы в .ts/.tsx файлах вместо того, чтобы
// угадывать структуру объекта по коду.

// ─── ОБЩИЕ ───────────────────────────────────────────────────────
/** Период задачи: день / неделя / месяц / год */
export type Period = "day" | "week" | "month" | "year";

/** Тип повторения: ежедневно / еженедельно / ежегодно / без повторения */
export type RecurType = "day" | "week" | "year" | "";

// ─── ЗАДАЧИ ──────────────────────────────────────────────────────
export interface ShopItem {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  period: Period;
  xp: number;
  done: boolean;
  /** Дата дедлайна в формате "YYYY-MM-DD" */
  dueDate: string;
  recurring: boolean;
  recurType: RecurType;
  streakEnabled: boolean;
  streak: number;
  /** ID задачи-шаблона — связывает все экземпляры повторяющейся задачи */
  templateId?: string;
  /** ID события, к которому привязана задача */
  eventId?: string;
  /** true если задача была перенесена при rollover */
  rolledOver?: boolean;
  /** Пункты списка покупок */
  shopItems?: ShopItem[];
  note?: string;
  /** Приоритет: обычная / важная / срочная */
  priority?: "normal" | "important" | "urgent";
}

// ─── СОБЫТИЯ ─────────────────────────────────────────────────────
export type EventType =
  | "birthday"
  | "meeting"
  | "trip"
  | "deadline"
  | "holiday"
  | "health"
  | "custom";

export interface QuestlyEvent {
  id: string;
  title: string;
  /** Дата события в формате "YYYY-MM-DD" */
  date: string;
  recurring: boolean;
  recurType: RecurType;
  isBirthday: boolean;
  color: string;
  eventType: EventType;
}

// ─── СОЦИАЛЬНЫЕ ФУНКЦИИ ───────────────────────────────────────────
export interface Participant {
  name: string;
  avatar: string;
  streak: number;
  lastCompleted: string | null;
  history: string[];
  tgId?: string;
}

export interface Challenge {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  shareCode: string;
  recurType: RecurType;
  createdAt: string;
  myStreak: number;
  myHistory: string[];
  participants: Participant[];
}

export interface SharedGoalItem {
  id: string;
  title: string;
  assignedTo: string | null;
  doneBy: string | null;
  done: boolean;
}

export interface SharedGoal {
  id: string;
  title: string;
  emoji: string;
  shareCode: string;
  createdAt: string;
  participants: string[];
  items: SharedGoalItem[];
}

// ─── СОСТОЯНИЕ ПРИЛОЖЕНИЯ ─────────────────────────────────────────
export interface AppState {
  xp: number;
  tasks: Task[];
  events: QuestlyEvent[];
  nickname: string;
  userAvatar: string;
  /** Timestamp последнего сохранения — используется для сравнения с облаком */
  _savedAt: number;
}

export interface SocialState {
  challenges: Challenge[];
  sharedGoals: SharedGoal[];
}

// ─── ОБЛАЧНЫЙ СИНК ───────────────────────────────────────────────
export type SyncStatus = "idle" | "saving" | "saved" | "error";
