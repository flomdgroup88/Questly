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

  // ── Хэштег-категории: синонимы (20+ на тему) ────────────────────
  function matchTag(title: string, syns: string[]): boolean {
    const s = (title || "").toLowerCase().replace(/[#_]/g, " ");
    return syns.some(syn => s.includes(syn));
  }
  const WORK_SYNS   = ["работ","work","ворк","офис","проект","отчёт","отчет","совещани","коллег","клиент","бизнес","карьер","зарплат","собеседовани","дедлайн","презентаци","контракт","партнёр","партнер","переговор","стартап","фриланс","митинг","задани","корпоратив","менеджер","шеф","руководств","поставщик"];
  const TRAVEL_SYNS = ["путешестви","поездк","trip","travel","отпуск","виза","билет","самолёт","самолет","отел","гостиниц","чемодан","заграниц","маршрут","аэропорт","вокзал","экскурси","курорт","путёвк","путевк","турне","рюкзак","хостел","бронировани","паспорт","туризм"];
  const MOVIE_SYNS  = ["фильм","кино","movie","cinema","кинотеатр","мультик","мультфильм","аниме","блокбастер","документалк","netflix","нетфликс","голливуд","сеанс","просмотр","кинчик","режиссёр","режиссер","оскар","триллер","комедия","боевик","мелодрам","ужас","премьер"];
  const SERIES_SYNS = ["сериал","series","серию","серий","эпизод","episode","сезон","season","шоу","show","hbo","disney","амедиатека","стриминг","kinopoisk","кинопоиск","нетфликс","netflix","prime","ivi","okko","смотрим","онлайн-кинотеатр"];
  const HOME_SYNS   = ["уборк","уборку","ремонт","посуд","стирк","пылесос","готовк","готовить","кухн","квартир","хозяйств","починить","поломк","быт","мусор","cleaning","мытьё","мытье","глажк","сантехник","электрик","мебел","окна"];
  const FAMILY_SYNS = ["семь","семей","дети","детей","ребёнок","ребенок","родители","мама","папа","бабушк","дедушк","братья","сёстры","сестр","муж","жен","супруг","family","племянник","свекровь","тёщ","тещ","отец","мать","дочь","сын"];
  const DACHA_SYNS  = ["дача","дачн","огород","грядк","урожай","посадить","посев","полит","теплиц","компост","картошк","клубник","деревн","газон","скосить","трава","огурц","помидор","яблон","вишн","малин","забор","баня","колодец"];
  const CAR_SYNS    = ["машин","авто","тачк","автомобил","мойк","техосмотр","страховк","заправк","гараж","шиномонтаж","масл","колес","вождени","автосервис","права","car","каско","осаго","аккумулятор","тормоза","двигатель","запчаст","диск","кузов"];
  const SOCIAL_SYNS = ["инстаграм","instagram","insta","тикток","tiktok","вконтакте","вк","vk","телеграм","telegram","ютуб","youtube","соцсет","лайк","пост","stories","сторис","reels","подписчик","публикаци","контент","блог","twitch","twitter","твиттер","discord","linkedin"];
  const SPORT_SYNS  = ["спорт","тренировк","зал","фитнес","gym","fitness","бег","run","плавани","велосипед","йог","yoga","workout","качалк","качать","пробежк","силов","кардио","турник","отжимани","приседани","лыж","сноуборд","футбол","баскетбол","теннис","бокс"];
  const BOOKS_SYNS  = ["книг","книж","читать","чтение","book","reading","литератур","роман","автор","библиотек","страниц","нон-фикшн","бестселлер","биографи","поэзи","стих","аудиокниг"];
  const HEALTH_SYNS = ["здоровь","врач","доктор","больниц","аптек","лекарств","анализ","приём","прием","диета","витамин","health","медицин","клиник","зубной","стоматолог","терапевт","прививк","давлени","температур","процедур","массаж"];

  const tagWork   = tasks.filter((t:any) => t.done && matchTag(t.title, WORK_SYNS)).length;
  const tagTravel = tasks.filter((t:any) => t.done && matchTag(t.title, TRAVEL_SYNS)).length;
  const tagMovie  = tasks.filter((t:any) => t.done && matchTag(t.title, MOVIE_SYNS)).length;
  const tagSeries = tasks.filter((t:any) => t.done && matchTag(t.title, SERIES_SYNS)).length;
  const tagHome   = tasks.filter((t:any) => t.done && matchTag(t.title, HOME_SYNS)).length;
  const tagFamily = tasks.filter((t:any) => t.done && matchTag(t.title, FAMILY_SYNS)).length;
  const tagDacha  = tasks.filter((t:any) => t.done && matchTag(t.title, DACHA_SYNS)).length;
  const tagCar    = tasks.filter((t:any) => t.done && matchTag(t.title, CAR_SYNS)).length;
  const tagSocial = tasks.filter((t:any) => t.done && matchTag(t.title, SOCIAL_SYNS)).length;
  const tagSport  = tasks.filter((t:any) => t.done && matchTag(t.title, SPORT_SYNS)).length;
  const tagBooks  = tasks.filter((t:any) => t.done && matchTag(t.title, BOOKS_SYNS)).length;
  const tagHealth = tasks.filter((t:any) => t.done && matchTag(t.title, HEALTH_SYNS)).length;
  const tagCatsUnlocked = [tagWork,tagTravel,tagMovie,tagSeries,tagHome,tagFamily,tagDacha,tagCar,tagSocial,tagSport,tagBooks,tagHealth].filter(c=>c>=1).length;

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

    // ── Хэштег: Работа ─────────────────────────────────────────────
    { icon:"💼", label:"Деловой человек",     desc:"Выполни рабочую задачу",                   done:tagWork>=1,  cat:"hashtag" },
    { icon:"📊", label:"Трудяга",             desc:"Закрой 10 рабочих задач",                  done:tagWork>=10, cat:"hashtag" },
    { icon:"🏢", label:"Карьерист",           desc:"Закрой 30 рабочих задач",                  done:tagWork>=30, cat:"hashtag" },
    { icon:"🤵", label:"Топ-менеджер",        desc:"Закрой 100 рабочих задач",                 done:tagWork>=100,cat:"hashtag" },

    // ── Хэштег: Путешествия ────────────────────────────────────────
    { icon:"🌍", label:"Первый перелёт",      desc:"Выполни задачу о путешествии",             done:tagTravel>=1,  cat:"hashtag" },
    { icon:"🧳", label:"Бродяга",             desc:"Закрой 10 задач о путешествиях",           done:tagTravel>=10, cat:"hashtag" },
    { icon:"✈️", label:"Вечный странник",     desc:"Закрой 30 задач о путешествиях",           done:tagTravel>=30, cat:"hashtag" },

    // ── Хэштег: Фильмы ────────────────────────────────────────────
    { icon:"🎬", label:"Киноман",             desc:"Посмотри первый фильм по задаче",          done:tagMovie>=1,  cat:"hashtag" },
    { icon:"🍿", label:"Кинокритик",          desc:"Закрой 10 задач о фильмах",               done:tagMovie>=10, cat:"hashtag" },
    { icon:"🎭", label:"Синефил",             desc:"Закрой 30 задач о фильмах",               done:tagMovie>=30, cat:"hashtag" },

    // ── Хэштег: Сериалы ───────────────────────────────────────────
    { icon:"📺", label:"Сериальщик",          desc:"Отметь первый просмотренный сериал",       done:tagSeries>=1,  cat:"hashtag" },
    { icon:"🛋️", label:"Диванный эксперт",    desc:"Закрой 10 сериальных задач",              done:tagSeries>=10, cat:"hashtag" },
    { icon:"🎥", label:"Нетфликс отдыхает",   desc:"Закрой 30 сериальных задач",              done:tagSeries>=30, cat:"hashtag" },

    // ── Хэштег: Домашние дела ─────────────────────────────────────
    { icon:"🧹", label:"Чистюля",             desc:"Выполни домашнее дело",                   done:tagHome>=1,  cat:"hashtag" },
    { icon:"🏠", label:"Хозяйственный",       desc:"Закрой 10 домашних задач",                done:tagHome>=10, cat:"hashtag" },
    { icon:"✨", label:"Идеальный дом",        desc:"Закрой 30 домашних задач",                done:tagHome>=30, cat:"hashtag" },

    // ── Хэштег: Семья ─────────────────────────────────────────────
    { icon:"👨‍👩‍👧", label:"Семьянин",           desc:"Выполни задачу для семьи",                done:tagFamily>=1,  cat:"hashtag" },
    { icon:"❤️", label:"Опора семьи",          desc:"Закрой 10 семейных задач",                done:tagFamily>=10, cat:"hashtag" },
    { icon:"👪", label:"Патриарх",             desc:"Закрой 30 семейных задач",                done:tagFamily>=30, cat:"hashtag" },

    // ── Хэштег: Дача ──────────────────────────────────────────────
    { icon:"🌱", label:"Огородник",            desc:"Выполни задачу на даче",                  done:tagDacha>=1,  cat:"hashtag" },
    { icon:"🥕", label:"Агроном",              desc:"Закрой 10 дачных задач",                  done:tagDacha>=10, cat:"hashtag" },
    { icon:"🌻", label:"Сельский житель",      desc:"Закрой 30 дачных задач",                  done:tagDacha>=30, cat:"hashtag" },

    // ── Хэштег: Авто ──────────────────────────────────────────────
    { icon:"🚗", label:"За рулём",             desc:"Выполни задачу об автомобиле",            done:tagCar>=1,  cat:"hashtag" },
    { icon:"🔧", label:"Автолюбитель",         desc:"Закрой 10 задач об авто",                 done:tagCar>=10, cat:"hashtag" },
    { icon:"🏎️", label:"Автомеханик",          desc:"Закрой 30 задач об авто",                 done:tagCar>=30, cat:"hashtag" },

    // ── Хэштег: Соцсети ───────────────────────────────────────────
    { icon:"📱", label:"Блогер",               desc:"Выполни задачу о соцсетях",               done:tagSocial>=1,  cat:"hashtag" },
    { icon:"👍", label:"Инфлюенсер",           desc:"Закрой 10 задач о соцсетях",              done:tagSocial>=10, cat:"hashtag" },
    { icon:"🌟", label:"Звезда интернета",     desc:"Закрой 30 задач о соцсетях",              done:tagSocial>=30, cat:"hashtag" },

    // ── Хэштег: Спорт ─────────────────────────────────────────────
    { icon:"🏃", label:"Физкультурник",        desc:"Выполни спортивную задачу",               done:tagSport>=1,  cat:"hashtag" },
    { icon:"💪", label:"Атлет",                desc:"Закрой 10 спортивных задач",              done:tagSport>=10, cat:"hashtag" },
    { icon:"🏆", label:"Чемпион по жизни",     desc:"Закрой 50 спортивных задач",              done:tagSport>=50, cat:"hashtag" },

    // ── Хэштег: Книги ─────────────────────────────────────────────
    { icon:"📚", label:"Читатель",             desc:"Выполни задачу о книгах",                 done:tagBooks>=1,  cat:"hashtag" },
    { icon:"📖", label:"Книжный клуб",         desc:"Закрой 10 книжных задач",                 done:tagBooks>=10, cat:"hashtag" },
    { icon:"🧠", label:"Интеллектуал",         desc:"Закрой 30 книжных задач",                 done:tagBooks>=30, cat:"hashtag" },

    // ── Хэштег: Здоровье ──────────────────────────────────────────
    { icon:"🩺", label:"ЗОЖник",               desc:"Выполни задачу о здоровье",               done:tagHealth>=1,  cat:"hashtag" },
    { icon:"💊", label:"Про своё здоровье",    desc:"Закрой 10 задач о здоровье",              done:tagHealth>=10, cat:"hashtag" },
    { icon:"🏥", label:"Доктор себя",          desc:"Закрой 30 задач о здоровье",              done:tagHealth>=30, cat:"hashtag" },

    // ── Хэштег: Мультикатегории ───────────────────────────────────
    { icon:"🎨", label:"Разносторонний",       desc:"Задачи в 3 разных хэштег-темах",          done:tagCatsUnlocked>=3,  cat:"hashtag" },
    { icon:"🌈", label:"Мастер на все руки",   desc:"Задачи в 6 разных хэштег-темах",          done:tagCatsUnlocked>=6,  cat:"hashtag" },
    { icon:"🦄", label:"Человек-оркестр",      desc:"Задачи во всех 12 хэштег-темах",          done:tagCatsUnlocked>=12, cat:"hashtag" },
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
      tagWork, tagTravel, tagMovie, tagSeries, tagHome, tagFamily,
      tagDacha, tagCar, tagSocial, tagSport, tagBooks, tagHealth, tagCatsUnlocked,
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
