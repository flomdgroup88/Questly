// utils.ts — вся вспомогательная логика с TypeScript-типами.
// Этот файл заменяет utils.js.

import { XP_TABLE, RANKS, EVENT_TYPES, LS, LS_SOC } from "./constants.js";
import type { Task, QuestlyEvent, AppState, SocialState } from "./types.js";

// ─── ЛОКАЛЬНОЕ ВРЕМЯ ─────────────────────────────────────────────
// Используем местное время устройства (а не жёстко UTC+3).
// getTimezoneOffset() возвращает разницу UTC−local в минутах,
// поэтому берём со знаком минус чтобы получить смещение east-of-UTC.
const getLocalOffsetMs = (): number => -new Date().getTimezoneOffset() * 60 * 1000;

// Возвращает Date, у которого UTC-поля совпадают с локальными полями устройства.
const localNow = (): Date => new Date(Date.now() + getLocalOffsetMs());

// Форматирует Date (с локальными полями) в строку "YYYY-MM-DD".
const fmtLocal = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

// ─── ДАТА-ХЕЛПЕРЫ ────────────────────────────────────────────────
export const todayStr    = (): string => fmtLocal(localNow());
export const tomorrowStr = (): string => { const d = localNow(); d.setUTCDate(d.getUTCDate() + 1); return fmtLocal(d); };
export const fmtDate     = (s: string): string => { const [y, m, d] = s.split("-"); return `${d}.${m}.${y}`; };
export const uid         = (): string => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const endOfWeek  = (): string => { const d = localNow(); const dow = d.getUTCDay(); const diff = dow === 0 ? 0 : 7 - dow; d.setUTCDate(d.getUTCDate() + diff); return fmtLocal(d); };
export const endOfMonth = (): string => { const d = localNow(); d.setUTCMonth(d.getUTCMonth() + 1, 0); return fmtLocal(d); };
export const endOfYear  = (): string => `${localNow().getUTCFullYear()}-12-31`;
export const defaultDueForPeriod = (p: string): string =>
  p === "week" ? endOfWeek() : p === "month" ? endOfMonth() : p === "year" ? endOfYear() : todayStr();

export const isInCurrentWeek = (s: string): boolean => {
  const d   = new Date(s + "T12:00:00Z");
  const now = localNow();
  const dow = now.getUTCDay();
  const mon = new Date(now); mon.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1)); mon.setUTCHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6); sun.setUTCHours(23, 59, 59, 999);
  return d >= mon && d <= sun;
};
export const isInCurrentMonth = (s: string): boolean => {
  const d = new Date(s + "T12:00:00Z"); const now = localNow();
  return d.getUTCMonth() === now.getUTCMonth() && d.getUTCFullYear() === now.getUTCFullYear();
};
export const isInCurrentYear = (s: string): boolean => {
  const d = new Date(s + "T12:00:00Z"); return d.getUTCFullYear() === localNow().getUTCFullYear();
};

// daysLeft считает по местному времени устройства.
//
// БЫЛО: Math.ceil((endOfDayUTC - now) / 86400000)
//   Баг: Math.ceil(0.5) = 1, поэтому сегодняшняя дата большую
//   часть дня возвращала «1 дн.» вместо «сегодня».
//
// СТАЛО: сравниваем ISO-строки дат напрямую — проще и правильно,
//   так как todayStr() и s используют одну и ту же локальную timezone.
export const daysLeft = (s: string): string => {
  const todayDate = todayStr();
  if (s === todayDate) return "сегодня";
  if (s < todayDate)  return "просрочено";
  const diff = Math.round(
    (new Date(s + "T00:00:00Z").getTime() - new Date(todayDate + "T00:00:00Z").getTime())
    / 86400000
  );
  return `${diff} дн.`;
};

export const pastDay = (n: number): string => { const d = localNow(); d.setUTCDate(d.getUTCDate() - n); return fmtLocal(d); };
export const mkCode  = (): string => Math.random().toString(36).slice(2, 8).toUpperCase();

// Миллисекунды до следующей локальной полуночи — используется хуком полуночного переноса.
export const msUntilLocalMidnight = (): number => {
  const now    = Date.now();
  const offset = getLocalOffsetMs();
  const local  = new Date(now + offset);
  // Следующая полночь по местному времени в терминах UTC
  const nextMidnightUTC =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - offset;
  return nextMidnightUTC - now;
};

/** @deprecated используйте msUntilLocalMidnight */
export const msUntilMoscowMidnight = msUntilLocalMidnight;

// ─── СТРОКИ ──────────────────────────────────────────────────────
// БЫЛО: /\bдр\b/ — \b не работает с кириллицей (только ASCII-границы).
// СТАЛО: (?:^|[^\p{L}])...(?:[^\p{L}]|$) с флагом u — правильные Unicode-границы.
export const isBdTitle = (t: string): boolean =>
  /(?:^|[^\p{L}])др(?:[^\p{L}]|$)|день рождения|днюха|birthday/iu.test(t);
export const bdName    = (t: string): string => {
  const m = t.match(/(?:др|день рождения|днюха|birthday)[:\s]+(.+)/i)
          || t.match(/(.+?)[\s,–-]+(?:др|день рождения|днюха)/i);
  return m ? m[1].trim() : t.trim();
};

// ─── XP / УРОВЕНЬ ────────────────────────────────────────────────
//
// БЫЛО (медленно):
//   [...XP_TABLE].reverse().findIndex(...) — создаёт новый массив на каждый вызов,
//   вызывается дважды, итого 2 аллокации при каждом рендере.
//
// СТАЛО (быстро):
//   Простой цикл — O(n) без аллокаций, выходит при первом несовпадении.
//   XP_TABLE отсортирован по возрастанию, поэтому идём слева направо
//   и останавливаемся, как только XP больше не дотягивает до следующего порога.
//
export const lvlOf = (xp: number): number => {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1;
    else break;
  }
  return Math.min(level, RANKS.length);
};

export const progOf = (xp: number): number => {
  const l = lvlOf(xp);
  if (l >= RANKS.length) return 1;
  const a = XP_TABLE[l - 1] ?? 0;
  const b = XP_TABLE[l]     ?? a + 1;
  return Math.min((xp - a) / (b - a), 1);
};

export const nextXP = (xp: number): number => {
  const l = lvlOf(xp);
  return l >= RANKS.length ? 0 : (XP_TABLE[l] ?? 0) - xp;
};

// ─── LOCALSTORAGE ────────────────────────────────────────────────
export const loadState = (): AppState | null => {
  try {
    const r = localStorage.getItem(LS) || localStorage.getItem("questly_v1");
    if (!r) return null;
    const state = JSON.parse(r) as AppState;
    if (state.tasks) state.tasks = state.tasks.map(t => ({ streakEnabled: false, streak: 0, ...t }));
    return state;
  } catch { return null; }
};
export const saveState = (s: AppState): void => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* ignore */ } };

export const loadSocial = (): SocialState | null => {
  try { const r = localStorage.getItem(LS_SOC); return r ? (JSON.parse(r) as SocialState) : null; } catch { return null; }
};
export const saveSocial = (s: SocialState): void => { try { localStorage.setItem(LS_SOC, JSON.stringify(s)); } catch { /* ignore */ } };

// ─── ЛОГИКА ЗАДАЧ ────────────────────────────────────────────────
// today() — всегда возвращает актуальную дату, не замораживается при старте.
export const today = todayStr;

export const autoRollover = (tasks: Task[]): Task[] => tasks.map(t => {
  const now = today();
  // Не-повторяющиеся просроченные задачи — переносим на сегодня
  if (!t.done && t.dueDate < now && !t.recurring)
    return { ...t, dueDate: now, rolledOver: true, streak: 0 };
  // Повторяющиеся пропущенные задачи — сбрасываем серию.
  // Новый экземпляр на сегодня создаст spawnRecurring уже с streak:0.
  if (!t.done && t.dueDate < now && t.recurring && t.streakEnabled)
    return { ...t, streak: 0 };
  return t;
});

export const spawnRecurring = (tasks: Task[], events: QuestlyEvent[], day: string): Task[] => {
  const next = [...tasks];
  tasks.filter(t => t.recurring && t.dueDate !== day).forEach(t => {
    const ok = t.recurType === "day"
      || (t.recurType === "week"  && new Date(t.dueDate).getDay() === new Date(day).getDay())
      || (t.recurType === "year"  && t.dueDate.slice(5) === day.slice(5));
    // Используем templateId для дедупликации — надёжнее, чем сравнение по названию.
    const tplId = t.templateId || t.id;
    if (ok && !next.some(x => x.dueDate === day && (x.templateId || x.id) === tplId)) {
      let inheritedStreak = 0;
      if (t.streakEnabled) {
        const doneInstances = tasks
          .filter(x => (x.templateId || x.id) === tplId && x.streakEnabled && x.done)
          .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
        if (doneInstances.length > 0) {
          const lastDone = doneInstances[0];
          const diffDays = Math.round((new Date(day).getTime() - new Date(lastDone.dueDate).getTime()) / 86400000);
          const cont = (t.recurType === "day" && diffDays <= 1)
                    || (t.recurType === "week" && diffDays <= 7)
                    || (t.recurType === "year" && diffDays <= 366);
          inheritedStreak = cont ? (lastDone.streak || 0) : 0;
        }
      }
      next.unshift({ ...t, id: uid(), templateId: tplId, done: false, dueDate: day, streak: inheritedStreak, rolledOver: false });
    }
  });

  events.filter(e => e.recurring).forEach(ev => {
    const [, em, ed] = ev.date.split("-").map(Number);
    const [, dm, dd] = day.split("-").map(Number);
    const ok = ev.recurType === "day"
      || (ev.recurType === "week" && new Date(ev.date).getDay() === new Date(day).getDay())
      || (ev.recurType === "year" && em === dm && ed === dd);
    if (!ok) return;
    const evTypeDef = EVENT_TYPES.find((t: { id: string }) => t.id === ev.eventType)
                   || EVENT_TYPES.find((t: { id: string }) => t.id === "custom");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evTypeDef.makeTasks(ev.title, day).forEach((tmpl: any) => {
      if (!next.some(x => x.title === tmpl.title && x.dueDate === day))
        next.unshift({ id: uid(), done: false, period: "day", xp: tmpl.xp || 15, dueDate: day, recurring: true, recurType: ev.recurType, streakEnabled: false, streak: 0, eventId: ev.id, ...tmpl });
    });
  });
  return next;
};

// ─── ДЕМО-ДАННЫЕ ─────────────────────────────────────────────────
export const INIT_CHALLENGES = [
  {
    id: "demo_ch1",
    title: "Утренняя зарядка",
    emoji: "🏋️",
    desc: "Каждое утро — 15 минут разминки",
    shareCode: mkCode(),
    recurType: "day",
    createdAt: pastDay(14),
    myStreak: 14,
    myHistory: Array.from({ length: 14 }, (_, i) => pastDay(13 - i)),
    participants: [
      { name: "Маша", avatar: "👩", streak: 11, lastCompleted: pastDay(0), history: Array.from({ length: 11 }, (_, i) => pastDay(10 - i)) },
    ],
  },
];

export const INIT_SHARED_GOALS = [
  {
    id: "demo_sg1",
    title: "Ужин в пятницу 🍷",
    emoji: "🛒",
    shareCode: mkCode(),
    createdAt: today(),
    participants: ["Ты", "Маша"],
    items: [
      { id: uid(), title: "Вино 🍷",   assignedTo: "Ты",   doneBy: "Ты",   done: true  },
      { id: uid(), title: "Сыр 🧀",    assignedTo: "Маша", doneBy: "Маша", done: true  },
      { id: uid(), title: "Хлеб 🥖",   assignedTo: null,   doneBy: null,   done: false },
      { id: uid(), title: "Оливки 🫒", assignedTo: null,   doneBy: null,   done: false },
      { id: uid(), title: "Свечи 🕯️", assignedTo: "Маша", doneBy: null,   done: false },
    ],
  },
];

export const INIT_TASKS: Task[] = [
  { id: uid(), title: "Утренняя зарядка",     period: "day",   done: false, xp: 15,  dueDate: today(), recurring: true,  recurType: "day", streakEnabled: true,  streak: 0 },
  { id: uid(), title: "Прочитать 20 страниц", period: "day",   done: true,  xp: 15,  dueDate: today(), recurring: false, recurType: "",    streakEnabled: false, streak: 0 },
  { id: uid(), title: "Подготовить отчёт",    period: "week",  done: false, xp: 50,  dueDate: today(), recurring: false, recurType: "",    streakEnabled: false, streak: 0 },
  { id: uid(), title: "Пройти курс по React", period: "month", done: false, xp: 150, dueDate: today(), recurring: false, recurType: "",    streakEnabled: false, streak: 0 },
  { id: uid(), title: "Запустить проект",     period: "year",  done: false, xp: 600, dueDate: today(), recurring: false, recurType: "",    streakEnabled: false, streak: 0 },
];

export const INIT_EVENTS: QuestlyEvent[] = [
  { id: uid(), title: "ДР Алексея",        date: today(), recurring: true,  recurType: "year", isBirthday: true,  color: "#F59E0B", eventType: "birthday" },
  { id: uid(), title: "Созвон с командой", date: today(), recurring: true,  recurType: "week", isBirthday: false, color: "#38BDF8", eventType: "meeting"  },
  { id: uid(), title: "Дедлайн проекта",   date: today(), recurring: false, recurType: "",     isBirthday: false, color: "#F43F5E", eventType: "deadline" },
];
