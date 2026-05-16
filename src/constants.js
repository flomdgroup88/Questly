import { T } from "./theme.js";

// ─── GAME CONFIG ──────────────────────────────────────────────────
export const PERIODS = [
  { id:"day",   label:"Сегодня", xp:15,  accent:T.teal,  icon:"⚡", desc:"на сегодня" },
  { id:"week",  label:"Неделя",  xp:50,  accent:T.sky,   icon:"🌊", desc:"на неделю"  },
  { id:"month", label:"Месяц",   xp:150, accent:T.purpL, icon:"💫", desc:"на месяц"   },
  { id:"year",  label:"Год",     xp:600, accent:T.gold,  icon:"👑", desc:"на год"     },
];

// 80-level progressive XP table: cumulative XP to reach each level
export const XP_TABLE = Array.from({length:80}, (_,i) =>
  i===0 ? 0 : Math.round(100 * i * (i+1) * (2*i+1) / 6)
);

export const RANKS = [
  "Новобранец","Послушник","Искатель","Скиталец","Авантюрист",
  "Наёмник","Боец","Воин","Страж","Рыцарь",
  "Ветеран","Мастер","Командир","Защитник","Чемпион",
  "Герой","Избранный","Легат","Хранитель","Паладин",
  "Чародей","Заклинатель","Волшебник","Архимаг","Оракул",
  "Провидец","Пророк","Мудрец","Гуру","Просветлённый",
  "Верховный страж","Сенешаль","Протектор","Лорд","Властитель",
  "Маршал","Феникс","Дракон","Полубог","Бессмертный",
  "Миф","Легенда","Апофеоз","Архонт","Немезида",
  "Величие","Небожитель","Непостижимый","Безграничный","Вечный",
  "Запредельный","Трансцендентный","Абсолют","Ультимат","Один",
  "Высший","Непревзойдённый","Астральный","Космический","Вселенский",
  "Надмирный","Первопричина","Предвечный","Примордиальный","Сингулярность",
  "Бесконечность","Омега","Непознаваемый","Трансцендентность","Квинтэссенция",
  "Надвременный","Первозданный","Незыблемый","Абсолютное Бытие","Альфа и Омега",
  "Эпохальный","Надсущностный","Внеопытный","Тотальный","Легенда Вечности",
];

export const RANK_ICONS = [
  "🪨","📖","🔍","🗺️","🥊","⚔️","🛡️","🎖️","🏰","👑",
  "🎯","📜","🔱","🌟","🏆","⭐","💫","✨","🌙","🛡",
  "🔮","💫","🌀","🔯","🧿","👁️","🌠","🎓","🧙","💡",
  "⚜️","🌋","🦁","🦅","🌈","⚡","🐉","🔥","🌊","💎",
  "📿","🌌","🌠","⚖️","☄️","🌑","🌃","🌌","♾️","⌛",
  "🌀","🌊","🔥","⚡","🌟","🔯","🏆","🪐","🌍","🌺",
  "🌙","🌞","⭐","💀","🔮","♾️","🧬","⚛️","🌀","🌺",
  "⏳","🌱","🗿","☯️","🌐","🔑","🕊️","🌊","🔥","👑",
];

export const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
export const WDAYS     = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

// ─── EVENT TYPES ──────────────────────────────────────────────────
export const EVENT_TYPES = [
  {
    id:"birthday", icon:"🎂", label:"День рождения", color:T.gold,
    hint:"Задача «Поздравить» создастся автоматически и будет повторяться ежегодно.",
    hintColor:T.gold,
    defaultRec:true, defaultRecType:"year", isSystemBd:true,
    makeTasks:(title)=>[{
      title:`🎂 Поздравить с ДР: ${bdName(title)}`,
      period:"day", xp:15, recurring:true, recurType:"year",
    }],
  },
  {
    id:"meeting", icon:"🤝", label:"Встреча", color:T.sky,
    hint:"В делах на день встречи появится задача «Провести встречу».",
    hintColor:T.sky,
    defaultRec:false, defaultRecType:"week",
    makeTasks:(title)=>[{
      title:`🤝 Провести встречу: ${title}`,
      period:"day", xp:20, recurring:false, recurType:"",
    }],
  },
  {
    id:"trip", icon:"✈️", label:"Поездка", color:T.teal,
    hint:"Создадутся три задачи-шаблона: билеты, багаж и жильё.",
    hintColor:T.teal,
    defaultRec:false, defaultRecType:"",
    makeTasks:(title, date)=>[
      { title:`✈️ Купить билеты: ${title}`,         period:"day", xp:30, recurring:false, recurType:"", dueDate:date },
      { title:`🧳 Упаковать чемодан: ${title}`,     period:"day", xp:20, recurring:false, recurType:"", dueDate:date },
      { title:`🏨 Проверить бронирование: ${title}`,period:"day", xp:20, recurring:false, recurType:"", dueDate:date },
    ],
  },
  {
    id:"deadline", icon:"⏰", label:"Дедлайн", color:T.rose,
    hint:"Задача «Сдать» появится в делах на дату дедлайна.",
    hintColor:T.rose,
    defaultRec:false, defaultRecType:"",
    makeTasks:(title)=>[{
      title:`⏰ Сдать: ${title}`,
      period:"day", xp:40, recurring:false, recurType:"",
    }],
  },
  {
    id:"holiday", icon:"🎉", label:"Праздник", color:T.purpL,
    hint:"В этот день появится задача «Отдыхать и наслаждаться!».",
    hintColor:T.purpL,
    defaultRec:true, defaultRecType:"year",
    makeTasks:(title)=>[{
      title:`🎉 ${title} — отдыхать и наслаждаться!`,
      period:"day", xp:10, recurring:true, recurType:"year",
    }],
  },
  {
    id:"health", icon:"🏥", label:"Здоровье", color:"#34D399",
    hint:"Появится задача-напоминание о визите или мероприятии.",
    hintColor:"#34D399",
    defaultRec:false, defaultRecType:"",
    makeTasks:(title)=>[{
      title:`🏥 Визит/мероприятие: ${title}`,
      period:"day", xp:25, recurring:false, recurType:"",
    }],
  },
  {
    id:"custom", icon:"📌", label:"Другое", color:T.sub,
    hint:null,
    defaultRec:false, defaultRecType:"week",
    makeTasks:(title)=>[{
      title, period:"day", xp:15, recurring:false, recurType:"",
    }],
  },
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

// ─── INTERNAL HELPERS (needed by EVENT_TYPES.makeTasks) ──────────
function bdName(t) {
  const m = t.match(/(?:др|день рождения|днюха|birthday)[:\s]+(.+)/i)
         || t.match(/(.+?)[\s,–-]+(?:др|день рождения|днюха)/i);
  return m ? m[1].trim() : t.trim();
}
