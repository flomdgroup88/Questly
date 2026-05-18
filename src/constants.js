import { T } from "./theme.js";
import { bdName } from "./utils";

// ─── GAME CONFIG ──────────────────────────────────────────────────
// ВАЖНО: используем JS-геттеры вместо статических значений T.*
// При копировании T.teal в строку цвет «замораживается» на момент
// загрузки модуля (обычно тёмная тема). Геттер читает T каждый раз
// при рендере, поэтому тема переключается корректно.
export const PERIODS = [
  { id:"day",   label:"Сегодня", xp:15,   get accent(){ return T.teal;    }, icon:"⚡", desc:"на сегодня" },
  { id:"week",  label:"Неделя",  xp:50,   get accent(){ return T.sky;     }, icon:"🌊", desc:"на неделю"  },
  { id:"month", label:"Месяц",   xp:150,  get accent(){ return T.purpL;   }, icon:"💫", desc:"на месяц"   },
  { id:"year",  label:"Год",     xp:600,  get accent(){ return T.gold;    }, icon:"👑", desc:"на год"     },
  { id:"dream", label:"Мечта",   xp:1000, get accent(){ return T.dream;  }, icon:"🌠", desc:"мечта"      },
];

// 80-level progressive XP table: cumulative XP to reach each level
export const XP_TABLE = Array.from({length:80}, (_,i) =>
  i===0 ? 0 : Math.round(100 * i * (i+1) * (2*i+1) / 6)
);

// Звания 1–80: каждый уровень — сюрприз, таблица намеренно скрыта на экране профиля.
export const RANKS = [
  // 1–5: Старт
  "Диванный эксперт","Подающий надежды","Человек с планом","Начинающий","Встал с дивана",
  // 6–10: Первые шаги
  "Записал в список","Почти сделал","Сделал половину","Молодец, серьёзно","Уже что-то",
  // 11–15: Набирает обороты
  "Человек-дедлайн","Продуктивный понедельник","Работает без кофе","Входит во вкус","Не прокрастинирует (почти)",
  // 16–20: Уровень знаменитостей
  "Уровень Киану Ривза","Уровень Илона Маска","Уровень Роналду","Уровень Месси","Уровень Биткоина",
  // 21–25: Серьёзно
  "Профессионал","Эксперт по спискам","Мастер задач","Сделано → следующее","Машина продуктивности",
  // 26–30: Признание
  "Твит одобрил бы Маск","Трамп бы позавидовал","Моуринью доволен","Зидан аплодирует","Безос кивает",
  // 31–35: Легенда приближается
  "Топ 10% планеты","Уровень Forbes 30 до 30","Джобс бы нанял","Цукерберг смотрит с уважением","Нолан написал бы сценарий",
  // 36–40: Икона
  "Феномен","Икона продуктивности","Вошёл в историю","Обсуждают в подкастах","TED-talk неизбежен",
  // 41–45: Философия
  "Думает как Безос","Работает как Маск","Побеждает как Роналду","Спокоен как Анчелотти","Везёт как Флику",
  // 46–50: Полвека уровней
  "50 уровней пройдено","Живая легенда","Феномен эпохи","Уровень Олимпийца","Золотой человек",
  // 51–55: За гранью
  "Трамп написал бы книгу","Маск назвал бы стартап","Месси дал бы пас","Роналду посмотрел в зеркало","Далай-лама одобряет",
  // 56–60: Миф
  "Вошёл в учебники","Стал мемом в хорошем смысле","Документальный фильм снимают","Netflix купил права","Илон подписался",
  // 61–65: Сверхчеловек
  "Сверхчеловек","Не нуждается во сне","Работает быстрее ИИ","Опережает тренды","Видит будущее",
  // 66–70: Вне категорий
  "Вне категорий","Слишком мощный","Сломал систему рангов","Статистически невозможный","Ошибка симуляции",
  // 71–75: Абсолют
  "Абсолют","Явление природы","Нет слов","Только цифры","Просто смотрите",
  // 76–80: Финал
  "Финальный босс","Легенда легенд","Эпоха назвала своим","Одна на миллиард","ТЫ",
];

export const RANK_ICONS = [
  "🛋️","🌱","📝","🐣","🚶",          // 1–5
  "📋","🤔","⚡","💪","🙂",           // 6–10
  "⏰","☕","🔋","🚀","😤",           // 11–15
  "🎬","🚀","⚽","🏆","₿",           // 16–20
  "💼","🗂️","🎯","✅","🤖",          // 21–25
  "🐦","🇺🇸","👔","🎩","💰",         // 26–30
  "📊","🌐","🍎","👤","🎬",          // 31–35
  "🌟","⚡","📜","🎙️","🎤",          // 36–40
  "💡","💪","⚽","🧘","🏅",          // 41–45
  "5️⃣","🏛️","🌍","🥇","🥇",          // 46–50
  "🇺🇸","🚀","🎯","🪞","🙏",         // 51–55
  "📚","🐸","🎬","📺","✔️",          // 56–60
  "💎","🌙","⚡","🔭","🔮",          // 61–65
  "🌀","💥","🛠️","🎲","🧩",          // 66–70
  "♾️","🌋","🤐","🔢","👀",          // 71–75
  "👾","🏆","🌐","💫","🫵",          // 76–80
];

export const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
export const WDAYS     = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

// ─── EVENT TYPES ──────────────────────────────────────────────────
// color и hintColor — геттеры, чтобы всегда читать актуальную тему.
export const EVENT_TYPES = [
  {
    id:"birthday", icon:"🎂", label:"День рождения",
    get color(){ return T.gold; },
    hint:"Задача «Поздравить» создастся автоматически и будет повторяться ежегодно.",
    get hintColor(){ return T.gold; },
    defaultRec:true, defaultRecType:"year", isSystemBd:true,
    makeTasks:(title)=>[{
      title:`🎂 Поздравить с ДР: ${bdName(title)}`,
      period:"day", xp:15, recurring:true, recurType:"year",
    }],
  },
  {
    id:"meeting", icon:"🤝", label:"Встреча",
    get color(){ return T.sky; },
    hint:"В делах на день встречи появится задача «Провести встречу».",
    get hintColor(){ return T.sky; },
    defaultRec:false, defaultRecType:"week",
    makeTasks:(title)=>[{
      title:`🤝 Провести встречу: ${title}`,
      period:"day", xp:20, recurring:false, recurType:"",
    }],
  },
  {
    id:"trip", icon:"✈️", label:"Поездка",
    get color(){ return T.teal; },
    hint:"Поездка фиксируется в календаре — без дополнительных задач.",
    get hintColor(){ return T.teal; },
    defaultRec:false, defaultRecType:"",
    makeTasks:()=>[],
  },
  {
    id:"deadline", icon:"⏰", label:"Дедлайн",
    get color(){ return T.rose; },
    hint:"Задача «Сдать» появится в делах на дату дедлайна.",
    get hintColor(){ return T.rose; },
    defaultRec:false, defaultRecType:"",
    makeTasks:(title)=>[{
      title:`⏰ Сдать: ${title}`,
      period:"day", xp:40, recurring:false, recurType:"",
    }],
  },
  {
    id:"holiday", icon:"🎉", label:"Праздник",
    get color(){ return T.purpL; },
    hint:"В этот день появится задача «Отдыхать и наслаждаться!».",
    get hintColor(){ return T.purpL; },
    defaultRec:true, defaultRecType:"year",
    makeTasks:(title)=>[{
      title:`🎉 ${title} — отдыхать и наслаждаться!`,
      period:"day", xp:10, recurring:true, recurType:"year",
    }],
  },
  {
    id:"health", icon:"🏥", label:"Здоровье",
    get color(){ return T.teal; },
    hint:"Появится задача-напоминание о визите или мероприятии.",
    get hintColor(){ return T.teal; },
    defaultRec:false, defaultRecType:"",
    makeTasks:(title)=>[{
      title:`🏥 Визит/мероприятие: ${title}`,
      period:"day", xp:25, recurring:false, recurType:"",
    }],
  },
  {
    id:"custom", icon:"📌", label:"Другое",
    get color(){ return T.sub; },
    hint:null,
    defaultRec:false, defaultRecType:"week",
    makeTasks:(title)=>[{
      title, period:"day", xp:15, recurring:false, recurType:"",
    }],
  },
];

// ─── PRIORITIES ───────────────────────────────────────────────────
export const PRIORITIES = [
  { id: "normal",    label: "Обычная",  icon: "–",   color: "transparent",             stripe: "transparent"             },
  { id: "important", label: "Важная",   icon: "★",   get color(){ return T.gold; },    get stripe(){ return T.gold; }    },
  { id: "urgent",    label: "Срочная",  icon: "!!!",  get color(){ return T.rose; },    get stripe(){ return T.rose; }    },
];

// ─── CHECKLIST PRESETS ────────────────────────────────────────────
export const CHECKLIST_PRESETS = [
  { id:"shop",   icon:"🛒", label:"Покупки"  },
  { id:"travel", icon:"🧳", label:"В дорогу" },
  { id:"guests", icon:"👥", label:"Гости"    },
  { id:"gifts",  icon:"🎁", label:"Подарки"  },
  { id:"movies", icon:"🎬", label:"Фильмы"   },
  { id:"books",  icon:"📚", label:"Книги"    },
  { id:"series", icon:"📺", label:"Сериалы"  },
  { id:"custom", icon:"✏️", label:"Своё"     },
];

// ─── LOCALSTORAGE KEYS ────────────────────────────────────────────
export const LS     = "questly_v2";
export const LS_SOC = "questly_social_v1";


