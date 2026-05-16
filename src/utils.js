import { XP_TABLE, RANKS, PERIODS, EVENT_TYPES, LS, LS_SOC } from "./constants.js";

// ─── LOCAL TIME HELPERS ───────────────────────────────────────────
// Используем местное время устройства (а не жёстко UTC+3).
// getTimezoneOffset() возвращает разницу UTC−local в минутах,
// поэтому берём со знаком минус чтобы получить смещение east-of-UTC.
const getLocalOffsetMs = () => -new Date().getTimezoneOffset() * 60 * 1000;

// Возвращает Date, у которого UTC-поля совпадают с локальными полями устройства.
const localNow = () => new Date(Date.now() + getLocalOffsetMs());

// Форматирует Date (с локальными полями) в строку "YYYY-MM-DD".
const fmtLocal = d =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;

// ─── DATE HELPERS ─────────────────────────────────────────────────
export const todayStr    = () => fmtLocal(localNow());
export const tomorrowStr = () => { const d=localNow(); d.setUTCDate(d.getUTCDate()+1); return fmtLocal(d); };
export const fmtDate     = s => { const [y,m,d]=s.split("-"); return `${d}.${m}.${y}`; };
export const uid         = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`;

export const endOfWeek  = () => { const d=localNow(); const dow=d.getUTCDay(); const diff=dow===0?0:7-dow; d.setUTCDate(d.getUTCDate()+diff); return fmtLocal(d); };
export const endOfMonth = () => { const d=localNow(); d.setUTCMonth(d.getUTCMonth()+1,0); return fmtLocal(d); };
export const endOfYear  = () => `${localNow().getUTCFullYear()}-12-31`;
export const defaultDueForPeriod = p => p==="week"?endOfWeek():p==="month"?endOfMonth():p==="year"?endOfYear():todayStr();

export const isInCurrentWeek  = s => {
  const d   = new Date(s+"T12:00:00Z");
  const now = localNow();
  const dow = now.getUTCDay();
  const mon = new Date(now); mon.setUTCDate(now.getUTCDate()-(dow===0?6:dow-1)); mon.setUTCHours(0,0,0,0);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate()+6); sun.setUTCHours(23,59,59,999);
  return d>=mon && d<=sun;
};
export const isInCurrentMonth = s => {
  const d=new Date(s+"T12:00:00Z"); const now=localNow();
  return d.getUTCMonth()===now.getUTCMonth() && d.getUTCFullYear()===now.getUTCFullYear();
};
export const isInCurrentYear  = s => {
  const d=new Date(s+"T12:00:00Z"); return d.getUTCFullYear()===localNow().getUTCFullYear();
};

// daysLeft считает по местному времени устройства.
export const daysLeft = s => {
  const endOfDayLocal = new Date(s+"T23:59:59Z").getTime() - getLocalOffsetMs();
  const diff = Math.ceil((endOfDayLocal - Date.now()) / 86400000);
  if(diff<0) return "просрочено";
  if(diff===0) return "сегодня";
  return `${diff} дн.`;
};

export const pastDay = n => { const d=localNow(); d.setUTCDate(d.getUTCDate()-n); return fmtLocal(d); };
export const mkCode  = () => Math.random().toString(36).slice(2,8).toUpperCase();

// Миллисекунды до следующей локальной полуночи — используется хуком полуночного переноса.
export const msUntilLocalMidnight = () => {
  const now    = Date.now();
  const offset = getLocalOffsetMs();
  const local  = new Date(now + offset);
  // Следующая полночь по местному времени в терминах UTC
  const nextMidnightUTC =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()+1) - offset;
  return nextMidnightUTC - now;
};

/** @deprecated используйте msUntilLocalMidnight */
export const msUntilMoscowMidnight = msUntilLocalMidnight;

// ─── STRING HELPERS ───────────────────────────────────────────────
export const isBdTitle = t => /\bдр\b|день рождения|днюха|birthday/i.test(t);
export const bdName    = t => { const m=t.match(/(?:др|день рождения|днюха|birthday)[:\s]+(.+)/i)||t.match(/(.+?)[\s,–-]+(?:др|день рождения|днюха)/i); return m?m[1].trim():t.trim(); };

// ─── XP / LEVEL HELPERS ───────────────────────────────────────────
export const lvlOf  = xp => Math.min(RANKS.length, [...XP_TABLE].reverse().findIndex(v=>xp>=v)===-1 ? 1 : XP_TABLE.length-[...XP_TABLE].reverse().findIndex(v=>xp>=v));
export const progOf = xp => { const l=lvlOf(xp); if(l>=RANKS.length) return 1; const a=XP_TABLE[l-1]??0, b=XP_TABLE[l]??a+1; return Math.min((xp-a)/(b-a),1); };
export const nextXP = xp => { const l=lvlOf(xp); return l>=RANKS.length?0:(XP_TABLE[l]??0)-xp; };

// ─── LOCALSTORAGE ─────────────────────────────────────────────────
export const loadState = () => {
  try {
    const r=localStorage.getItem(LS)||localStorage.getItem("questly_v1");
    if(!r) return null;
    const state=JSON.parse(r);
    if(state.tasks) state.tasks=state.tasks.map(t=>({streakEnabled:false,streak:0,...t}));
    return state;
  } catch { return null; }
};
export const saveState = s => { try { localStorage.setItem(LS,JSON.stringify(s)); } catch {} };

export const loadSocial = () => { try { const r=localStorage.getItem(LS_SOC); return r?JSON.parse(r):null; } catch { return null; } };
export const saveSocial = s => { try { localStorage.setItem(LS_SOC,JSON.stringify(s)); } catch {} };

// ─── TASK LOGIC ───────────────────────────────────────────────────
// today() — всегда возвращает актуальную дату, не замораживается при старте.
export const today = todayStr;

export const autoRollover = (tasks) => tasks.map(t => {
  const now = today();
  // Не-повторяющиеся просроченные задачи — переносим на сегодня
  if (!t.done && t.dueDate < now && !t.recurring)
    return {...t, dueDate: now, rolledOver: true, streak: 0};
  // Повторяющиеся пропущенные задачи — сбрасываем серию.
  // Новый экземпляр на сегодня создаст spawnRecurring уже с streak:0.
  if (!t.done && t.dueDate < now && t.recurring && t.streakEnabled)
    return {...t, streak: 0};
  return t;
});

export const spawnRecurring = (tasks, events, day) => {
  const next=[...tasks];
  tasks.filter(t=>t.recurring && t.dueDate!==day).forEach(t=>{
    const ok=t.recurType==="day"
      ||(t.recurType==="week" && new Date(t.dueDate).getDay()===new Date(day).getDay())
      ||(t.recurType==="year" && t.dueDate.slice(5)===day.slice(5));
    // Используем templateId для дедупликации — надёжнее, чем сравнение по названию.
    // Задачи с одинаковым названием больше не блокируют друг друга.
    const tplId = t.templateId || t.id;
    if(ok && !next.some(x=>x.dueDate===day&&(x.templateId||x.id)===tplId)){
      let inheritedStreak=0;
      if(t.streakEnabled){
        const doneInstances=tasks.filter(x=>(x.templateId||x.id)===tplId&&x.streakEnabled&&x.done).sort((a,b)=>b.dueDate.localeCompare(a.dueDate));
        if(doneInstances.length>0){
          const lastDone=doneInstances[0];
          const diffDays=Math.round((new Date(day)-new Date(lastDone.dueDate))/86400000);
          const cont=(t.recurType==="day"&&diffDays<=1)||(t.recurType==="week"&&diffDays<=7)||(t.recurType==="year"&&diffDays<=366);
          inheritedStreak=cont?(lastDone.streak||0):0;
        }
      }
      // templateId хранит id задачи-шаблона, чтобы все экземпляры были связаны.
      next.unshift({...t,id:uid(),templateId:tplId,done:false,dueDate:day,streak:inheritedStreak,rolledOver:false});
    }
  });
  events.filter(e=>e.recurring).forEach(ev=>{
    const [,em,ed]=ev.date.split("-").map(Number);
    const [,dm,dd]=day.split("-").map(Number);
    const ok=ev.recurType==="day"
      ||(ev.recurType==="week"&&new Date(ev.date).getDay()===new Date(day).getDay())
      ||(ev.recurType==="year"&&em===dm&&ed===dd);
    if(!ok) return;
    const evTypeDef=EVENT_TYPES.find(t=>t.id===ev.eventType)||EVENT_TYPES.find(t=>t.id==="custom");
    evTypeDef.makeTasks(ev.title,day).forEach(tmpl=>{
      if(!next.some(x=>x.title===tmpl.title&&x.dueDate===day))
        next.unshift({id:uid(),done:false,period:"day",xp:tmpl.xp||15,dueDate:day,recurring:true,recurType:ev.recurType,streakEnabled:false,streak:0,eventId:ev.id,...tmpl});
    });
  });
  return next;
};

// ─── DEMO DATA ────────────────────────────────────────────────────
export const INIT_CHALLENGES = [
  {
    id:"demo_ch1",
    title:"Утренняя зарядка",
    emoji:"🏋️",
    desc:"Каждое утро — 15 минут разминки",
    shareCode:mkCode(),
    recurType:"day",
    createdAt:pastDay(14),
    myStreak:14,
    myHistory:Array.from({length:14},(_,i)=>pastDay(13-i)),
    participants:[
      {name:"Маша",avatar:"👩",streak:11,lastCompleted:pastDay(0),history:Array.from({length:11},(_,i)=>pastDay(10-i))},
    ],
  },
];

export const INIT_SHARED_GOALS = [
  {
    id:"demo_sg1",
    title:"Ужин в пятницу 🍷",
    emoji:"🛒",
    shareCode:mkCode(),
    createdAt:today(),
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

export const INIT_TASKS = [
  {id:uid(),title:"Утренняя зарядка",     period:"day",  done:false,xp:15, dueDate:today(),recurring:true, recurType:"day", streakEnabled:true, streak:0},
  {id:uid(),title:"Прочитать 20 страниц", period:"day",  done:true, xp:15, dueDate:today(),recurring:false,recurType:"",   streakEnabled:false,streak:0},
  {id:uid(),title:"Подготовить отчёт",    period:"week", done:false,xp:50, dueDate:today(),recurring:false,recurType:"",   streakEnabled:false,streak:0},
  {id:uid(),title:"Пройти курс по React", period:"month",done:false,xp:150,dueDate:today(),recurring:false,recurType:"",   streakEnabled:false,streak:0},
  {id:uid(),title:"Запустить проект",     period:"year", done:false,xp:600,dueDate:today(),recurring:false,recurType:"",   streakEnabled:false,streak:0},
];

export const INIT_EVENTS = [
  {id:uid(),title:"ДР Алексея",       date:today(),recurring:true, recurType:"year",isBirthday:true, color:"#F59E0B",eventType:"birthday"},
  {id:uid(),title:"Созвон с командой",date:today(),recurring:true, recurType:"week",isBirthday:false,color:"#38BDF8",eventType:"meeting" },
  {id:uid(),title:"Дедлайн проекта",  date:today(),recurring:false,recurType:"",   isBirthday:false,color:"#F43F5E",eventType:"deadline"},
];
