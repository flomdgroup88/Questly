/**
 * useAchievements — отслеживает разблокировку ачивок и возвращает очередь для показа.
 *
 * Логика:
 *  - При первом запуске молча помечает все уже выполненные ачивки как "виденные"
 *    (чтобы не спамить пользователю, у которого уже есть прогресс).
 *  - При каждом последующем изменении состояния сравнивает с localStorage
 *    и кладёт в очередь только новые ачивки.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { lvlOf, today } from "../utils";

const LS_KEY = "questly_achievements_seen_v2";

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveSeen(seen: Set<string>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...seen])); } catch {}
}

interface AchievementInput {
  tasks:      any[];
  xp:         number;
  events:     any[];
  challenges: any[];
}

export interface Achievement {
  icon:  string;
  label: string;
  desc:  string;
  cat:   string;
}

export function useAchievements({ tasks, xp, events, challenges }: AchievementInput) {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const seenRef        = useRef<Set<string>>(loadSeen());
  const initializedRef = useRef(false);

  // ── Вычисляем те же зависимости, что и ProfileScreen ────────────
  const level    = lvlOf(xp);
  const completed = tasks.filter(t => t.done).length;
  const total     = tasks.length;
  const bestStreak = Math.max(0, ...tasks.filter(t => t.streakEnabled).map(t => t.streak ?? 0));
  const hasShopTask    = tasks.some(t => t.shopItems?.length > 0);
  const shopItemsDone  = tasks.reduce((a: number, t: any) => a + (t.shopItems?.filter((i: any) => i.done).length ?? 0), 0);
  const todayStr       = today();
  const todayDayTasks  = tasks.filter(t => t.period === "day" && t.dueDate === todayStr);
  const perfectDay     = todayDayTasks.length >= 3 && todayDayTasks.every(t => t.done);
  const completedOnSunday = tasks.some(t => (t.doneHistory ?? []).some((d: string) => new Date(d).getDay() === 0));
  const activeDays     = new Set(tasks.flatMap((t: any) => t.doneHistory ?? [])).size;
  const allPeriodsCovered = ["day","week","month","year"].every(p => tasks.some(t => t.period === p));

  // ── Полный список ачивок (зеркало ProfileScreen) ────────────────
  const achievements = useMemo<Achievement[]>(() => [
    // Задачи
    { icon:"⚡", label:"Первый шаг",         desc:"Выполни первую задачу",          done:completed>=1,    cat:"tasks" },
    { icon:"🔥", label:"Пятёрка",            desc:"Выполни 5 задач",                done:completed>=5,    cat:"tasks" },
    { icon:"🏅", label:"Первая десятка",     desc:"Выполни 10 задач",               done:completed>=10,   cat:"tasks" },
    { icon:"🌙", label:"Ночной режим",       desc:"Выполни 50 задач",               done:completed>=50,   cat:"tasks" },
    { icon:"💪", label:"В ритме",            desc:"Выполни 25 задач",               done:completed>=25,   cat:"tasks" },
    { icon:"💯", label:"Сотня",              desc:"Выполни 100 задач",              done:completed>=100,  cat:"tasks" },
    { icon:"🚀", label:"500 и не устал",     desc:"Выполни 500 задач",              done:completed>=500,  cat:"tasks" },
    { icon:"🌍", label:"Тысячник",           desc:"Выполни 1000 задач",             done:completed>=1000, cat:"tasks" },
    { icon:"📦", label:"Коллекционер",       desc:"Создай 10 задач",                done:total>=10,       cat:"tasks" },
    { icon:"🗄️", label:"Библиотека задач",   desc:"Создай 50 задач",                done:total>=50,       cat:"tasks" },
    // Периоды
    { icon:"👑", label:"Годовой план",       desc:"Добавь цель на год",             done:tasks.some(t=>t.period==="year"),  cat:"period" },
    { icon:"🌊", label:"Недельный игрок",    desc:"Добавь еженедельную цель",       done:tasks.some(t=>t.period==="week"),  cat:"period" },
    { icon:"💫", label:"Месяц вперёд",       desc:"Добавь ежемесячную цель",        done:tasks.some(t=>t.period==="month"), cat:"period" },
    { icon:"🌠", label:"Мечтатель",          desc:"Добавь мечту",                   done:tasks.some(t=>t.period==="dream"), cat:"period" },
    { icon:"🗓️", label:"Всё охвачено",       desc:"Цели на все периоды сразу",      done:["day","week","month","year","dream"].every(p=>tasks.some(t=>t.period===p)), cat:"period" },
    // Серии
    { icon:"🎯", label:"Снайпер",            desc:"Серия 10 дней подряд",           done:bestStreak>=10,  cat:"streak" },
    { icon:"🔥", label:"Неделя без пропуска",desc:"Серия 7 дней подряд",            done:bestStreak>=7,   cat:"streak" },
    { icon:"🦅", label:"Орёл",              desc:"Серия 14 дней",                  done:bestStreak>=14,  cat:"streak" },
    { icon:"💪", label:"Железная воля",      desc:"Серия 30 дней подряд",           done:bestStreak>=30,  cat:"streak" },
    { icon:"🏆", label:"Чемпион",           desc:"Серия 60 дней",                  done:bestStreak>=60,  cat:"streak" },
    { icon:"🏃", label:"Марафонец",          desc:"Серия 100 дней подряд",          done:bestStreak>=100, cat:"streak" },
    { icon:"💎", label:"Бриллиант",         desc:"Серия 200 дней",                 done:bestStreak>=200, cat:"streak" },
    { icon:"♾️", label:"Вечный огонь",       desc:"Серия 365 дней подряд",          done:bestStreak>=365, cat:"streak" },
    { icon:"🧬", label:"ДНК продуктивности", desc:"Серия 500 дней",                 done:bestStreak>=500, cat:"streak" },
    // Уровни
    { icon:"⭐", label:"Нашёл себя",          desc:"Достигни уровня 5",              done:level>=5,  cat:"level" },
    { icon:"🌟", label:"Уже не новичок",      desc:"Достигни уровня 10",             done:level>=10, cat:"level" },
    { icon:"💫", label:"Серьёзный человек",   desc:"Достигни уровня 20",             done:level>=20, cat:"level" },
    { icon:"🔮", label:"Икона квартала",      desc:"Достигни уровня 40",             done:level>=40, cat:"level" },
    { icon:"👑", label:"Легенда приложения",  desc:"Достигни уровня 60",             done:level>=60, cat:"level" },
    { icon:"🫵", label:"ТЫ",                 desc:"Достигни уровня 80",             done:level>=80, cat:"level" },
    // Привычки
    { icon:"🔄", label:"Завёл привычку",     desc:"Создай повторяемую задачу",      done:tasks.some(t=>t.recurring), cat:"habit" },
    { icon:"🛒", label:"Шопоголик",          desc:"Создай список покупок",          done:hasShopTask,      cat:"habit" },
    { icon:"🧺", label:"Закупился",          desc:"Отметь 10 покупок",              done:shopItemsDone>=10,cat:"habit" },
    // События
    { icon:"🎂", label:"Не забуду",          desc:"Добавь день рождения",           done:events.some(e=>e.isBirthday),              cat:"events" },
    { icon:"📅", label:"Организатор",        desc:"Добавь 5 событий",               done:events.length>=5,                          cat:"events" },
    { icon:"📅", label:"Хронист",            desc:"Добавь 20 событий",              done:events.length>=20,                         cat:"events" },
    { icon:"🗺️", label:"Путешественник",     desc:"Добавь поездку",                 done:events.some(e=>e.eventType==="trip"),       cat:"events" },
    { icon:"✈️", label:"Вечно в пути",       desc:"Добавь 3 поездки",               done:events.filter(e=>e.eventType==="trip").length>=3, cat:"events" },
    { icon:"⏰", label:"Мастер дедлайнов",   desc:"Добавь дедлайн",                 done:events.some(e=>e.eventType==="deadline"),   cat:"events" },
    { icon:"🎉", label:"Праздник!",          desc:"Добавь праздник",                done:events.some(e=>e.eventType==="holiday"),    cat:"events" },
    { icon:"🤝", label:"Командный игрок",    desc:"Добавь встречу",                 done:events.some(e=>e.eventType==="meeting"),    cat:"events" },
    // Бонусные
    { icon:"🌅", label:"Ранняя пташка",      desc:"Выполни задачу в первый день",   done:completed>=1,   cat:"bonus" },
    { icon:"🧠", label:"Стратег",            desc:"Цели на неделю, месяц и год одновременно", done:["week","month","year"].every(p=>tasks.some(t=>t.period===p)), cat:"bonus" },
    { icon:"🌈", label:"Многозадачность",    desc:"Задачи во всех 5 периодах",      done:["day","week","month","year","dream"].every(p=>tasks.some(t=>t.period===p)), cat:"bonus" },
    { icon:"💬", label:"Социальный",         desc:"Участвуй в соревновании",        done:challenges.length>0, cat:"bonus" },
    { icon:"🌞", label:"Идеальный день",     desc:"Закрой все дневные задачи (мин. 3)", done:perfectDay, cat:"bonus" },
    { icon:"😴", label:"Воскресный герой",   desc:"Выполни задачу в воскресенье",   done:completedOnSunday, cat:"bonus" },
    { icon:"📆", label:"Активист",           desc:"Выполняй задачи 7 разных дней",  done:activeDays>=7, cat:"bonus" },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [completed, total, bestStreak, hasShopTask, shopItemsDone, perfectDay,
      completedOnSunday, activeDays, level,
      events.length, challenges.length,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      tasks.filter(t=>t.period==="year").length,
      tasks.filter(t=>t.period==="week").length,
      tasks.filter(t=>t.period==="month").length,
      tasks.filter(t=>t.period==="dream").length,
      tasks.filter(t=>t.recurring).length,
  ]) as Achievement[];

  // ── Детектируем новые ачивки ─────────────────────────────────────
  useEffect(() => {
    const doneNow = achievements.filter(a => (a as any).done);

    if (!initializedRef.current) {
      // Первый запуск: молча помечаем всё как виденное — не спамим старым прогрессом
      const seed = new Set(seenRef.current);
      doneNow.forEach(a => seed.add(a.label));
      seenRef.current = seed;
      saveSeen(seed);
      initializedRef.current = true;
      return;
    }

    const newlyUnlocked = doneNow.filter(a => !seenRef.current.has(a.label));
    if (newlyUnlocked.length === 0) return;

    const updated = new Set(seenRef.current);
    newlyUnlocked.forEach(a => updated.add(a.label));
    seenRef.current = updated;
    saveSeen(updated);

    setQueue(prev => [...prev, ...newlyUnlocked]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievements]);

  const dismiss = () => setQueue(prev => prev.slice(1));

  return { achievementQueue: queue, dismissAchievement: dismiss };
}
