import { useState, useEffect, useCallback, useRef } from "react";
import { cloudSave, cloudFind, cloudAddParticipant, cloudGetParticipants, cloudUpdateMyProgress, cloudDeduplicateParticipants } from "./firebase.js";
import OverviewScreen from "./OverviewScreen.jsx";

// ─── TELEGRAM WEBAPP INIT ─────────────────────────────────────────
const tg = typeof window !== "undefined" && window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#07071C");
  tg.setBackgroundColor("#07071C");
}

// ─── THEME ────────────────────────────────────────────────────────
const T = {
  bg0: "#07071C", bg1: "#0D0D28", bg2: "#13133A", bg3: "#1A1A4A",
  brd: "#252565", brdDim: "#1A1A48",
  gold: "#F5A623", goldL: "#FFD080", goldDim: "#8A5C0E",
  purp: "#8B5CF6", purpL: "#C4A5FF", purpDim: "#4C2A99",
  teal: "#06D6A0", tealDim: "#0A6648",
  rose: "#F43F5E", sky: "#38BDF8",
  text: "#EEEEFF", sub: "#8888BB", dim: "#3A3A6A",
};

// ─── GAME CONFIG ──────────────────────────────────────────────────
const PERIODS = [
  { id:"day",   label:"Сегодня", xp:15,  accent:T.teal,  icon:"⚡", desc:"на сегодня" },
  { id:"week",  label:"Неделя", xp:50,  accent:T.sky,   icon:"🌊", desc:"на неделю"  },
  { id:"month", label:"Месяц",  xp:150, accent:T.purpL, icon:"💫", desc:"на месяц"   },
  { id:"year",  label:"Год",    xp:600, accent:T.gold,  icon:"👑", desc:"на год"     },
];

// 80-level progressive XP table: cumulative XP to reach each level
// Formula: sum(100 * k^2) for k=1..i  → easy early, brutal late
// Level 2=100 XP, Level 10=~28k, Level 30=~856k, Level 80=~16.7M
const XP_TABLE = Array.from({length:80}, (_,i) =>
  i===0 ? 0 : Math.round(100 * i * (i+1) * (2*i+1) / 6)
);

const RANKS = [
  // 1-10: Новичок
  "Новобранец","Послушник","Искатель","Скиталец","Авантюрист",
  "Наёмник","Боец","Воин","Страж","Рыцарь",
  // 11-20: Опытный
  "Ветеран","Мастер","Командир","Защитник","Чемпион",
  "Герой","Избранный","Легат","Хранитель","Паладин",
  // 21-30: Продвинутый
  "Чародей","Заклинатель","Волшебник","Архимаг","Оракул",
  "Провидец","Пророк","Мудрец","Гуру","Просветлённый",
  // 31-40: Элита
  "Верховный страж","Сенешаль","Протектор","Лорд","Властитель",
  "Маршал","Феникс","Дракон","Полубог","Бессмертный",
  // 41-50: Легендарный
  "Миф","Легенда","Апофеоз","Архонт","Немезида",
  "Величие","Небожитель","Непостижимый","Безграничный","Вечный",
  // 51-60: Мифический
  "Запредельный","Трансцендентный","Абсолют","Ультимат","Один",
  "Высший","Непревзойдённый","Астральный","Космический","Вселенский",
  // 61-70: Божественный
  "Надмирный","Первопричина","Предвечный","Примордиальный","Сингулярность",
  "Бесконечность","Омега","Непознаваемый","Трансцендентность","Квинтэссенция",
  // 71-80: Запредельный
  "Надвременный","Первозданный","Незыблемый","Абсолютное Бытие","Альфа и Омега",
  "Эпохальный","Надсущностный","Внеопытный","Тотальный","Легенда Вечности",
];

const RANK_ICONS = [
  // 1-10
  "🪨","📖","🔍","🗺️","🥊","⚔️","🛡️","🎖️","🏰","👑",
  // 11-20
  "🎯","📜","🔱","🌟","🏆","⭐","💫","✨","🌙","🛡",
  // 21-30
  "🔮","💫","🌀","🔯","🧿","👁️","🌠","🎓","🧙","💡",
  // 31-40
  "⚜️","🌋","🦁","🦅","🌈","⚡","🐉","🔥","🌊","💎",
  // 41-50
  "📿","🌌","🌠","⚖️","☄️","🌑","🌃","🌌","♾️","⌛",
  // 51-60
  "🌀","🌊","🔥","⚡","🌟","🔯","🏆","🪐","🌍","🌺",
  // 61-70
  "🌙","🌞","⭐","💀","🔮","♾️","🧬","⚛️","🌀","🌺",
  // 71-80
  "⏳","🌱","🗿","☯️","🌐","🔑","🕊️","🌊","🔥","👑",
];
const MONTHS_RU  = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WDAYS      = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

const lvlOf  = xp => Math.min(RANKS.length, [...XP_TABLE].reverse().findIndex(v => xp >= v) === -1 ? 1 : XP_TABLE.length - [...XP_TABLE].reverse().findIndex(v => xp >= v));
const progOf = xp => { const l = lvlOf(xp); if (l >= RANKS.length) return 1; const a = XP_TABLE[l-1]??0, b = XP_TABLE[l]??a+1; return Math.min((xp-a)/(b-a),1); };
const nextXP = xp => { const l = lvlOf(xp); return l >= RANKS.length ? 0 : (XP_TABLE[l]??0) - xp; };

const todayStr    = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const fmtDate  = s => { const [y,m,d] = s.split("-"); return `${d}.${m}.${y}`; };
const uid      = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`;

const endOfWeek  = () => { const d=new Date(); const dow=d.getDay(); const diff=dow===0?0:7-dow; d.setDate(d.getDate()+diff); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const endOfMonth = () => { const d=new Date(); d.setMonth(d.getMonth()+1,0); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const endOfYear  = () => { const d=new Date(); return `${d.getFullYear()}-12-31`; };
const defaultDueForPeriod = p => p==="week"?endOfWeek():p==="month"?endOfMonth():p==="year"?endOfYear():todayStr();

const isInCurrentWeek  = s => { const d=new Date(s+"T12:00:00"); const now=new Date(); const dow=now.getDay(); const mon=new Date(now); mon.setDate(now.getDate()-(dow===0?6:dow-1)); mon.setHours(0,0,0,0); const sun=new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999); return d>=mon&&d<=sun; };
const isInCurrentMonth = s => { const d=new Date(s+"T12:00:00"); const now=new Date(); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); };
const isInCurrentYear  = s => { const d=new Date(s+"T12:00:00"); return d.getFullYear()===new Date().getFullYear(); };

const daysLeft = s => { const d=new Date(s+"T23:59:59"); const now=new Date(); const diff=Math.ceil((d-now)/86400000); if(diff<0)return"просрочено"; if(diff===0)return"сегодня"; return`${diff} дн.`; };

const isBdTitle = t => /\bдр\b|день рождения|днюха|birthday/i.test(t);
const bdName    = t => { const m = t.match(/(?:др|день рождения|днюха|birthday)[:\s]+(.+)/i)||t.match(/(.+?)[\s,–-]+(?:др|день рождения|днюха)/i); return m?m[1].trim():t.trim(); };

// ─── LOCALSTORAGE ─────────────────────────────────────────────────
const LS = "questly_v2";
const loadState = () => {
  try {
    const r = localStorage.getItem(LS) || localStorage.getItem("questly_v1");
    if (!r) return null;
    const state = JSON.parse(r);
    // Migrate: add streakEnabled/streak defaults if missing
    if (state.tasks) {
      state.tasks = state.tasks.map(t => ({
        streakEnabled: false, streak: 0, ...t,
      }));
    }
    return state;
  } catch { return null; }
};
const saveState = s => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch {} };

// ─── SOCIAL LOCALSTORAGE ──────────────────────────────────────────
const LS_SOC = "questly_social_v1";
const loadSocial = () => { try { const r=localStorage.getItem(LS_SOC); return r?JSON.parse(r):null; } catch { return null; } };
const saveSocial = s => { try { localStorage.setItem(LS_SOC, JSON.stringify(s)); } catch {} };

const mkCode = () => Math.random().toString(36).slice(2,8).toUpperCase();

// Simulate today ±N days for demo history
const pastDay = n => { const d=new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

const INIT_CHALLENGES = [
  {
    id:"demo_ch1",
    title:"Утренняя зарядка",
    emoji:"🏋️",
    desc:"Каждое утро — 15 минут разминки",
    shareCode: mkCode(),
    recurType:"day",
    createdAt: pastDay(14),
    myStreak:14,
    myHistory: Array.from({length:14},(_,i)=>pastDay(13-i)),
    participants:[
      { name:"Маша", avatar:"👩", streak:11, lastCompleted:pastDay(0),
        history: Array.from({length:11},(_,i)=>pastDay(10-i)) }
    ],
  },
];

const INIT_SHARED_GOALS = [
  {
    id:"demo_sg1",
    title:"Ужин в пятницу 🍷",
    emoji:"🛒",
    shareCode: mkCode(),
    createdAt: todayStr(),
    participants:["Ты","Маша"],
    items:[
      {id:uid(),title:"Вино 🍷",        assignedTo:"Ты",   doneBy:"Ты",   done:true },
      {id:uid(),title:"Сыр 🧀",         assignedTo:"Маша", doneBy:"Маша", done:true },
      {id:uid(),title:"Хлеб 🥖",        assignedTo:null,   doneBy:null,   done:false},
      {id:uid(),title:"Оливки 🫒",      assignedTo:null,   doneBy:null,   done:false},
      {id:uid(),title:"Свечи 🕯️",      assignedTo:"Маша", doneBy:null,   done:false},
    ],
  },
];

// ─── DEMO DATA ────────────────────────────────────────────────────
const today = todayStr();
const INIT_TASKS = [
  { id:uid(), title:"Утренняя зарядка",     period:"day",   done:false, xp:15,  dueDate:today, recurring:true,  recurType:"day",  streakEnabled:true,  streak:0 },
  { id:uid(), title:"Прочитать 20 страниц", period:"day",   done:true,  xp:15,  dueDate:today, recurring:false, recurType:"",     streakEnabled:false, streak:0 },
  { id:uid(), title:"Подготовить отчёт",    period:"week",  done:false, xp:50,  dueDate:today, recurring:false, recurType:"",     streakEnabled:false, streak:0 },
  { id:uid(), title:"Пройти курс по React", period:"month", done:false, xp:150, dueDate:today, recurring:false, recurType:"",     streakEnabled:false, streak:0 },
  { id:uid(), title:"Запустить проект",     period:"year",  done:false, xp:600, dueDate:today, recurring:false, recurType:"",     streakEnabled:false, streak:0 },
];
const INIT_EVENTS = [
  { id:uid(), title:"ДР Алексея",       date:today, recurring:true,  recurType:"year", isBirthday:true,  color:T.gold, eventType:"birthday" },
  { id:uid(), title:"Созвон с командой",date:today, recurring:true,  recurType:"week", isBirthday:false, color:T.sky,  eventType:"meeting"  },
  { id:uid(), title:"Дедлайн проекта",  date:today, recurring:false, recurType:"",     isBirthday:false, color:T.rose, eventType:"deadline" },
];

// ─── EVENT TYPES ──────────────────────────────────────────────────
const EVENT_TYPES = [
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
      { title:`✈️ Купить билеты: ${title}`,        period:"day", xp:30, recurring:false, recurType:"", dueDate:date },
      { title:`🧳 Упаковать чемодан: ${title}`,    period:"day", xp:20, recurring:false, recurType:"", dueDate:date },
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
const CHECKLIST_PRESETS = [
  { id:"shop",     icon:"🛒", label:"Покупки"   },
  { id:"travel",   icon:"🧳", label:"В дорогу"  },
  { id:"guests",   icon:"👥", label:"Гости"     },
  { id:"gifts",    icon:"🎁", label:"Подарки"   },
  { id:"movies",   icon:"🎬", label:"Фильмы"    },
  { id:"books",    icon:"📚", label:"Книги"     },
  { id:"series",   icon:"📺", label:"Сериалы"   },
  { id:"custom",   icon:"✏️", label:"Своё"      },
];


// Non-recurring unfinished tasks from past periods → moved to today
// Recurring tasks: handled by spawnRecurring (new instance each period)
// Streak resets if a recurring task is missed (determined at spawn time)
const autoRollover = (tasks) => {
  return tasks.map(t => {
    if (!t.done && t.dueDate < today && !t.recurring) {
      return {
        ...t,
        dueDate: today,
        rolledOver: true,
        streak: 0, // streak breaks if you miss
      };
    }
    return t;
  });
};

// ─── RECURRING AUTO-SPAWN ─────────────────────────────────────────
const spawnRecurring = (tasks, events, day) => {
  const next = [...tasks];
  tasks.filter(t => t.recurring && t.dueDate !== day).forEach(t => {
    const ok = t.recurType==="day"
      || (t.recurType==="week" && new Date(t.dueDate).getDay()===new Date(day).getDay())
      || (t.recurType==="year" && t.dueDate.slice(5)===day.slice(5));
    if (ok && !next.some(x => x.title===t.title && x.dueDate===day)) {
      // Streak: check if the previous period's instance was completed
      let inheritedStreak = 0;
      if (t.streakEnabled) {
        // Find the most recent done instance of this recurring task
        const doneInstances = tasks
          .filter(x => x.title===t.title && x.streakEnabled && x.done)
          .sort((a,b) => b.dueDate.localeCompare(a.dueDate));
        if (doneInstances.length > 0) {
          const lastDone = doneInstances[0];
          // Check if the gap is exactly one period (streak continues) or broken
          const lastDate = new Date(lastDone.dueDate);
          const today_ = new Date(day);
          const diffMs = today_ - lastDate;
          const diffDays = Math.round(diffMs / 86400000);
          const streakContinues =
            (t.recurType==="day"  && diffDays <= 1)  ||
            (t.recurType==="week" && diffDays <= 7)  ||
            (t.recurType==="year" && diffDays <= 366);
          inheritedStreak = streakContinues ? (lastDone.streak || 0) : 0;
        }
      }
      next.unshift({...t, id:uid(), done:false, dueDate:day,
        streak: inheritedStreak, rolledOver: false});
    }
  });
  // Spawn tasks from recurring calendar events using EVENT_TYPES templates
  events.filter(e => e.recurring).forEach(ev => {
    const [,em,ed] = ev.date.split("-").map(Number);
    const [,dm,dd] = day.split("-").map(Number);
    const ok = ev.recurType==="day"
      || (ev.recurType==="week" && new Date(ev.date).getDay()===new Date(day).getDay())
      || (ev.recurType==="year" && em===dm && ed===dd);
    if (!ok) return;
    const evTypeDef = EVENT_TYPES.find(t=>t.id===ev.eventType) || EVENT_TYPES.find(t=>t.id==="custom");
    const templates = evTypeDef.makeTasks(ev.title, day);
    templates.forEach(tmpl => {
      if (!next.some(x => x.title===tmpl.title && x.dueDate===day))
        next.unshift({id:uid(), done:false, period:"day", xp:tmpl.xp||15,
          dueDate:day, recurring:true, recurType:ev.recurType,
          streakEnabled:false, streak:0, eventId:ev.id, ...tmpl});
    });
  });
  return next;
};

// ─── SHARED COMPONENTS ────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <div onClick={e => { e.stopPropagation(); onChange(!value); }} style={{
      width:44,height:24,borderRadius:12,cursor:"pointer",
      background:value?T.purp:T.dim,position:"relative",transition:"background 0.25s",flexShrink:0,
    }}>
      <div style={{
        position:"absolute",top:3,left:value?23:3,
        width:18,height:18,borderRadius:"50%",background:"#fff",
        transition:"left 0.2s cubic-bezier(.34,1.56,.64,1)",
        boxShadow:"0 1px 4px rgba(0,0,0,0.4)",
      }}/>
    </div>
  );
}

function XPBar({ progress, color=T.purp, height=8 }) {
  return (
    <div style={{height,background:T.brd,borderRadius:height/2,overflow:"hidden"}}>
      <div style={{
        height:"100%",borderRadius:height/2,
        width:`${Math.round(Math.min(progress,1)*100)}%`,
        background:`linear-gradient(90deg,${color},${T.gold})`,
        transition:"width 0.9s cubic-bezier(.34,1.56,.64,1)",
      }}/>
    </div>
  );
}

function PeriodBadge({ period, small }) {
  const p = PERIODS.find(x => x.id===period);
  return (
    <span style={{
      fontSize:small?10:11,fontWeight:600,
      padding:small?"1px 6px":"2px 8px",borderRadius:20,
      background:p.accent+"22",color:p.accent,
      border:`1px solid ${p.accent}44`,letterSpacing:"0.03em",whiteSpace:"nowrap",
    }}>{p.icon} {p.label}</span>
  );
}

function ModalOverlay({ onClose, children }) {
  useEffect(() => { document.body.style.overflow="hidden"; return ()=>{document.body.style.overflow="";}; },[]);
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:100,
      background:"rgba(4,4,20,0.88)",backdropFilter:"blur(6px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center",
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:T.bg1,borderRadius:"20px 20px 0 0",
        padding:"8px 16px calc(36px + env(safe-area-inset-bottom,0px))",
        width:"100%",maxWidth:420,
        border:`1px solid ${T.brd}`,borderBottom:"none",
        animation:"slideUp 0.32s cubic-bezier(.34,1.56,.64,1)",
        maxHeight:"90vh",overflowY:"auto",
        position:"relative",
      }}>
        {/* Drag handle */}
        <div style={{width:40,height:4,borderRadius:2,background:T.brd,margin:"8px auto 16px"}}/>
        {/* Close button */}
        <div onClick={onClose} style={{
          position:"absolute",top:14,right:14,
          width:32,height:32,borderRadius:"50%",
          background:T.bg3,border:`1px solid ${T.brd}`,
          display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",fontSize:18,color:T.sub,fontWeight:400,
          lineHeight:1,zIndex:10,flexShrink:0,
          transition:"background 0.15s, color 0.15s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.background=T.rose+"33";e.currentTarget.style.color=T.rose;}}
        onMouseLeave={e=>{e.currentTarget.style.background=T.bg3;e.currentTarget.style.color=T.sub;}}
        >×</div>
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:8}}>{children}</div>;
}

function Btn({ children, onClick, variant="primary", style:s={}, disabled=false }) {
  const base = {padding:"12px 16px",borderRadius:12,cursor:disabled?"not-allowed":"pointer",fontSize:14,fontWeight:700,border:"none",width:"100%",opacity:disabled?0.45:1,transition:"opacity 0.15s"};
  const v = {
    primary:   {background:`linear-gradient(135deg,${T.purp},${T.gold})`,color:"#fff"},
    teal:      {background:`linear-gradient(135deg,${T.teal},${T.sky})`,color:"#04202F"},
    ghost:     {background:"transparent",border:`1px solid ${T.brd}`,color:T.sub},
    danger:    {background:T.rose+"22",border:`1px solid ${T.rose}55`,color:T.rose},
  };
  return <button onClick={disabled?undefined:onClick} style={{...base,...v[variant],...s}}>{children}</button>;
}

function StyledInput({ value, onChange, placeholder, type="text", autoFocus, onKeyDown }) {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      autoFocus={autoFocus} onKeyDown={onKeyDown}
      onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
      style={{
        width:"100%",padding:"11px 14px",background:T.bg0,
        border:`1px solid ${focused?T.purp:T.brd}`,borderRadius:11,
        color:T.text,fontSize:15,outline:"none",
        transition:"border-color 0.15s",colorScheme:"dark",
      }}/>
  );
}

function RecurPicker({ value, onChange, accentC=T.purp, accentL=T.purpL }) {
  return (
    <div style={{display:"flex",gap:8}}>
      {[["day","Ежедневно"],["week","Еженедельно"],["year","Ежегодно"]].map(([rt,lbl])=>(
        <div key={rt} onClick={()=>onChange(rt)} style={{
          flex:1,padding:"8px 4px",borderRadius:9,cursor:"pointer",
          textAlign:"center",fontSize:12,fontWeight:600,
          border:`1px solid ${value===rt?accentC:T.brd}`,
          background:value===rt?accentC+"33":T.bg0,
          color:value===rt?accentL:T.sub,transition:"all 0.15s",
        }}>{lbl}</div>
      ))}
    </div>
  );
}

// ─── TASK MODAL (create + edit) ───────────────────────────────────
function TaskModal({ onClose, onSave, onDelete, existing=null, initialDate=null }) {
  const isEdit = !!existing;
  const [title,    setTitle]  = useState(existing?.title    ?? "");
  const [period,   setPeriod] = useState(existing?.period   ?? "day");
  const [dueDate,  setDate]   = useState(existing?.dueDate  ?? initialDate ?? defaultDueForPeriod(existing?.period ?? "day"));
  const [recurring,setRec]    = useState(existing?.recurring ?? false);
  const [recurType,setRT]     = useState(existing?.recurType ?? "day");
  const [streakEnabled, setStreak] = useState(existing?.streakEnabled ?? false);
  const [bulkMode, setBulk]   = useState(false);
  const [bulkText, setBulkText] = useState("");
  // Checklist (formerly "shopping list")
  const [hasChecklist, setHasChecklist] = useState(!!(existing?.shopItems?.length));
  const [checkPresetId, setCheckPresetId] = useState(existing?.checklistPresetId || "shop");
  const [checklistIcon, setCheckIcon] = useState(existing?.checklistIcon || "🛒");
  const [checklistName, setCheckName] = useState(existing?.checklistName || "Покупки");
  const [customEmoji,  setCustomEmoji]  = useState(existing?.checklistIcon || "");
  const [customLabel,  setCustomLabel]  = useState(existing?.checklistName || "");
  const [shopItems,  setShopItems]  = useState(existing?.shopItems ?? []);
  const [shopInput,  setShopInput]  = useState("");

  const pickPreset = p => {
    setCheckPresetId(p.id);
    if (p.id !== "custom") { setCheckIcon(p.icon); setCheckName(p.label); }
    else { setCheckIcon(customEmoji||"📋"); setCheckName(customLabel||"Список"); }
  };

  const handleSetRec = v => { setRec(v); if (!v) setStreak(false); };
  const handlePeriodChange = p => { setPeriod(p); if (!isEdit) setDate(defaultDueForPeriod(p)); };

  const submit = () => {
    const p = PERIODS.find(x=>x.id===period);
    if (bulkMode && !isEdit) {
      const lines = bulkText.split("\n").map(l=>l.trim()).filter(Boolean);
      if (!lines.length) return;
      lines.forEach(line => onSave({ id:uid(), title:line, period, done:false, xp:p.xp, dueDate, recurring, recurType, streakEnabled, streak:0 }));
      onClose();
      return;
    }
    if (!title.trim()) return;
    onSave({
      id:existing?.id??uid(), title:title.trim(), period, done:existing?.done??false,
      xp:p.xp, dueDate, recurring, recurType, streakEnabled, streak:existing?.streak??0,
      ...(hasChecklist && period==="day" ? {
        shopItems,
        checklistIcon: checkPresetId==="custom" ? (customEmoji||"📋") : checklistIcon,
        checklistName: checkPresetId==="custom" ? (customLabel||"Список") : checklistName,
        checklistPresetId: checkPresetId,
      } : {}),
    });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{margin:"0 0 18px",fontSize:18,fontWeight:800,color:isEdit?T.purpL:T.gold}}>
        {isEdit?"✏️ Редактировать квест":"⚔️ Новый квест"}
      </h3>

      {/* Bulk / Single mode tabs (only on create) */}
      {!isEdit && (
        <div style={{display:"flex",gap:6,marginBottom:14,background:T.bg0,borderRadius:11,padding:4,border:`1px solid ${T.brd}`}}>
          {[["single","⚡ Одна задача"],["bulk","📋 Список"]].map(([mode,label])=>(
            <div key={mode} onClick={()=>setBulk(mode==="bulk")} style={{
              flex:1,padding:"8px 0",borderRadius:8,textAlign:"center",
              fontSize:13,fontWeight:700,cursor:"pointer",
              background:bulkMode===(mode==="bulk")?T.purp:"transparent",
              color:bulkMode===(mode==="bulk")?"#fff":T.sub,
              transition:"all 0.2s",
            }}>{label}</div>
          ))}
        </div>
      )}

      <div style={{marginBottom:14}}>
        <SectionLabel>{bulkMode&&!isEdit?"Задачи (каждая строка — новое дело)":"Название задачи"}</SectionLabel>
        {bulkMode && !isEdit ? (
          <textarea
            value={bulkText}
            onChange={e=>setBulkText(e.target.value)}
            placeholder={"Утренняя зарядка\nПрочитать 20 страниц\nОтправить отчёт..."}
            
            rows={5}
            style={{
              width:"100%",padding:"11px 14px",background:T.bg0,
              border:`1px solid ${T.purp}`,borderRadius:11,
              color:T.text,fontSize:15,outline:"none",resize:"vertical",
              colorScheme:"dark",fontFamily:"inherit",lineHeight:1.6,
              minHeight:120,
            }}
          />
        ) : (
          <StyledInput value={title} onChange={e=>setTitle(e.target.value)}
            placeholder="Введите задачу..." onKeyDown={e=>e.key==="Enter"&&submit()}/>
        )}
        {bulkMode && !isEdit && bulkText.trim() && (
          <div style={{fontSize:11,color:T.teal,marginTop:6,fontWeight:600}}>
            ✓ Будет создано задач: {bulkText.split("\n").filter(l=>l.trim()).length}
          </div>
        )}
      </div>

      <div style={{marginBottom:14}}>
        <SectionLabel>Период</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {PERIODS.map(p=>(
            <div key={p.id} onClick={()=>handlePeriodChange(p.id)} style={{
              padding:"10px 12px",borderRadius:11,cursor:"pointer",
              border:`2px solid ${period===p.id?p.accent:T.brd}`,
              background:period===p.id?p.accent+"20":T.bg0,transition:"all 0.15s",
            }}>
              <div style={{fontSize:14,fontWeight:700,color:period===p.id?p.accent:T.sub}}>{p.icon} {p.label}</div>
              <div style={{fontSize:11,color:period===p.id?p.accent+"AA":T.dim,marginTop:2}}>+{p.xp} XP</div>
            </div>
          ))}
        </div>
      </div>

      {/* 📋 Checklist — only for daily tasks */}
      {period==="day" && !bulkMode && (
        <div style={{marginBottom:14}}>
          {/* Toggle header */}
          <div style={{
            display:"flex",alignItems:"center",justifyContent:"space-between",
            background:T.bg0,padding:"11px 14px",borderRadius:11,
            border:`1px solid ${hasChecklist?(checkPresetId==="custom"?(customEmoji?"#8B5CF655":T.brd):checklistIcon?"#8B5CF655":T.brd):T.brd}`,
            marginBottom:hasChecklist?10:0,transition:"border-color 0.2s",cursor:"pointer",
          }} onClick={()=>setHasChecklist(v=>!v)}>
            <div>
              <span style={{fontSize:14,color:T.text}}>
                {hasChecklist ? `${checkPresetId==="custom"?(customEmoji||"📋"):checklistIcon} ${checkPresetId==="custom"?(customLabel||"Список"):checklistName}` : "📋 Добавить чеклист"}
              </span>
              {hasChecklist && (
                <div style={{fontSize:11,color:T.purpL,marginTop:3,fontWeight:600}}>
                  Отмечай пункты прямо в задаче
                </div>
              )}
            </div>
            <Toggle value={hasChecklist} onChange={setHasChecklist}/>
          </div>

          {hasChecklist && (
            <div style={{background:T.bg0,border:`1px solid ${T.brd}`,borderRadius:11,padding:"12px 14px"}}>
              {/* Preset grid */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,marginBottom:8}}>Тип списка</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  {CHECKLIST_PRESETS.map(p=>(
                    <div key={p.id} onClick={()=>pickPreset(p)} style={{
                      padding:"8px 4px",borderRadius:9,cursor:"pointer",textAlign:"center",
                      border:`1.5px solid ${checkPresetId===p.id?T.purp:T.brd}`,
                      background:checkPresetId===p.id?T.purp+"33":T.bg2,
                      transition:"all 0.15s",
                    }}>
                      <div style={{fontSize:18,lineHeight:1,marginBottom:2}}>{p.icon}</div>
                      <div style={{fontSize:9,fontWeight:700,color:checkPresetId===p.id?T.purpL:T.sub,lineHeight:1.2}}>{p.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom name + emoji inputs */}
              {checkPresetId==="custom" && (
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  <input
                    value={customEmoji}
                    onChange={e=>{setCustomEmoji(e.target.value.slice(-2));setCheckIcon(e.target.value.slice(-2)||"📋");}}
                    placeholder="😊"
                    style={{
                      width:48,padding:"9px 8px",background:T.bg2,textAlign:"center",
                      border:`1px solid ${T.purp}`,borderRadius:9,
                      color:T.text,fontSize:18,outline:"none",colorScheme:"dark",flexShrink:0,
                    }}
                  />
                  <input
                    value={customLabel}
                    onChange={e=>{setCustomLabel(e.target.value);setCheckName(e.target.value||"Список");}}
                    placeholder="Название списка…"
                    style={{
                      flex:1,padding:"9px 12px",background:T.bg2,
                      border:`1px solid ${T.purp}`,borderRadius:9,
                      color:T.text,fontSize:14,outline:"none",colorScheme:"dark",
                    }}
                  />
                </div>
              )}

              {/* Items input */}
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <input
                  value={shopInput}
                  onChange={e=>setShopInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){if(!shopInput.trim())return;setShopItems(p=>[...p,{id:uid(),title:shopInput.trim(),done:false}]);setShopInput("");}}}
                  placeholder={
                    checkPresetId==="travel"?"Паспорт, зарядка, наушники…":
                    checkPresetId==="guests"?"Маша, Петя, Света…":
                    checkPresetId==="gifts"?"Цветы, книга, конфеты…":
                    checkPresetId==="movies"?"Интерстеллар, Дюна…":
                    checkPresetId==="books"?"Война и мир, Дюна…":
                    checkPresetId==="series"?"Черное зеркало, Шерлок…":
                    "Добавить пункт…"
                  }
                  style={{
                    flex:1,padding:"9px 12px",background:T.bg2,
                    border:`1px solid ${T.brd}`,borderRadius:9,
                    color:T.text,fontSize:14,outline:"none",colorScheme:"dark",
                  }}
                />
                <div onClick={()=>{if(!shopInput.trim())return;setShopItems(p=>[...p,{id:uid(),title:shopInput.trim(),done:false}]);setShopInput("");}} style={{
                  width:38,height:38,borderRadius:9,
                  background:T.purp+"33",border:`1px solid ${T.purp}66`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  cursor:"pointer",fontSize:18,color:T.purpL,flexShrink:0,
                }}>+</div>
              </div>

              {shopItems.length===0 ? (
                <div style={{fontSize:12,color:T.dim,textAlign:"center",padding:"4px 0"}}>Добавь пункты 👆</div>
              ) : (
                shopItems.map((it,i)=>(
                  <div key={it.id} style={{
                    display:"flex",alignItems:"center",gap:8,
                    padding:"7px 4px",
                    borderBottom:i<shopItems.length-1?`1px solid ${T.brdDim}`:"none",
                  }}>
                    <span style={{fontSize:14,marginRight:2}}>{checkPresetId==="custom"?(customEmoji||"📋"):checklistIcon}</span>
                    <span style={{fontSize:13,color:T.text,flex:1}}>{it.title}</span>
                    <div onClick={()=>setShopItems(p=>p.filter(x=>x.id!==it.id))} style={{
                      fontSize:13,color:T.rose,cursor:"pointer",padding:"2px 8px",
                      borderRadius:6,background:T.rose+"11",
                    }}>✕</div>
                  </div>
                ))
              )}
              {shopItems.length>0 && (
                <div style={{fontSize:11,color:T.purpL,marginTop:8,fontWeight:600,textAlign:"center"}}>
                  {shopItems.length} {shopItems.length===1?"пункт":"пункт(ов)"} в списке
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{marginBottom:14}}>
        <SectionLabel>Срок выполнения</SectionLabel>
        <StyledInput type="date" value={dueDate} onChange={e=>setDate(e.target.value)}/>
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:recurring?10:18,background:T.bg0,padding:"11px 14px",borderRadius:11,border:`1px solid ${T.brd}`}}>
        <span style={{fontSize:14,color:T.text}}>🔄 Повторяемая задача</span>
        <Toggle value={recurring} onChange={handleSetRec}/>
      </div>

      {recurring && (
        <>
          <div style={{marginBottom:10}}><RecurPicker value={recurType} onChange={setRT}/></div>

          <div style={{
            display:"flex",alignItems:"center",justifyContent:"space-between",
            marginBottom:18,background:T.bg0,padding:"11px 14px",borderRadius:11,
            border:`1px solid ${streakEnabled?"#FF6B3555":T.brd}`,
            transition:"border-color 0.2s",
          }}>
            <div>
              <span style={{fontSize:14,color:T.text}}>🔥 Отслеживать серию</span>
              {streakEnabled && (
                <div style={{fontSize:11,color:"#FF6B35",marginTop:3,fontWeight:600}}>
                  Считает дни подряд — не прерви цепочку!
                </div>
              )}
            </div>
            <Toggle value={streakEnabled} onChange={setStreak}/>
          </div>
        </>
      )}

      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Отмена</Btn>
        <Btn variant="primary" onClick={submit} style={{flex:2}} disabled={bulkMode&&!isEdit ? !bulkText.trim() : !title.trim()}>
          {isEdit?"Сохранить ✓":bulkMode?"Создать квесты ⚡":"Создать квест ⚡"}
        </Btn>
      </div>
      {isEdit && onDelete && (
        <div style={{marginTop:12}}>
          <Btn variant="danger" onClick={()=>{onDelete(existing.id);onClose();}}>🗑 Удалить квест</Btn>
        </div>
      )}
    </ModalOverlay>
  );
}

// ─── EVENT MODAL ──────────────────────────────────────────────────
function EventModal({ onClose, onCreate, onUpdate, onDelete, defaultDate, existing }) {
  const isEdit = !!existing;
  const [step,   setStep]  = useState(isEdit ? "details" : "type");
  const [typeId, setTypeId]= useState(existing?.eventType || null);
  const [title,  setTitle] = useState(existing?.title || "");
  const [date,   setDate]  = useState(existing?.date || defaultDate||today);
  const [rec,    setRec]   = useState(existing?.recurring || false);
  const [rt,     setRT]    = useState(existing?.recurType || "week");
  const [color,  setColor] = useState(existing?.color || T.sky);

  const evType = EVENT_TYPES.find(t=>t.id===typeId);

  // When type selected — apply defaults
  const pickType = (t) => {
    setTypeId(t.id);
    setRec(t.defaultRec);
    setRT(t.defaultRecType||"week");
    setColor(t.color);
    setStep("details");
  };

  const isCustomColor = typeId==="custom";

  const submit = () => {
    if (!title.trim() || !evType) return;
    const isBd = evType.id==="birthday";
    const ev = {
      id: existing?.id || uid(), title:title.trim(), date,
      recurring: rec, recurType: rec ? rt : "",
      color: evType.color,
      isBirthday: isBd,
      eventType: evType.id,
    };
    if (isEdit) {
      onUpdate(ev);
      onClose();
      return;
    }
    // Build auto-tasks
    const rawTasks = evType.makeTasks(title.trim(), date);
    const autoTasks = rawTasks.map(t=>({
      id:uid(), done:false,
      dueDate: t.dueDate || date,
      recurring: rec && !["trip"].includes(evType.id),
      recurType: rec && !["trip"].includes(evType.id) ? rt : "",
      eventId: ev.id,
      ...t,
    }));
    onCreate(ev, autoTasks);
    onClose();
  };

  // ── Step 1: Choose type ──────────────────────────────────────────
  if (step==="type") return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{margin:"0 0 4px",fontSize:18,fontWeight:800,color:T.teal}}>📅 {isEdit?"Изменить событие":"Новое событие"}</h3>
      <p style={{margin:"0 0 18px",fontSize:13,color:T.sub}}>Выбери тип — оформим автоматически</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        {EVENT_TYPES.map(t=>(
          <div key={t.id} onClick={()=>pickType(t)} style={{
            background:`linear-gradient(135deg,${t.color}18,${t.color}08)`,
            border:`1.5px solid ${t.color}44`,
            borderRadius:14, padding:"13px 14px",
            cursor:"pointer", transition:"all 0.15s",
            display:"flex", flexDirection:"column", gap:4,
          }}
          onMouseEnter={e=>e.currentTarget.style.borderColor=t.color}
          onMouseLeave={e=>e.currentTarget.style.borderColor=t.color+"44"}
          >
            <span style={{fontSize:22,lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:13,fontWeight:700,color:t.color,lineHeight:1.2}}>{t.label}</span>
          </div>
        ))}
      </div>
    </ModalOverlay>
  );

  // ── Step 2: Fill details ─────────────────────────────────────────
  const previewTasks = evType && title.trim() ? evType.makeTasks(title.trim(), date) : [];

  return (
    <ModalOverlay onClose={onClose}>
      {/* Header with back */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        {!isEdit && (
          <div onClick={()=>setStep("type")} style={{
            width:30,height:30,borderRadius:8,background:T.bg2,border:`1px solid ${T.brd}`,
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:T.sub,flexShrink:0,
          }}>‹</div>
        )}
        <h3 style={{margin:0,fontSize:17,fontWeight:800,color:evType?.color||T.teal,flex:1}}>
          {isEdit?"✏️ Редактировать событие":`${evType?.icon} ${evType?.label}`}
        </h3>
      </div>

      {/* Hint banner */}
      {evType?.hint && (
        <div style={{
          background:evType.hintColor+"15",border:`1px solid ${evType.hintColor}44`,
          borderRadius:11,padding:"9px 13px",marginBottom:14,fontSize:12.5,
          color:evType.hintColor,lineHeight:1.5,
        }}>
          {evType.hint}
        </div>
      )}

      {/* Title */}
      <div style={{marginBottom:14}}>
        <SectionLabel>Название</SectionLabel>
        <StyledInput value={title} onChange={e=>setTitle(e.target.value)}
          placeholder={
            evType?.id==="birthday" ? "ДР Алексея…" :
            evType?.id==="meeting"  ? "Встреча с командой…" :
            evType?.id==="trip"     ? "Поездка в Барселону…" :
            evType?.id==="deadline" ? "Отчёт Q2…" :
            evType?.id==="holiday"  ? "Новый год…" :
            evType?.id==="health"   ? "Приём у врача…" : "Название события…"
          }
          onKeyDown={e=>e.key==="Enter"&&submit()}/>
      </div>

      {/* Date */}
      <div style={{marginBottom:14}}>
        <SectionLabel>Дата</SectionLabel>
        <StyledInput type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </div>

      {/* Color picker — only for "custom" type */}
      {isCustomColor && (
        <div style={{marginBottom:12}}>
          <SectionLabel>Цвет метки</SectionLabel>
          <div style={{display:"flex",gap:10}}>
            {[T.sky, T.purpL, T.teal, T.gold, T.rose].map(c=>(
              <div key={c} onClick={()=>setColor(c)} style={{
                width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                border:`3px solid ${color===c?"#fff":"transparent"}`,
                boxShadow:color===c?`0 0 0 1px ${c}`:"none",transition:"all 0.15s",
              }}/>
            ))}
          </div>
        </div>
      )}

      {/* Repeat — hide for birthday (always yearly) and trip (no repeat) */}
      {!["birthday","trip"].includes(typeId) && (
        <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            marginBottom:rec?10:14,background:T.bg0,padding:"11px 14px",borderRadius:11,border:`1px solid ${T.brd}`}}>
            <span style={{fontSize:14,color:T.text}}>🔄 Повторение</span>
            <Toggle value={rec} onChange={setRec}/>
          </div>
          {rec && <div style={{marginBottom:14}}><RecurPicker value={rt} onChange={setRT} accentC={evType?.color||T.teal} accentL={evType?.color||T.teal}/></div>}
        </>
      )}

      {/* Preview of auto-tasks */}
      {previewTasks.length > 0 && (
        <div style={{
          background:T.bg0,border:`1px solid ${T.brd}`,borderRadius:11,
          padding:"10px 13px",marginBottom:16,
        }}>
          <div style={{fontSize:11,fontWeight:700,color:T.sub,letterSpacing:"0.06em",marginBottom:7,textTransform:"uppercase"}}>
            Автозадачи на {date===today?"сегодня":fmtDate(date)}
          </div>
          {previewTasks.map((t,i)=>(
            <div key={i} style={{fontSize:13,color:T.text,padding:"3px 0",borderBottom:i<previewTasks.length-1?`1px solid ${T.brd}`:"none"}}>
              {t.title}
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Отмена</Btn>
        <Btn onClick={submit} style={{flex:2,background:`linear-gradient(135deg,${evType?.color||T.teal},${evType?.color||T.teal}99)`,color:"#07071C",fontWeight:800,border:"none",opacity:title.trim()?1:0.5}} disabled={!title.trim()}>
          {isEdit?"Сохранить ✓":"Добавить ✨"}
        </Btn>
      </div>
      {isEdit && onDelete && (
        <Btn variant="ghost" onClick={()=>{onDelete(existing.id);onClose();}} style={{marginTop:8,width:"100%",color:T.rose,borderColor:T.rose+"55"}}>
          🗑 Удалить событие
        </Btn>
      )}
    </ModalOverlay>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────────
function TaskCard({ task, onToggle, onEdit, onShopToggle }) {
  const p = PERIODS.find(x=>x.id===task.period);
  const [flash, setFlash] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  const handleCheck = e => {
    e.stopPropagation();
    if (!task.done) { setFlash(true); setTimeout(()=>setFlash(false),600); }
    onToggle(task.id);
  };

  const hasShop = task.shopItems && task.shopItems.length > 0;
  const shopDone = hasShop ? task.shopItems.filter(i=>i.done).length : 0;

  return (
    <div style={{marginBottom:8}}>
      <div onClick={onEdit} style={{
        background:flash?p.accent+"22":task.done?T.bg2+"88":T.bg2,
        border:`1px solid ${task.done?T.brdDim:task.rolledOver?"#F5A62355":T.brd}`,
        borderRadius:shopOpen?"13px 13px 0 0":13,padding:"13px 14px",
        display:"flex",alignItems:"center",gap:12,
        transition:"all 0.3s ease",opacity:task.done?0.6:1,
        cursor:"pointer",
      }}>
        <div onClick={handleCheck} style={{
          width:30,height:30,borderRadius:"50%",
          border:`2.5px solid ${task.done?p.accent:T.dim}`,
          background:task.done?p.accent:"transparent",
          cursor:"pointer",flexShrink:0,
          display:"flex",alignItems:"center",justifyContent:"center",
          transition:"all 0.25s cubic-bezier(.34,1.56,.64,1)",
          boxShadow:task.done?`0 0 10px ${p.accent}66`:"none",
        }}>
          {task.done && <span style={{fontSize:15,color:"#000",fontWeight:900}}>✓</span>}
        </div>

        <div style={{flex:1,minWidth:0}}>
          <div style={{
            fontSize:15,fontWeight:500,
            color:task.done?T.sub:T.text,
            textDecoration:task.done?"line-through":"none",
            wordBreak:"break-word",
            marginBottom:5,
          }}>{task.title}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <PeriodBadge period={task.period} small/>
            <span style={{fontSize:11,color:T.gold,fontWeight:700}}>+{task.xp} XP</span>
            {task.recurring && <span style={{fontSize:10,color:T.dim}}>🔄</span>}
            {task.streakEnabled && task.streak > 0 && (
              <span style={{
                fontSize:11,fontWeight:800,color:"#FF6B35",
                background:"#FF6B3522",border:"1px solid #FF6B3544",
                padding:"1px 7px",borderRadius:20,
                display:"flex",alignItems:"center",gap:3,
              }}>🔥 {task.streak}</span>
            )}
            {task.streakEnabled && task.streak === 0 && !task.done && (
              <span style={{fontSize:10,color:T.dim,fontWeight:600}}>🔥 серия</span>
            )}
            {task.rolledOver && !task.done && (
              <span style={{fontSize:10,color:T.gold,fontWeight:600}}>↩ перенесено</span>
            )}
            {task.dueDate && task.dueDate!==today && task.period==="day" && (
              <span style={{fontSize:10,color:T.sub}}>📅 {fmtDate(task.dueDate)}</span>
            )}
            {task.dueDate && task.period!=="day" && !task.done && (
              <span style={{fontSize:10,color:daysLeft(task.dueDate)==="просрочено"?T.rose:T.sub}}>
                ⏳ {daysLeft(task.dueDate)}
              </span>
            )}
            {/* Checklist badge */}
            {hasShop && (
              <span style={{
                fontSize:11,fontWeight:700,color:T.purpL,
                background:T.purp+"22",border:`1px solid ${T.purp}44`,
                padding:"1px 7px",borderRadius:20,
              }}>{task.checklistIcon||"🛒"} {shopDone}/{task.shopItems.length}</span>
            )}
          </div>
        </div>

        {/* Checklist expand button */}
        {hasShop ? (
          <div onClick={e=>{e.stopPropagation();setShopOpen(v=>!v);}} style={{
            width:28,height:28,borderRadius:8,flexShrink:0,
            display:"flex",alignItems:"center",justifyContent:"center",
            background:shopOpen?T.purp+"33":T.bg3,
            border:`1px solid ${shopOpen?T.purp+"66":T.brd}`,
            color:shopOpen?T.purpL:T.dim,fontSize:14,cursor:"pointer",
            transition:"all 0.2s",
          }}>{shopOpen?"▲":"▼"}</div>
        ) : (
          <span style={{color:T.dim,fontSize:18,flexShrink:0}}>›</span>
        )}
      </div>

      {/* Checklist submenu */}
      {hasShop && shopOpen && (
        <div style={{
          background:T.bg1,border:`1px solid ${T.brd}`,
          borderTop:`1px solid ${T.brd}`,
          borderRadius:"0 0 13px 13px",
          padding:"10px 14px 12px",
        }}>
          <div style={{fontSize:11,color:T.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
            {task.checklistIcon||"🛒"} {task.checklistName||"Список покупок"} — {shopDone} из {task.shopItems.length}
          </div>
          <div style={{
            height:4,background:T.brd,borderRadius:2,overflow:"hidden",marginBottom:10,
          }}>
            <div style={{
              height:"100%",borderRadius:2,
              width:`${task.shopItems.length>0?Math.round(shopDone/task.shopItems.length*100):0}%`,
              background:`linear-gradient(90deg,${T.purp},${T.teal})`,
              transition:"width 0.4s ease",
            }}/>
          </div>
          {task.shopItems.map((it,i) => (
            <div key={it.id} onClick={e=>{e.stopPropagation();onShopToggle&&onShopToggle(task.id,it.id);}}
              style={{
                display:"flex",alignItems:"center",gap:10,
                padding:"9px 10px",borderRadius:9,cursor:"pointer",
                background:it.done?T.teal+"12":T.bg0,
                border:`1px solid ${it.done?T.teal+"44":T.brdDim}`,
                marginBottom:i<task.shopItems.length-1?6:0,
                transition:"all 0.2s",
              }}>
              <div style={{
                width:22,height:22,borderRadius:"50%",flexShrink:0,
                border:`2px solid ${it.done?T.teal:T.dim}`,
                background:it.done?T.teal:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,color:"#000",fontWeight:900,
                transition:"all 0.2s",
              }}>{it.done&&"✓"}</div>
              <span style={{
                fontSize:14,flex:1,
                color:it.done?T.sub:T.text,
                textDecoration:it.done?"line-through":"none",
              }}>{it.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TASKS SCREEN ─────────────────────────────────────────────────
function TasksScreen({ tasks, onToggle, onSave, onDelete, onShopToggle }) {
  const [filter,setFilter]   = useState("day");
  const [showCreate,setCreate] = useState(false);
  const [editTask,setEdit]   = useState(null);

  const FILTER_TABS = [
    { id:"day",      label:"Сегодня", icon:"⚡", accent:T.teal  },
    { id:"tomorrow", label:"Завтра",  icon:"🌅", accent:T.sky   },
    { id:"week",     label:"Неделя",  icon:"🌊", accent:T.sky   },
    { id:"month",    label:"Месяц",   icon:"💫", accent:T.purpL },
    { id:"year",     label:"Год",     icon:"👑", accent:T.gold  },
  ];

  const tmrw = tomorrowStr();

  const filtered  = tasks.filter(t => {
    if (filter === "tomorrow") return t.period === "day" && t.dueDate === tmrw;
    if (t.period !== filter) return false;
    if (!t.dueDate) return filter === "day";
    if (filter === "day")   return t.dueDate === today;
    if (filter === "week")  return isInCurrentWeek(t.dueDate);
    if (filter === "month") return isInCurrentMonth(t.dueDate);
    if (filter === "year")  return isInCurrentYear(t.dueDate);
    return true;
  });
  const done      = filtered.filter(t=>t.done).length;
  const total     = filtered.length;
  const pct       = total>0?done/total:0;
  const ft        = FILTER_TABS.find(x=>x.id===filter);
  const p         = filter === "tomorrow"
    ? { accent:T.sky, desc:"на завтра", xp:15 }
    : PERIODS.find(x=>x.id===filter);

  return (
    // ✅ FIX: position:relative so the FAB absolute-positions correctly
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>

      {/* Period filter tabs — segmented control */}
      <div style={{padding:"12px 16px 8px",flexShrink:0}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3,background:T.bg2,borderRadius:14,padding:3,border:`1px solid ${T.brd}`}}>
          {FILTER_TABS.map(ft=>{
            const active = filter===ft.id;
            return (
              <div key={ft.id} onClick={()=>setFilter(ft.id)} style={{
                borderRadius:10,cursor:"pointer",
                padding:"7px 2px",
                display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                background:active?ft.accent:"transparent",
                boxShadow:active?`0 2px 8px ${ft.accent}55`:"none",
                transition:"all 0.2s cubic-bezier(.34,1.56,.64,1)",
              }}>
                <span style={{fontSize:13,lineHeight:1}}>{ft.icon}</span>
                <span style={{
                  fontSize:10,fontWeight:700,letterSpacing:"0.01em",
                  color:active?(ft.id==="month"?"#fff":"#000"):T.sub,
                  transition:"color 0.2s",
                }}>{ft.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress banner */}
      <div style={{margin:"4px 16px 12px",background:T.bg2,borderRadius:14,padding:"14px 16px",border:`1px solid ${T.brd}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
          <div>
            <div style={{fontSize:12,color:T.sub,marginBottom:2}}>Прогресс {p.desc}</div>
            <div style={{fontSize:22,fontWeight:800,color:p.accent}}>
              {done}<span style={{fontSize:14,color:T.sub,fontWeight:400}}>/{total} квестов</span>
            </div>
          </div>
          <div style={{fontSize:13,color:T.gold,fontWeight:700}}>{Math.round(pct*100)}%</div>
        </div>
        <XPBar progress={pct} color={p.accent} height={6}/>
      </div>

      {/* List */}
      <div style={{flex:1,overflowY:"auto",padding:"0 16px",WebkitOverflowScrolling:"touch"}}>
        {filtered.length===0 ? (
          <div style={{textAlign:"center",padding:"40px 0",color:T.dim}}>
            <div style={{fontSize:40,marginBottom:12}}>🗡️</div>
            <div style={{fontSize:15,fontWeight:600,color:T.sub}}>Нет активных квестов</div>
            <div style={{fontSize:13,marginTop:4}}>Нажми + чтобы создать задачу</div>
          </div>
        ) : (
          <>
            {filtered.filter(t=>!t.done).map(t=>(
              <TaskCard key={t.id} task={t} onToggle={onToggle} onEdit={()=>setEdit(t)} onShopToggle={onShopToggle}/>
            ))}
            {filtered.some(t=>t.done) && (
              <div style={{marginTop:12}}>
                <div style={{fontSize:11,color:T.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>✓ Выполнено</div>
                {filtered.filter(t=>t.done).map(t=>(
                  <TaskCard key={t.id} task={t} onToggle={onToggle} onEdit={()=>setEdit(t)} onShopToggle={onShopToggle}/>
                ))}
              </div>
            )}
          </>
        )}
        <div style={{height:88}}/>
      </div>

      {/* FAB — correctly positioned inside relative parent */}
      <div style={{position:"absolute",bottom:20,right:16,zIndex:10}}>
        <div onClick={()=>setCreate(true)} style={{
          width:52,height:52,borderRadius:"50%",cursor:"pointer",
          background:`linear-gradient(135deg,${T.purp},${T.gold})`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:26,color:"#fff",
          boxShadow:`0 4px 20px ${T.purp}88, 0 0 0 4px ${T.bg0}`,
          transition:"transform 0.2s cubic-bezier(.34,1.56,.64,1)",
        }}>+</div>
      </div>

      {showCreate && <TaskModal onClose={()=>setCreate(false)} onSave={t=>{onSave(t);setCreate(false);}} initialDate={filter==="tomorrow"?tomorrowStr():null}/>}
      {editTask   && <TaskModal existing={editTask} onClose={()=>setEdit(null)} onSave={t=>{onSave(t);setEdit(null);}} onDelete={id=>{onDelete(id);setEdit(null);}}/>}
    </div>
  );
}

// ─── CALENDAR GRID ────────────────────────────────────────────────
function CalendarGrid({ year, month, events, selectedDate, onSelect }) {
  const first   = new Date(year,month,1);
  const last    = new Date(year,month+1,0);
  const startDow = (first.getDay()+6)%7;
  const cells   = Array(startDow).fill(null).concat(Array.from({length:last.getDate()},(_,i)=>i+1));

  const evMap = {};
  events.forEach(ev => {
    const add = d => { if (!evMap[d]) evMap[d]=[]; if (!evMap[d].find(e=>e.id===ev.id)) evMap[d].push(ev); };
    const [ey,em,ed] = ev.date.split("-").map(Number);
    if (ey===year && em===month+1) add(ed);
    if (ev.recurring && ev.recurType==="year" && em===month+1) add(ed);
    if (ev.recurring && ev.recurType==="week") {
      const dow = new Date(ev.date).getDay();
      for (let d=1; d<=last.getDate(); d++) if (new Date(year,month,d).getDay()===dow) add(d);
    }
    if (ev.recurring && ev.recurType==="day") for (let d=1;d<=last.getDate();d++) add(d);
  });

  const now=new Date(), tD=now.getDate(), tM=now.getMonth(), tY=now.getFullYear();
  const isThisMonth = month===tM && year===tY;
  const selDay = selectedDate ? parseInt(selectedDate.split("-")[2]) : null;
  const selSame = selectedDate && parseInt(selectedDate.split("-")[1])-1===month && parseInt(selectedDate.split("-")[0])===year;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
        {WDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:11,color:T.sub,fontWeight:700,padding:"4px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {cells.map((day,i) => {
          if (!day) return <div key={`e${i}`}/>;
          const isToday = isThisMonth && day===tD;
          const isSel   = selSame && day===selDay;
          const evs     = evMap[day]||[];
          const colors  = [...new Set(evs.slice(0,3).map(e=>e.color))];
          const hasBd   = evs.some(e=>e.isBirthday);
          return (
            <div key={day} onClick={()=>{
              onSelect(`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
            }} style={{
              aspectRatio:"1",borderRadius:8,cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              background:isSel?T.purp:isToday?T.bg3:"transparent",
              border:isToday&&!isSel?`1.5px solid ${T.purp}`:"1.5px solid transparent",
              transition:"all 0.15s",
              padding:"2px 0",
            }}>
              <span style={{
                fontSize:12,fontWeight:isToday?800:400,lineHeight:1,
                color:isSel?"#fff":isToday?T.purpL:hasBd?T.gold:T.text,
              }}>{day}</span>
              {colors.length>0 && (
                <div style={{display:"flex",gap:2,marginTop:2}}>
                  {colors.map((c,ci)=><div key={ci} style={{width:4,height:4,borderRadius:"50%",background:c}}/>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CALENDAR SCREEN ──────────────────────────────────────────────
function CalendarScreen({ events, tasks, onAddEvent, onEditEvent, onDeleteEvent }) {
  const now=new Date();
  const [month,setMonth]   = useState(now.getMonth());
  const [year,setYear]     = useState(now.getFullYear());
  const [selDate,setSel]   = useState(today);
  const [showModal,setModal] = useState(false);
  const [editEvent,setEditEvent] = useState(null);

  const prev = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const next = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const selEvents = events.filter(ev => {
    if (ev.date===selDate) return true;
    const [,em,ed]=ev.date.split("-").map(Number), [,sm,sd]=selDate.split("-").map(Number);
    if (ev.recurring && ev.recurType==="year" && em===sm && ed===sd) return true;
    if (ev.recurring && ev.recurType==="week") return new Date(ev.date).getDay()===new Date(selDate).getDay();
    if (ev.recurring && ev.recurType==="day") return true;
    return false;
  });
  const selTasks = tasks.filter(t=>t.dueDate===selDate);

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Calendar safe-area top padding since global header is hidden */}
      <div style={{height:"calc(10px + env(safe-area-inset-top,0px))",background:T.bg1,flexShrink:0}}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 16px 8px",background:T.bg1,borderBottom:`1px solid ${T.brd}`,flexShrink:0}}>
        <div onClick={prev} style={{width:32,height:32,borderRadius:"50%",background:T.bg2,border:`1px solid ${T.brd}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:T.sub}}>‹</div>
        <div style={{fontWeight:800,fontSize:17,color:T.text}}>{MONTHS_RU[month]} {year}</div>
        <div onClick={next} style={{width:32,height:32,borderRadius:"50%",background:T.bg2,border:`1px solid ${T.brd}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:T.sub}}>›</div>
      </div>

      <div style={{padding:"8px 12px 6px",flexShrink:0}}>
        <CalendarGrid year={year} month={month} events={events} selectedDate={selDate} onSelect={setSel}/>
      </div>

      <div style={{height:1,background:T.brd}}/>

      <div style={{flex:1,overflowY:"auto",padding:"12px 16px",WebkitOverflowScrolling:"touch"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text}}>
            {selDate===today?"📅 Сегодня":`📅 ${fmtDate(selDate)}`}
          </div>
          <div onClick={()=>setModal(true)} style={{
            padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
            background:T.teal+"22",color:T.teal,border:`1px solid ${T.teal}55`,
          }}>+ Событие</div>
        </div>

        {selEvents.length===0 && selTasks.length===0 ? (
          <div style={{textAlign:"center",padding:"30px 0",color:T.dim}}>
            <div style={{fontSize:36,marginBottom:8}}>📅</div>
            <div style={{fontSize:14}}>Нет событий в этот день</div>
          </div>
        ) : (
          <>
            {selEvents.map(ev=>(
              <div key={ev.id} onClick={()=>setEditEvent(ev)} style={{
                background:`linear-gradient(135deg,${ev.color}18,${T.bg2})`,
                border:`1px solid ${ev.color}55`,borderLeft:`4px solid ${ev.color}`,
                borderRadius:12,padding:"13px 14px",marginBottom:9,
                display:"flex",alignItems:"center",gap:12,
                boxShadow:`0 2px 12px ${ev.color}22`,
                cursor:"pointer",transition:"opacity 0.15s",
              }}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}
              >
                <div style={{width:40,height:40,borderRadius:10,background:ev.color+"22",border:`1px solid ${ev.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                  {(()=>{const t=EVENT_TYPES.find(t=>t.id===ev.eventType);return t?t.icon:"📌";})()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.title}</div>
                  <div style={{fontSize:11,color:ev.color,marginTop:3,fontWeight:600}}>
                    {ev.recurring?`🔄 ${ev.recurType==="year"?"Ежегодно":ev.recurType==="week"?"Еженедельно":"Ежедневно"}`:"📌 Разовое"}
                  </div>
                </div>
                <div style={{fontSize:14,color:T.sub,flexShrink:0}}>✏️</div>
              </div>
            ))}
            {selTasks.length>0 && (
              <div style={{fontSize:11,color:T.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Квесты на этот день</div>
            )}
            {selTasks.map(t=>(
              <div key={t.id} style={{
                background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:11,padding:"11px 14px",marginBottom:8,
                display:"flex",alignItems:"center",gap:10,
              }}>
                <div style={{
                  width:22,height:22,borderRadius:"50%",
                  background:t.done?T.teal+"44":"transparent",border:`2px solid ${t.done?T.teal:T.dim}`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,
                }}>{t.done&&"✓"}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,color:t.done?T.sub:T.text,textDecoration:t.done?"line-through":"none"}}>{t.title}</div>
                  <div style={{fontSize:11,color:T.gold,marginTop:2,fontWeight:700}}>+{t.xp} XP</div>
                </div>
                <PeriodBadge period={t.period} small/>
              </div>
            ))}
          </>
        )}
        <div style={{height:20}}/>
      </div>
      {showModal && <EventModal onClose={()=>setModal(false)} onCreate={onAddEvent} defaultDate={selDate}/>}
      {editEvent && <EventModal existing={editEvent} onClose={()=>setEditEvent(null)} onUpdate={onEditEvent} onDelete={onDeleteEvent}/>}
    </div>
  );
}

// ─── PROFILE SCREEN ───────────────────────────────────────────────
function ProfileScreen({ xp, tasks, events, nickname, onSetNickname }) {
  const level=lvlOf(xp), rank=RANKS[Math.min(level-1,RANKS.length-1)];
  const rankIcon=RANK_ICONS[Math.min(level-1,RANK_ICONS.length-1)];
  const toNext=nextXP(xp), completed=tasks.filter(t=>t.done).length, total=tasks.length;
  const [showLevelTable, setShowLevelTable] = useState(false);
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(nickname || "");

  const tgName = typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name;
  const displayName = nickname || tgName || "Герой";

  const saveNick = () => {
    onSetNickname(nickDraft.trim());
    setEditingNick(false);
  };

  // Best streak across all tasks
  const bestStreak = Math.max(0, ...tasks.filter(t=>t.streakEnabled).map(t=>t.streak||0));
  const hasShopTask = tasks.some(t=>t.shopItems && t.shopItems.length>0);
  const shopItemsDone = tasks.reduce((acc,t)=>acc+(t.shopItems?t.shopItems.filter(i=>i.done).length:0),0);
  const allPeriodsCovered = ["day","week","month","year"].every(p=>tasks.some(t=>t.period===p));

  const ACHIEVEMENTS = [
    // ── Прогресс задач
    {icon:"⚡",label:"Первый шаг",       desc:"Выполни 1 задачу",          done:completed>=1,  cat:"tasks"},
    {icon:"🔥",label:"На волне",         desc:"Выполни 5 задач",            done:completed>=5,  cat:"tasks"},
    {icon:"💪",label:"В ритме",          desc:"Выполни 25 задач",           done:completed>=25, cat:"tasks"},
    {icon:"🏆",label:"Сотня",            desc:"Выполни 100 задач",          done:completed>=100,cat:"tasks"},
    {icon:"🌟",label:"Мастер квестов",   desc:"Выполни 500 задач",          done:completed>=500,cat:"tasks"},
    {icon:"💎",label:"Целеустремлён",    desc:"Создай 10 задач",            done:total>=10,     cat:"tasks"},
    {icon:"📦",label:"Архив квестов",    desc:"Создай 50 задач",            done:total>=50,     cat:"tasks"},
    // ── Периоды
    {icon:"👑",label:"Годовой план",     desc:"Добавь годовую цель",        done:tasks.some(t=>t.period==="year"),  cat:"period"},
    {icon:"🌊",label:"Неделя",          desc:"Добавь еженедельную цель",   done:tasks.some(t=>t.period==="week"),  cat:"period"},
    {icon:"💫",label:"Месяц",           desc:"Добавь ежемесячную цель",    done:tasks.some(t=>t.period==="month"), cat:"period"},
    {icon:"🗓️",label:"Всё охвачено",   desc:"Добавь цели на все периоды", done:allPeriodsCovered,                 cat:"period"},
    // ── Стрики
    {icon:"🔥",label:"Серийщик",        desc:"Серия 7 дней подряд",        done:bestStreak>=7,   cat:"streak"},
    {icon:"💪",label:"Стойкий",         desc:"Серия 30 дней подряд",       done:bestStreak>=30,  cat:"streak"},
    {icon:"🔮",label:"Легенда серии",   desc:"Серия 100 дней подряд",      done:bestStreak>=100, cat:"streak"},
    {icon:"♾️",label:"Вечный огонь",   desc:"Серия 365 дней подряд",      done:bestStreak>=365, cat:"streak"},
    // ── Уровни
    {icon:"⭐",label:"Посвящённый",     desc:"Достигни 5 уровня",          done:level>=5,  cat:"level"},
    {icon:"🌟",label:"Искушённый",      desc:"Достигни 10 уровня",         done:level>=10, cat:"level"},
    {icon:"💫",label:"Избранный",       desc:"Достигни 20 уровня",         done:level>=20, cat:"level"},
    {icon:"🔮",label:"Архимаг",         desc:"Достигни 40 уровня",         done:level>=40, cat:"level"},
    {icon:"👑",label:"Легенда",         desc:"Достигни 60 уровня",         done:level>=60, cat:"level"},
    {icon:"⚡",label:"Запредельный",    desc:"Достигни 80 уровня",         done:level>=80, cat:"level"},
    // ── Привычки и разное
    {icon:"🔄",label:"Привычка",        desc:"Создай повторяемую задачу",  done:tasks.some(t=>t.recurring), cat:"habit"},
    {icon:"📋",label:"Оптовик",         desc:"Используй режим «Список»",   done:tasks.filter(t=>!t.recurring).length>=5&&total>=5, cat:"habit"},
    {icon:"🛒",label:"Шопоголик",       desc:"Создай список покупок",      done:hasShopTask,     cat:"habit"},
    {icon:"🧺",label:"Закупился",       desc:"Отметь 10 покупок",          done:shopItemsDone>=10,cat:"habit"},
    // ── Календарь и события
    {icon:"🎂",label:"Не забуду",       desc:"Добавь день рождения",       done:events.some(e=>e.isBirthday),  cat:"events"},
    {icon:"📅",label:"Организатор",     desc:"Добавь 5 событий",           done:events.length>=5,               cat:"events"},
    {icon:"🗺️",label:"Путешественник", desc:"Добавь событие «Поездка»",   done:events.some(e=>e.eventType==="trip"), cat:"events"},
    {icon:"⏰",label:"Дедлайнер",       desc:"Добавь событие «Дедлайн»",   done:events.some(e=>e.eventType==="deadline"), cat:"events"},
    {icon:"🎉",label:"Праздник!",       desc:"Добавь событие «Праздник»",  done:events.some(e=>e.eventType==="holiday"), cat:"events"},
    {icon:"📅",label:"Хронист",         desc:"Добавь 20 событий",          done:events.length>=20, cat:"events"},
  ];

  const doneCount = ACHIEVEMENTS.filter(a=>a.done).length;

  // Level progression table data — show 5 rows around current level + some milestones
  const MILESTONE_LEVELS = [1,2,3,5,10,15,20,30,40,50,60,70,80];
  const tableRows = [...new Set([
    ...MILESTONE_LEVELS,
    level, level+1, level+2,
  ])].filter(l=>l>=1&&l<=80).sort((a,b)=>a-b);

  const fmtXP = n => n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(0)+"K":n;

  return (
    <div style={{flex:1,overflowY:"auto",padding:"14px 16px",WebkitOverflowScrolling:"touch"}}>
      {/* Character card */}
      <div style={{background:`linear-gradient(145deg,${T.bg2},${T.bg3})`,border:`1px solid ${T.brd}`,borderRadius:20,padding:"20px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:T.purp+"22",filter:"blur(30px)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-20,left:-20,width:80,height:80,borderRadius:"50%",background:T.gold+"22",filter:"blur(20px)",pointerEvents:"none"}}/>

        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
          <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${T.purpDim},${T.bg3})`,border:`2px solid ${T.purp}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,boxShadow:`0 0 20px ${T.purp}44`}}>{rankIcon}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Уровень {level} / 80</div>
            {editingNick ? (
              <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4,marginBottom:4}}>
                <input
                  autoFocus
                  value={nickDraft}
                  onChange={e=>setNickDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")saveNick();if(e.key==="Escape")setEditingNick(false);}}
                  placeholder="Введи ник…"
                  maxLength={24}
                  style={{
                    flex:1,padding:"6px 10px",background:T.bg0,
                    border:`1px solid ${T.purp}`,borderRadius:9,
                    color:T.text,fontSize:16,fontWeight:800,outline:"none",
                    colorScheme:"dark",
                  }}
                />
                <div onClick={saveNick} style={{
                  padding:"6px 12px",borderRadius:9,cursor:"pointer",
                  background:T.purp,color:"#fff",fontSize:13,fontWeight:700,flexShrink:0,
                }}>✓</div>
              </div>
            ) : (
              <div style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}
                onClick={()=>{setNickDraft(nickname||"");setEditingNick(true);}}>
                <div style={{fontSize:22,fontWeight:900,color:T.text,lineHeight:1.1}}>
                  {displayName}
                </div>
                <div style={{
                  fontSize:12,color:T.sub,background:T.bg3,
                  border:`1px solid ${T.brd}`,borderRadius:6,
                  padding:"2px 7px",flexShrink:0,
                }}>✏️</div>
              </div>
            )}
            <div style={{fontSize:14,color:T.purpL,fontWeight:600}}>{rank}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:24,fontWeight:900,color:T.gold,lineHeight:1}}>{xp.toLocaleString()}</div>
            <div style={{fontSize:11,color:T.goldDim}}>очков опыта</div>
          </div>
        </div>

        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:12,color:T.sub}}>До уровня {level<80?level+1:"MAX"}</span>
            <span style={{fontSize:12,color:T.gold,fontWeight:700}}>{toNext>0?`ещё ${toNext.toLocaleString()} XP`:"Максимум! 👑"}</span>
          </div>
          <XPBar progress={progOf(xp)} color={T.purp} height={10}/>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[
          {label:"Выполнено",     value:completed,                          icon:"✅",color:T.teal},
          {label:"Всего квестов", value:total,                              icon:"📜",color:T.sky},
          {label:"Событий",       value:events.length,                      icon:"📅",color:T.purpL},
          {label:"Лучшая серия",  value:bestStreak>0?`${bestStreak} 🔥`:"—",icon:"🏆",color:"#FF6B35"},
        ].map(s=>(
          <div key={s.label} style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:13,padding:"14px 16px"}}>
            <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:26,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:12,color:T.sub,marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* By period */}
      <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>📊 Выполнено по периодам</div>
        {PERIODS.map(p=>{
          const cnt=tasks.filter(t=>t.period===p.id&&t.done).length;
          const tot=tasks.filter(t=>t.period===p.id).length;
          return (
            <div key={p.id} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:13,color:p.accent}}>{p.icon} {p.label}</span>
                <span style={{fontSize:12,color:T.sub}}>{cnt}/{tot}</span>
              </div>
              <XPBar progress={tot>0?cnt/tot:0} color={p.accent} height={5}/>
            </div>
          );
        })}
      </div>

      {/* Achievements */}
      <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>🏆 Достижения</div>
          <div style={{fontSize:12,color:T.gold,fontWeight:700}}>{doneCount}/{ACHIEVEMENTS.length}</div>
        </div>
        <XPBar progress={doneCount/ACHIEVEMENTS.length} color={T.gold} height={4}/>
        <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {ACHIEVEMENTS.map(a=>(
            <div key={a.label} style={{
              background:a.done?T.gold+"22":T.bg0,
              border:`1px solid ${a.done?T.gold+"66":T.brd}`,
              borderRadius:11,padding:"12px",transition:"all 0.3s",
            }}>
              <div style={{fontSize:22,marginBottom:4,filter:a.done?"none":"grayscale(0.8) opacity(0.4)"}}>{a.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:a.done?T.gold:T.sub}}>{a.label}</div>
              <div style={{fontSize:10,color:a.done?T.goldDim:T.dim,marginTop:3,lineHeight:1.4}}>{a.desc}</div>
              {!a.done && <div style={{fontSize:9,color:T.dim,marginTop:4,fontWeight:600,letterSpacing:"0.04em"}}>🔒 не открыто</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Level Progression Table */}
      <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,cursor:"pointer"}}
          onClick={()=>setShowLevelTable(v=>!v)}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>📈 Таблица уровней (80)</div>
          <div style={{
            fontSize:11,color:T.purpL,fontWeight:700,
            background:T.purp+"22",border:`1px solid ${T.purp}44`,
            padding:"3px 10px",borderRadius:20,
          }}>{showLevelTable?"▲ Свернуть":"▼ Показать"}</div>
        </div>

        {showLevelTable && (
          <>
            <div style={{fontSize:11,color:T.sub,marginBottom:10,lineHeight:1.5}}>
              Ранние уровни достигаются быстро. С каждым уровнем требования растут — уровень 80 потребует миллионы XP.
            </div>
            <div style={{
              display:"grid",
              gridTemplateColumns:"36px 1fr 80px 60px",
              gap:"0 8px",
              fontSize:11,
            }}>
              {/* Header */}
              {["Ур.","Ранг","Нужно XP","Всего"].map(h=>(
                <div key={h} style={{color:T.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",padding:"4px 0",borderBottom:`1px solid ${T.brd}`,marginBottom:4}}>{h}</div>
              ))}
              {tableRows.map(l => {
                const isCurrent = l === level;
                const isReached = xp >= (XP_TABLE[l-1]??0);
                const needed = l===1?0:(XP_TABLE[l-1]??0)-(XP_TABLE[l-2]??0);
                const total_ = XP_TABLE[l-1]??0;
                return [
                  <div key={`l${l}`} style={{color:isCurrent?T.gold:isReached?T.teal:T.sub,fontWeight:isCurrent?900:600,padding:"5px 0",borderBottom:`1px solid ${T.brdDim}`,display:"flex",alignItems:"center",gap:3}}>
                    {isCurrent?"▶":""}{l}
                  </div>,
                  <div key={`r${l}`} style={{color:isCurrent?T.gold:isReached?T.text:T.dim,fontWeight:isCurrent?800:400,padding:"5px 0",borderBottom:`1px solid ${T.brdDim}`,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {RANK_ICONS[Math.min(l-1,79)]} {RANKS[Math.min(l-1,79)]}
                  </div>,
                  <div key={`n${l}`} style={{color:isCurrent?T.purpL:isReached?T.sub:T.dim,padding:"5px 0",borderBottom:`1px solid ${T.brdDim}`,textAlign:"right"}}>
                    {l===1?"—":"+"+fmtXP(needed)}
                  </div>,
                  <div key={`t${l}`} style={{color:isCurrent?T.gold:isReached?T.teal:T.dim,fontWeight:isCurrent?800:400,padding:"5px 0",borderBottom:`1px solid ${T.brdDim}`,textAlign:"right"}}>
                    {l===1?"0":fmtXP(total_)}
                  </div>,
                ];
              })}
            </div>
            <div style={{marginTop:12,fontSize:11,color:T.dim,textAlign:"center"}}>
              Уровень 80 требует {(XP_TABLE[79]/1000000).toFixed(1)}M XP — ~{Math.round(XP_TABLE[79]/15).toLocaleString()} ежедневных задач
            </div>
          </>
        )}
      </div>
      <div style={{height:20}}/>
    </div>
  );
}

// ─── SHARE SHEET ─────────────────────────────────────────────────
function ShareSheet({ code, title, onClose }) {
  const [copied,setCopied]=useState(false);
  const link = `https://t.me/questlytaskbot?start=${code}`;
  const copy = () => { navigator.clipboard?.writeText(link).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:40,marginBottom:8}}>🔗</div>
        <h3 style={{margin:0,fontSize:18,fontWeight:800,color:T.teal}}>Поделиться</h3>
        <p style={{margin:"6px 0 0",fontSize:13,color:T.sub}}>«{title}»</p>
      </div>
      <div style={{background:T.bg0,borderRadius:12,padding:"14px 16px",marginBottom:14,border:`1px solid ${T.brd}`}}>
        <div style={{fontSize:11,color:T.sub,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Код для друга</div>
        <div style={{fontSize:28,fontWeight:900,color:T.gold,letterSpacing:"0.15em",textAlign:"center"}}>{code}</div>
      </div>
      <div style={{background:T.bg0,borderRadius:12,padding:"12px 14px",marginBottom:16,border:`1px solid ${T.brd}`,wordBreak:"break-all",fontSize:12,color:T.sub}}>{link}</div>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Закрыть</Btn>
        <Btn variant="teal" onClick={copy} style={{flex:2}}>{copied?"✓ Скопировано!":"📋 Скопировать ссылку"}</Btn>
      </div>
      {tg && <div style={{marginTop:10}}><Btn variant="primary" onClick={()=>{tg.switchInlineQuery&&tg.switchInlineQuery(`Присоединяйся к квесту «${title}» — код: ${code}`, ["users","groups"]);onClose();}}>✈️ Отправить в Telegram</Btn></div>}
    </ModalOverlay>
  );
}

// ─── NEW CHALLENGE MODAL ──────────────────────────────────────────
function NewChallengeModal({ onClose, onCreate }) {
  const [title,setTitle]=useState(""); const [emoji,setEmoji]=useState("🏋️"); const [desc,setDesc]=useState(""); const [rt,setRT]=useState("day");
  const EMOJIS=["🏋️","🏃","🧘","📚","💧","🌅","🎯","💪","🚴","🍎","✏️","🎸"];
  const submit=()=>{
    if (!title.trim()) return;
    const creatorName = (typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name)||"Создатель";
    onCreate({ id:uid(), title:title.trim(), emoji, desc:desc.trim(), shareCode:mkCode(), recurType:rt, createdAt:today, myStreak:0, myHistory:[], participants:[], _myName:creatorName });
    onClose();
  };
  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{margin:"0 0 4px",fontSize:18,fontWeight:800,color:T.purpL}}>🏆 Новое соревнование</h3>
      <p style={{margin:"0 0 18px",fontSize:13,color:T.sub}}>Создай серию задач и соревнуйся с другом</p>
      <div style={{marginBottom:14}}>
        <SectionLabel>Эмодзи</SectionLabel>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {EMOJIS.map(e=><div key={e} onClick={()=>setEmoji(e)} style={{width:38,height:38,borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:emoji===e?T.purp+"44":T.bg0,border:`2px solid ${emoji===e?T.purp:T.brd}`,transition:"all 0.15s"}}>{e}</div>)}
        </div>
      </div>
      <div style={{marginBottom:14}}><SectionLabel>Название</SectionLabel><StyledInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="Утренняя зарядка…" onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
      <div style={{marginBottom:14}}><SectionLabel>Описание (необязательно)</SectionLabel><StyledInput value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Что нужно делать каждый день?"/></div>
      <div style={{marginBottom:18}}><SectionLabel>Периодичность</SectionLabel><RecurPicker value={rt} onChange={setRT}/></div>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Отмена</Btn>
        <Btn variant="primary" onClick={submit} style={{flex:2}} disabled={!title.trim()}>Создать ⚡</Btn>
      </div>
    </ModalOverlay>
  );
}

// ─── NEW SHARED GOAL MODAL ────────────────────────────────────────
function NewSharedGoalModal({ onClose, onCreate }) {
  const [title,setTitle]=useState(""); const [itemText,setItemText]=useState("");
  const [items,setItems]=useState([]);
  const addItem=()=>{ if(!itemText.trim()) return; setItems(p=>[...p,{id:uid(),title:itemText.trim(),assignedTo:null,doneBy:null,done:false}]); setItemText(""); };
  const removeItem=id=>setItems(p=>p.filter(x=>x.id!==id));
  const submit=()=>{
    if(!title.trim()||items.length===0) return;
    onCreate({ id:uid(), title:title.trim(), emoji:"🎯", shareCode:mkCode(), createdAt:today, participants:["Ты"], items });
    onClose();
  };
  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{margin:"0 0 4px",fontSize:18,fontWeight:800,color:T.teal}}>🎯 Общая цель</h3>
      <p style={{margin:"0 0 18px",fontSize:13,color:T.sub}}>Раздели задачи с другом и выполняйте вместе</p>
      <div style={{marginBottom:14}}><SectionLabel>Название</SectionLabel><StyledInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="Список покупок / Подготовка к вечеринке…" onKeyDown={e=>e.key==="Enter"&&document.getElementById("sg-item-input")?.focus()}/></div>
      <div style={{marginBottom:14}}>
        <SectionLabel>Пункты ({items.length})</SectionLabel>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input id="sg-item-input" value={itemText} onChange={e=>setItemText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Добавить пункт…" style={{flex:1,padding:"10px 13px",background:T.bg0,border:`1px solid ${T.brd}`,borderRadius:10,color:T.text,fontSize:14,outline:"none",colorScheme:"dark"}}/>
          <div onClick={addItem} style={{width:40,height:40,borderRadius:10,background:T.teal+"33",border:`1px solid ${T.teal}66`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:20,color:T.teal,flexShrink:0}}>+</div>
        </div>
        {items.map(it=>(
          <div key={it.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.bg0,borderRadius:10,border:`1px solid ${T.brd}`,marginBottom:6}}>
            <span style={{fontSize:14,color:T.text,flex:1}}>{it.title}</span>
            <div onClick={()=>removeItem(it.id)} style={{fontSize:14,color:T.rose,cursor:"pointer",padding:"2px 6px"}}>✕</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Отмена</Btn>
        <Btn variant="teal" onClick={submit} style={{flex:2}} disabled={!title.trim()||items.length===0}>Создать 🎯</Btn>
      </div>
    </ModalOverlay>
  );
}

// ─── JOIN BY CODE MODAL ───────────────────────────────────────────
function JoinModal({ challenges, sharedGoals, onClose, onJoinCh, onJoinSg }) {
  const [code,setCode]=useState(""); const [result,setResult]=useState(null); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const search=async(c)=>{
    if(!c){setErr("Введи код");return;}
    const localCh=challenges.find(x=>x.shareCode===c);
    const localSg=sharedGoals.find(x=>x.shareCode===c);
    if(localCh){setResult({type:"challenge",data:localCh});setErr("");return;}
    if(localSg){setResult({type:"goal",data:localSg});setErr("");return;}
    setLoading(true);setErr("");setResult(null);
    try{
      const found=await cloudFind(c);
      if(found){setResult(found);setErr("");}
      else setErr("Код не найден. Проверь правильность кода.");
    }catch{setErr("Ошибка соединения. Проверь интернет.");}
    finally{setLoading(false);}
  };
  const handleChange=e=>{
    const val=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
    setCode(val);setResult(null);setErr("");
    if(val.length===6) search(val);
  };
  const join=async()=>{
    if(!result) return;
    const tgUser = typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userName = tgUser?.first_name||"Друг";
    const tgId = tgUser?.id ? String(tgUser.id) : null;
    if(result.type==="challenge"){
      onJoinCh(result.data);
      await cloudAddParticipant("challenge", result.data.shareCode, {name:userName,avatar:"👤",streak:0,lastCompleted:null,history:[],...(tgId?{tgId}:{})});
    } else {
      onJoinSg(result.data);
      await cloudAddParticipant("goal", result.data.shareCode, userName);
    }
    onClose();
  };
  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{margin:"0 0 4px",fontSize:18,fontWeight:800,color:T.sky}}>🔗 Присоединиться</h3>
      <p style={{margin:"0 0 18px",fontSize:13,color:T.sub}}>Введи 6-значный код от друга</p>
      <div style={{marginBottom:14}}>
        <input value={code} onChange={handleChange} placeholder="ABCDEF" maxLength={6}
          style={{width:"100%",boxSizing:"border-box",padding:"14px",background:T.bg0,border:`2px solid ${code.length===6?(result?T.teal:err?T.rose:T.brd):T.brd}`,borderRadius:11,color:T.text,fontSize:24,fontWeight:800,letterSpacing:"0.2em",textAlign:"center",outline:"none",colorScheme:"dark",transition:"border-color 0.2s"}}/>
        <div style={{textAlign:"center",marginTop:8,fontSize:12,color:T.sub}}>
          {loading?"⏳ Ищем...":code.length<6?`${code.length}/6 символов`:""}
        </div>
      </div>
      {err && <div style={{color:T.rose,fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</div>}
      {result && (
        <div style={{background:T.bg0,borderRadius:13,border:`2px solid ${result.type==="challenge"?T.purp:T.teal}`,padding:"16px",marginBottom:16}}>
          <div style={{fontSize:24,marginBottom:6}}>{result.type==="challenge"?"🏆":"🎯"}</div>
          <div style={{fontSize:16,fontWeight:800,color:T.text,marginBottom:4}}>{result.data.title}</div>
          <div style={{fontSize:12,color:T.sub}}>{result.type==="challenge"?"Соревнование":"Общая цель"} · {result.type==="challenge"?`${result.data.participants.length+1} участников`:`${result.data.items.length} пунктов`}</div>
        </div>
      )}
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Отмена</Btn>
        <Btn variant="primary" onClick={join} style={{flex:2}} disabled={!result}>Присоединиться 🤝</Btn>
      </div>
    </ModalOverlay>
  );
}

// ─── CHALLENGE DETAIL MODAL ───────────────────────────────────────
function ChallengeDetail({ ch, onClose, onComplete, onShare, onDelete }) {
  // Всегда берём имя и tgId из Telegram — не из Firebase, чтобы у каждого было своё
  const tgUser = typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user;
  const myName = tgUser?.first_name||ch._myName||"Ты";
  const myTgId = tgUser?.id ? String(tgUser.id) : null;
  const myDoneToday = ch.myHistory.includes(today);
  const period = ch.recurType==="day"?"Ежедневно":ch.recurType==="week"?"Еженедельно":"Ежегодно";
  const [freshParts, setFreshParts] = useState(ch.participants||[]);
  const [syncing, setSyncing] = useState(false);

  const refresh = (dedup=false) => {
    if(!ch.shareCode) return;
    setSyncing(true);
    // Первый раз — чистим дубли (на случай если они уже есть в Firebase)
    const fetchParts = dedup
      ? cloudDeduplicateParticipants(ch.shareCode).then(()=>cloudGetParticipants(ch.shareCode))
      : cloudGetParticipants(ch.shareCode);
    fetchParts.then(parts=>{
      // Фильтруем себя: по tgId если есть, иначе по имени
      const others = myTgId
        ? parts.filter(p => p.tgId ? p.tgId !== myTgId : p.name !== myName)
        : parts.filter(p => p.name !== myName);
      setFreshParts(others);
      setSyncing(false);
    }).catch(()=>setSyncing(false));
  };

  useEffect(()=>{
    refresh(true); // первый раз — с дедупликацией
    // Автообновление каждые 15 секунд пока открыто
    const timer = setInterval(()=>refresh(false), 15000);
    return ()=>clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ch.shareCode, myName]);

  const allParts = [
    { name:myName, avatar:"🧙", streak:ch.myStreak, history:ch.myHistory, isMe:true },
    ...freshParts.map(p=>({...p, isMe:false})),
  ].sort((a,b)=>b.streak-a.streak);

  const last21 = Array.from({length:21},(_,i)=>pastDay(20-i));

  return (
    <ModalOverlay onClose={onClose}>
      {/* Кнопка назад — всегда видна */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <button onClick={onClose} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,background:T.bg0,border:`1px solid ${T.brd}`,color:T.sub,fontSize:13,fontWeight:600,cursor:"pointer"}}>
          ← Назад
        </button>
        <button onClick={refresh} style={{padding:"8px 12px",borderRadius:10,background:T.bg0,border:`1px solid ${T.brd}`,color:syncing?T.dim:T.teal,fontSize:13,fontWeight:600,cursor:"pointer"}}>
          {syncing?"⏳":"🔄 Обновить"}
        </button>
      </div>

      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:44,marginBottom:4}}>{ch.emoji}</div>
        <h3 style={{margin:0,fontSize:19,fontWeight:900,color:T.text}}>{ch.title}</h3>
        {ch.desc && <p style={{margin:"4px 0 0",fontSize:13,color:T.sub}}>{ch.desc}</p>}
        <div style={{fontSize:12,color:T.dim,marginTop:4}}>{period}</div>
      </div>

      {/* Leaderboard */}
      <div style={{marginBottom:16}}>
        <SectionLabel>🏆 Таблица лидеров</SectionLabel>
        {allParts.map((p,i)=>(
          <div key={p.name} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:i===0?T.gold+"15":T.bg0,borderRadius:12,border:`1px solid ${i===0?T.gold+"44":T.brd}`,marginBottom:8}}>
            <div style={{fontSize:18,width:24,textAlign:"center",fontWeight:900,color:i===0?T.gold:T.sub}}>#{i+1}</div>
            <div style={{fontSize:24,width:32,textAlign:"center"}}>{p.avatar||"👤"}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:p.isMe?T.purpL:T.text}}>{p.name}{p.isMe?" (ты)":""}</div>
              <div style={{fontSize:11,color:T.sub,marginTop:2}}>{p.history.length} дней выполнено</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:900,color:"#FF6B35"}}>🔥 {p.streak}</div>
              <div style={{fontSize:10,color:T.dim}}>дней</div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity heatmap — last 21 days */}
      <div style={{marginBottom:16}}>
        <SectionLabel>Активность за 3 недели</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {last21.map(d=>{
            const myD=ch.myHistory.includes(d);
            const friendDs=freshParts.filter(p=>p.history&&p.history.includes(d));
            return (
              <div key={d} style={{aspectRatio:"1",borderRadius:6,position:"relative",overflow:"hidden",background:T.bg0,border:`1px solid ${T.brd}`}}>
                {myD && <div style={{position:"absolute",bottom:0,left:0,right:0,height:"50%",background:T.purp+"88"}}/>}
                {friendDs.length>0 && <div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:T.teal+"88"}}/>}
                {myD && friendDs.length>0 && <div style={{position:"absolute",inset:0,background:"transparent",border:`2px solid ${T.gold}66`,borderRadius:5}}/>}
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:16,marginTop:8,justifyContent:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:T.sub}}><div style={{width:12,height:12,borderRadius:3,background:T.purp+"88"}}/>{myName} (ты)</div>
          {freshParts.map(p=><div key={p.name} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:T.sub}}><div style={{width:12,height:12,borderRadius:3,background:T.teal+"88"}}/>{p.name}</div>)}
        </div>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:10}}>
        <Btn variant="ghost" onClick={onShare} style={{flex:1}}>🔗 Поделиться</Btn>
        <Btn variant={myDoneToday?"ghost":"primary"} onClick={()=>{if(!myDoneToday){onComplete(ch.id);onClose();}}} style={{flex:2}} disabled={myDoneToday}>
          {myDoneToday?"✓ Сделано сегодня":"Отметить сегодня ✓"}
        </Btn>
      </div>
      <Btn variant="danger" onClick={()=>{onDelete(ch.id);onClose();}}>🗑 Удалить соревнование</Btn>
    </ModalOverlay>
  );
}

// ─── SHARED GOAL DETAIL MODAL ─────────────────────────────────────
function SharedGoalDetail({ sg, onClose, onToggleItem, onAssign, onShare, onDelete }) {
  const done = sg.items.filter(x=>x.done).length;
  const total = sg.items.length;
  const pct = total>0?done/total:0;

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:40,marginBottom:4}}>{sg.emoji}</div>
        <h3 style={{margin:0,fontSize:19,fontWeight:900,color:T.text}}>{sg.title}</h3>
        <p style={{margin:"4px 0 0",fontSize:13,color:T.sub}}>Участники: {sg.participants.join(", ")}</p>
      </div>

      <div style={{background:T.bg0,borderRadius:12,padding:"12px 14px",marginBottom:16,border:`1px solid ${T.brd}`}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:13,color:T.sub}}>Общий прогресс</span>
          <span style={{fontSize:13,fontWeight:700,color:T.teal}}>{done}/{total} ·  {Math.round(pct*100)}%</span>
        </div>
        <XPBar progress={pct} color={T.teal} height={8}/>
      </div>

      <div style={{marginBottom:16}}>
        <SectionLabel>Список ({done} из {total} выполнено)</SectionLabel>
        {sg.items.map(it=>(
          <div key={it.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px",background:it.done?T.teal+"12":T.bg0,borderRadius:11,border:`1px solid ${it.done?T.teal+"44":T.brd}`,marginBottom:8,transition:"all 0.2s"}}>
            <div onClick={()=>onToggleItem(sg.id,it.id)} style={{width:26,height:26,borderRadius:"50%",border:`2.5px solid ${it.done?T.teal:T.dim}`,background:it.done?T.teal:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:13,fontWeight:900,color:"#000",transition:"all 0.2s"}}>
              {it.done&&"✓"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,color:it.done?T.sub:T.text,textDecoration:it.done?"line-through":"none"}}>{it.title}</div>
              {it.assignedTo && <div style={{fontSize:11,color:it.done?T.teal:T.sub,marginTop:2}}>{it.done?`✓ ${it.doneBy}`:` ${it.assignedTo}`}</div>}
            </div>
            {!it.done && !it.assignedTo && (
              <div onClick={()=>onAssign(sg.id,it.id,"Ты")} style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:T.purp+"33",color:T.purpL,border:`1px solid ${T.purp}55`,cursor:"pointer",whiteSpace:"nowrap"}}>Беру я</div>
            )}
            {!it.done && it.assignedTo==="Ты" && (
              <div style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:T.purp+"22",color:T.purpL,border:`1px solid ${T.purp}44`}}>→ Ты</div>
            )}
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginBottom:10}}>
        <Btn variant="ghost" onClick={onShare} style={{flex:1}}>🔗 Поделиться</Btn>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Закрыть</Btn>
      </div>
      <Btn variant="danger" onClick={()=>{onDelete(sg.id);onClose();}}>🗑 Удалить цель</Btn>
    </ModalOverlay>
  );
}

// ─── SOCIAL SCREEN ────────────────────────────────────────────────
function SocialScreen({ challenges, sharedGoals, onUpdateCh, onUpdateSg, onDeleteCh, onDeleteSg, onCreateCh, onCreateSg }) {
  const [tab,setTab]=useState("challenges");
  const [showNewCh,setNewCh]=useState(false);
  const [showNewSg,setNewSg]=useState(false);
  const [showJoin,setJoin]=useState(false);
  const [detailCh,setDetailCh]=useState(null);
  const [detailSg,setDetailSg]=useState(null);
  const [shareItem,setShare]=useState(null); // {code,title}

  // При загрузке экрана — подтягиваем свежих участников из Firebase для всех соревнований
  useEffect(()=>{
    const tgUser = typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user;
    const myName = tgUser?.first_name||"Ты";
    const myTgId = tgUser?.id ? String(tgUser.id) : null;
    challenges.forEach(ch=>{
      if(!ch.shareCode) return;
      cloudGetParticipants(ch.shareCode).then(parts=>{
        const others = myTgId
          ? parts.filter(p => p.tgId ? p.tgId !== myTgId : p.name !== myName)
          : parts.filter(p=>p.name!==myName);
        onUpdateCh(ch.id, c=>({...c, participants:others}));
      }).catch(()=>{});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const completeCh = id => {
    onUpdateCh(id, ch => {
      if (ch.myHistory.includes(today)) return ch;
      const newHistory=[...ch.myHistory, today];
      // recount streak from history
      let streak=0;
      const sorted=[...newHistory].sort();
      const last=sorted[sorted.length-1];
      if(last===today){
        let cur=today; streak=1;
        while(true){
          const d=new Date(cur); d.setDate(d.getDate()-1);
          const prev=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
          if(sorted.includes(prev)){streak++;cur=prev;}else break;
        }
      }
      // Синхронизируем прогресс в Firebase — чтобы друг видел обновление
      const tgUser2 = typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user;
      const myName = ch._myName || tgUser2?.first_name || "Ты";
      const myTgId2 = tgUser2?.id ? String(tgUser2.id) : null;
      if(ch.shareCode) cloudUpdateMyProgress(ch.shareCode, myName, streak, newHistory, myTgId2);
      return {...ch, myHistory:newHistory, myStreak:streak};
    });
  };

  const joinCh = chData => {
    // Джойнер должен хранить СВОЁ имя, а не имя создателя из Firebase
    const myName = (typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name)||"Друг";
    const exists = challenges ? challenges.find(c=>c.id===chData.id||c.shareCode===chData.shareCode) : false;
    if(exists) onUpdateCh(chData.id, ch=>({...ch, joined:true, _myName:myName}));
    else onCreateCh({...chData, myStreak:0, myHistory:[], joined:true, _myName:myName});
  };
  const joinSg = sgData => {
    const userName = (typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name)||"Ты";
    const exists = sharedGoals ? sharedGoals.find(s=>s.id===sgData.id||s.shareCode===sgData.shareCode) : false;
    if(exists) onUpdateSg(sgData.id, sg=>({...sg, participants:[...new Set([...sg.participants,userName])]}));
    else onCreateSg({...sgData, participants:[...new Set([...(sgData.participants||[]),userName])]});
  };

  const toggleSgItem = (sgId, itemId) => onUpdateSg(sgId, sg=>({
    ...sg, items:sg.items.map(it=>it.id!==itemId?it:{...it, done:!it.done, doneBy:!it.done?"Ты":null})
  }));

  const assignSgItem = (sgId, itemId, name) => onUpdateSg(sgId, sg=>({
    ...sg, items:sg.items.map(it=>it.id!==itemId?it:{...it, assignedTo:name})
  }));

  const ChallengeCard = ({ch}) => {
    const allParts = [{name:"Ты",streak:ch.myStreak,isMe:true},...ch.participants];
    const top = [...allParts].sort((a,b)=>b.streak-a.streak)[0];
    const myDoneToday=ch.myHistory.includes(today);
    return (
      <div onClick={()=>setDetailCh(ch)} style={{background:T.bg2,borderRadius:14,border:`1px solid ${T.brd}`,padding:"14px 16px",marginBottom:10,cursor:"pointer",transition:"all 0.15s"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
          <div style={{fontSize:32,width:48,height:48,borderRadius:12,background:T.purp+"22",border:`1px solid ${T.purp}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{ch.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:T.text}}>{ch.title}</div>
            {ch.desc && <div style={{fontSize:12,color:T.sub,marginTop:2,lineHeight:1.4}}>{ch.desc}</div>}
            <div style={{fontSize:11,color:T.dim,marginTop:3}}>{ch.recurType==="day"?"Ежедневно":ch.recurType==="week"?"Еженедельно":"Ежегодно"}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            {myDoneToday
              ? <span style={{fontSize:11,fontWeight:700,color:T.teal,background:T.teal+"22",padding:"3px 9px",borderRadius:20}}>✓ сегодня</span>
              : <span style={{fontSize:11,color:T.rose,background:T.rose+"22",padding:"3px 9px",borderRadius:20}}>сегодня</span>}
          </div>
        </div>

        {/* Mini leaderboard */}
        <div style={{display:"flex",gap:6}}>
          {allParts.sort((a,b)=>b.streak-a.streak).map((p,i)=>(
            <div key={p.name} style={{flex:1,background:i===0?T.gold+"18":T.bg0,borderRadius:10,padding:"8px 6px",textAlign:"center",border:`1px solid ${i===0?T.gold+"44":T.brd}`}}>
              <div style={{fontSize:10,color:T.sub,marginBottom:3,fontWeight:600}}>{p.name}{p.isMe?" 👤":""}</div>
              <div style={{fontSize:16,fontWeight:900,color:"#FF6B35"}}>🔥{p.streak}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const GoalCard = ({sg}) => {
    const done=sg.items.filter(x=>x.done).length, total=sg.items.length;
    const myDone=sg.items.filter(x=>x.doneBy==="Ты").length;
    return (
      <div onClick={()=>setDetailSg(sg)} style={{background:T.bg2,borderRadius:14,border:`1px solid ${T.brd}`,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{fontSize:28,width:44,height:44,borderRadius:11,background:T.teal+"22",border:`1px solid ${T.teal}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sg.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:T.text}}>{sg.title}</div>
            <div style={{fontSize:11,color:T.sub,marginTop:2}}>{sg.participants.join(" · ")}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:16,fontWeight:800,color:T.teal}}>{done}<span style={{fontSize:11,color:T.sub}}>/{total}</span></div>
            <div style={{fontSize:10,color:T.sub}}>пунктов</div>
          </div>
        </div>
        <XPBar progress={total>0?done/total:0} color={T.teal} height={5}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
          <div style={{fontSize:11,color:T.sub}}>{total-done} пунктов осталось</div>
          {myDone>0 && <div style={{fontSize:11,color:T.teal,fontWeight:700}}>ты взял: {myDone} ✓</div>}
        </div>
      </div>
    );
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Sub-tabs */}
      <div style={{padding:"10px 16px 8px",flexShrink:0}}>
        <div style={{display:"flex",background:T.bg2,borderRadius:13,padding:4,border:`1px solid ${T.brd}`,gap:4}}>
          {[["challenges","🏆 Соревнования"],["goals","🎯 Общие цели"]].map(([id,label])=>(
            <div key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px 0",borderRadius:9,cursor:"pointer",textAlign:"center",fontSize:13,fontWeight:700,background:tab===id?T.purp:"transparent",color:tab===id?"#fff":T.sub,transition:"all 0.2s"}}>{label}</div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{display:"flex",gap:8,padding:"0 16px 10px",flexShrink:0}}>
        <div onClick={()=>tab==="challenges"?setNewCh(true):setNewSg(true)} style={{flex:1,padding:"9px 0",borderRadius:11,background:`linear-gradient(135deg,${T.purp},${T.gold})`,color:"#fff",fontWeight:700,fontSize:13,textAlign:"center",cursor:"pointer"}}>
          + {tab==="challenges"?"Создать":"Новая цель"}
        </div>
        <div onClick={()=>setJoin(true)} style={{padding:"9px 14px",borderRadius:11,background:T.sky+"22",color:T.sky,fontWeight:700,fontSize:13,border:`1px solid ${T.sky}44`,cursor:"pointer",whiteSpace:"nowrap"}}>
          🔗 Войти
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:"0 16px",WebkitOverflowScrolling:"touch"}}>
        {tab==="challenges" && (
          challenges.length===0
            ? <div style={{textAlign:"center",padding:"48px 0",color:T.dim}}><div style={{fontSize:44,marginBottom:12}}>🏆</div><div style={{fontSize:15,fontWeight:600,color:T.sub}}>Нет соревнований</div><div style={{fontSize:13,marginTop:6}}>Создай серию и поделись с другом</div></div>
            : challenges.map(ch=><ChallengeCard key={ch.id} ch={ch}/>)
        )}
        {tab==="goals" && (
          sharedGoals.length===0
            ? <div style={{textAlign:"center",padding:"48px 0",color:T.dim}}><div style={{fontSize:44,marginBottom:12}}>🎯</div><div style={{fontSize:15,fontWeight:600,color:T.sub}}>Нет общих целей</div><div style={{fontSize:13,marginTop:6}}>Поделись списком задач с другом</div></div>
            : sharedGoals.map(sg=><GoalCard key={sg.id} sg={sg}/>)
        )}
        <div style={{height:20}}/>
      </div>

      {/* Modals */}
      {showNewCh && <NewChallengeModal onClose={()=>setNewCh(false)} onCreate={ch=>{onCreateCh(ch);setNewCh(false);}}/>}
      {showNewSg && <NewSharedGoalModal onClose={()=>setNewSg(false)} onCreate={sg=>{onCreateSg(sg);setNewSg(false);}}/>}
      {showJoin  && <JoinModal challenges={challenges} sharedGoals={sharedGoals} onClose={()=>setJoin(false)} onJoinCh={joinCh} onJoinSg={joinSg}/>}
      {shareItem && <ShareSheet code={shareItem.code} title={shareItem.title} onClose={()=>setShare(null)}/>}
      {detailCh  && <ChallengeDetail ch={detailCh} onClose={()=>setDetailCh(null)}
          onComplete={completeCh} onShare={()=>{setShare({code:detailCh.shareCode,title:detailCh.title});setDetailCh(null);}}
          onDelete={id=>{onDeleteCh(id);setDetailCh(null);}}/>}
      {detailSg  && <SharedGoalDetail sg={detailSg} onClose={()=>setDetailSg(null)}
          onToggleItem={toggleSgItem} onAssign={assignSgItem}
          onShare={()=>{setShare({code:detailSg.shareCode,title:detailSg.title});setDetailSg(null);}}
          onDelete={id=>{onDeleteSg(id);setDetailSg(null);}}/>}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────
export default function App() {
  const saved = loadState();
  const savedSoc = loadSocial();
  const [xp,     setXP]    = useState(saved?.xp     ?? 340);
  const [tasks,  setTasks] = useState(saved?.tasks   ?? INIT_TASKS);
  const [events, setEvts]  = useState(saved?.events  ?? INIT_EVENTS);
  const [nickname, setNickname] = useState(saved?.nickname ?? "");
  const [tab,    setTab]   = useState("overview");
  const [overviewEditTask, setOverviewEditTask] = useState(null);
  const [xpAnim,  setXPAnim]  = useState(null);
  const [lvlUpAnim,setLvlUp] = useState(false);
  const prevLvlRef = useRef(lvlOf(saved?.xp??340));

  const [challenges,  setChallenges]  = useState(savedSoc?.challenges  ?? INIT_CHALLENGES);
  const [sharedGoals, setSharedGoals] = useState(savedSoc?.sharedGoals ?? INIT_SHARED_GOALS);

  // On mount: rollover overdue tasks, then spawn recurring instances for today
  useEffect(() => {
    setTasks(prev => {
      const rolled = autoRollover(prev);
      return spawnRecurring(rolled, events, today);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change
  useEffect(() => { saveState({xp,tasks,events,nickname}); }, [xp,tasks,events,nickname]);
  useEffect(() => { saveSocial({challenges,sharedGoals}); }, [challenges,sharedGoals]);

  // ── Social handlers ──────────────────────────────────────────────
  const handleUpdateCh = useCallback((id, updFn) => setChallenges(p=>p.map(c=>c.id===id?updFn(c):c)), []);
  const handleUpdateSg = useCallback((id, updFn) => setSharedGoals(p=>p.map(s=>s.id===id?updFn(s):s)), []);
  const handleDeleteCh = useCallback(id => setChallenges(p=>p.filter(c=>c.id!==id)), []);
  const handleDeleteSg = useCallback(id => setSharedGoals(p=>p.filter(s=>s.id!==id)), []);
  const handleCreateCh = useCallback(ch => {
    const tgUser = typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user;
    const myName = ch._myName || tgUser?.first_name || "Создатель";
    const myTgId = tgUser?.id ? String(tgUser.id) : null;
    // Сохраняем создателя как участника в Firebase (чтобы друг его видел)
    const chWithCreator = {
      ...ch,
      participants: [{ name: myName, avatar: "🧙", streak: 0, history: [], lastCompleted: null, ...(myTgId?{tgId:myTgId}:{}) }],
    };
    setChallenges(p=>[ch,...p]);
    cloudSave("challenges", chWithCreator).then(ok => {
      if (!ok) console.error("⚠️ Не удалось сохранить соревнование в облако. Проверь правила Firestore.");
    });
  }, []);
  const handleCreateSg = useCallback(sg => {
    setSharedGoals(p=>[sg,...p]);
    cloudSave("sharedGoals", sg).then(ok => {
      if (!ok) console.error("⚠️ Не удалось сохранить цель в облако. Проверь правила Firestore.");
    });
  }, []);

  const level = lvlOf(xp);

  // ✅ FIX: functional setXP prevents stale closure on rapid taps
  const handleToggle = useCallback(id => {
    setTasks(prev => prev.map(t => {
      if (t.id!==id) return t;
      if (!t.done) {
        // Completing: increment streak if enabled
        const newStreak = t.streakEnabled ? (t.streak || 0) + 1 : (t.streak || 0);
        setXP(prev => {
          const newXP = prev + t.xp;
          const newLvl = lvlOf(newXP);
          if (newLvl > prevLvlRef.current) {
            setLvlUp(true); setTimeout(()=>setLvlUp(false),3000);
            prevLvlRef.current = newLvl;
          }
          return newXP;
        });
        setXPAnim({amount:t.xp});
        setTimeout(()=>setXPAnim(null),2200);
        return {...t, done:true, streak:newStreak};
      }
      // Uncompleting: decrement streak back (undo)
      const prevStreak = t.streakEnabled ? Math.max(0, (t.streak||0) - 1) : (t.streak||0);
      return {...t, done:false, streak:prevStreak};
    }));
  },[]);

  // Handles both create (no existing id) and edit (existing id)
  const handleSave = useCallback(task => {
    setTasks(prev => {
      const idx = prev.findIndex(t=>t.id===task.id);
      if (idx===-1) return [task,...prev];
      const upd=[...prev]; upd[idx]={...prev[idx],...task}; return upd;
    });
  },[]);

  const handleDelete   = useCallback(id => setTasks(p=>p.filter(t=>t.id!==id)),[]);
  const handleShopToggle = useCallback((taskId, itemId) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId || !t.shopItems) return t;
      return {...t, shopItems: t.shopItems.map(it => it.id===itemId ? {...it, done:!it.done} : it)};
    }));
  }, []);
  const handleAddEvent = useCallback((ev, autoTasks)=>{
    if(ev) setEvts(p=>[ev,...p]);
    if(autoTasks?.length) setTasks(p=>[...autoTasks,...p]);
  },[]);
  const handleEditEvent   = useCallback(ev => setEvts(p=>{const i=p.findIndex(e=>e.id===ev.id);if(i===-1)return p;const u=[...p];u[i]={...p[i],...ev};return u;}),[]);
  const handleDeleteEvent = useCallback(id => {
    setEvts(p=>p.filter(e=>e.id!==id));
    setTasks(p=>p.filter(t=>t.eventId!==id));
  },[]);

  const TABS = [
    {id:"overview", label:"Главная",   icon:"🏠"},
    {id:"tasks",    label:"Квесты",    icon:"⚔️"},
    {id:"calendar", label:"Календарь", icon:"📅"},
    {id:"social",   label:"Союзники",  icon:"🤝"},
    {id:"profile",  label:"Герой",     icon:"🧙"},
  ];

  return (
    <div style={{
      width:"100%",maxWidth:420,margin:"0 auto",
      background:T.bg0,minHeight:"100vh",maxHeight:"100vh",
      fontFamily:"'Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif",
      color:T.text,display:"flex",flexDirection:"column",
      position:"relative",overflow:"hidden",
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
      `}</style>

      {/* XP toast */}
      {xpAnim && (
        <div style={{position:"fixed",top:"25%",left:"50%",transform:"translateX(-50%)",zIndex:300,pointerEvents:"none",textAlign:"center",animation:"xpFloat 2.2s ease forwards"}}>
          <div style={{fontSize:32,fontWeight:900,color:T.gold,textShadow:`0 0 30px ${T.gold},0 0 60px ${T.gold}88`}}>+{xpAnim.amount} XP</div>
          <div style={{fontSize:14,color:T.goldL,marginTop:2}}>✨ Квест выполнен!</div>
        </div>
      )}

      {/* Level up overlay */}
      {lvlUpAnim && (
        <div style={{position:"fixed",inset:0,zIndex:200,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",animation:"lvlGlow 3s ease forwards",background:"rgba(139,92,246,0.15)"}}>
          <div style={{background:T.bg1,border:`2px solid ${T.gold}`,borderRadius:20,padding:"28px 40px",textAlign:"center",boxShadow:`0 0 60px ${T.purp}88`}}>
            <div style={{fontSize:48,marginBottom:8,animation:"sparkle 1s ease"}}>⭐</div>
            <div style={{fontSize:13,color:T.sub,textTransform:"uppercase",letterSpacing:"0.1em"}}>Новый уровень</div>
            <div style={{fontSize:36,fontWeight:900,color:T.gold}}>Уровень {level}</div>
            <div style={{fontSize:16,color:T.purpL,marginTop:4}}>{RANKS[Math.min(level-1,RANKS.length-1)]}</div>
          </div>
        </div>
      )}

      {/* Header — hidden on calendar tab */}
      {tab!=="calendar" && tab!=="overview" && (
      <div style={{
        padding:`calc(14px + env(safe-area-inset-top,0px)) 16px 12px`,
        background:T.bg1,borderBottom:`1px solid ${T.brd}`,flexShrink:0,
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div>
            <div style={{fontSize:20,fontWeight:900,letterSpacing:"-0.03em"}}>
              <span style={{color:T.gold}}>Q</span><span style={{color:T.text}}>uestly</span>
            </div>
            <div style={{fontSize:11,color:T.sub,letterSpacing:"0.05em"}}>RPG-трекер задач</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end",marginBottom:4}}>
              <span style={{fontSize:11,color:T.sub}}>Ур.{level}</span>
              <span style={{fontSize:13,fontWeight:800,color:T.purpL}}>{RANK_ICONS[Math.min(level-1,RANK_ICONS.length-1)]} {RANKS[Math.min(level-1,RANKS.length-1)]}</span>
            </div>
            <span style={{fontSize:11,color:T.gold,fontWeight:700}}>⚡ {xp.toLocaleString()} XP</span>
          </div>
        </div>
        <XPBar progress={progOf(xp)} height={5}/>
      </div>
      )}

      {/* Screen */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
        {tab==="tasks"    && <TasksScreen    tasks={tasks}  onToggle={handleToggle} onSave={handleSave}   onDelete={handleDelete} onShopToggle={handleShopToggle}/>}
        {tab==="overview" && <OverviewScreen tasks={tasks} xp={xp} level={level} rank={RANKS[Math.min(level-1,RANKS.length-1)]} rankIcon={RANK_ICONS[Math.min(level-1,RANK_ICONS.length-1)]} xpProgress={progOf(xp)} onEditTask={setOverviewEditTask}/>}
        {tab==="calendar" && <CalendarScreen events={events} tasks={tasks} onAddEvent={handleAddEvent} onEditEvent={handleEditEvent} onDeleteEvent={handleDeleteEvent}/>}
        {tab==="social"   && <SocialScreen   challenges={challenges} sharedGoals={sharedGoals} onUpdateCh={handleUpdateCh} onUpdateSg={handleUpdateSg} onDeleteCh={handleDeleteCh} onDeleteSg={handleDeleteSg} onCreateCh={handleCreateCh} onCreateSg={handleCreateSg}/>}
        {tab==="profile"  && <ProfileScreen  xp={xp} tasks={tasks} events={events} nickname={nickname} onSetNickname={setNickname}/>}
      </div>

      {/* Bottom nav */}
      <div style={{display:"flex",background:T.bg1,borderTop:`1px solid ${T.brd}`,flexShrink:0,paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
        {TABS.map(t=>(
          <div key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div style={{fontSize:22,transform:tab===t.id?"scale(1.15)":"scale(1)",transition:"transform 0.2s cubic-bezier(.34,1.56,.64,1)"}}>{t.icon}</div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.03em",color:tab===t.id?T.purpL:T.dim,transition:"color 0.2s"}}>{t.label}</div>
            {tab===t.id && <div style={{width:20,height:3,borderRadius:2,background:T.purp,marginTop:1}}/>}
          </div>
        ))}
      </div>

      {/* Edit modal triggered from Overview screen */}
      {overviewEditTask && (
        <TaskModal
          existing={overviewEditTask}
          onClose={()=>setOverviewEditTask(null)}
          onSave={t=>{handleSave(t);setOverviewEditTask(null);}}
          onDelete={id=>{handleDelete(id);setOverviewEditTask(null);}}
        />
      )}
    </div>
  );
}
