// ─── OVERVIEW SCREEN ──────────────────────────────────────────────
// Файл: src/OverviewScreen.jsx
// Добавить в src/ и зарегистрировать в App.jsx (инструкции ниже)
//
// ИНТЕГРАЦИЯ В App.jsx:
//   1. В начале файла добавить импорт:
//        import OverviewScreen from "./OverviewScreen.jsx";
//
//   2. В TABS массив добавить 5-й элемент:
//        { id:"overview", label:"Обзор", icon:"👁️" }
//
//   3. В блок {/* Screen */} добавить строку:
//        {tab==="overview" && <OverviewScreen tasks={tasks}/>}
// ──────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react";

// Тема — совпадает с App.jsx
const T = {
  bg0:"#07071C", bg1:"#0D0D28", bg2:"#13133A", bg3:"#1A1A4A",
  brd:"#252565", brdDim:"#1A1A48",
  gold:"#F5A623", goldL:"#FFD080", goldDim:"#8A5C0E",
  purp:"#8B5CF6", purpL:"#C4A5FF", purpDim:"#4C2A99",
  teal:"#06D6A0", tealDim:"#0A6648",
  rose:"#F43F5E", sky:"#38BDF8",
  text:"#EEEEFF", sub:"#8888BB", dim:"#3A3A6A",
};

const SECTIONS = [
  { key:"day",   label:"Сегодня",    icon:"⚡", accent:T.teal,  sub:"Срочные дела дня"    },
  { key:"week",  label:"Эта неделя", icon:"🌊", accent:T.sky,   sub:"Дела на неделю"      },
  { key:"month", label:"Этот месяц", icon:"💫", accent:T.purpL, sub:"Дела на месяц"       },
];

const PERIOD_XP = { day:15, week:50, month:150, year:600 };

// ─── Storage для кастомного порядка ───────────────────────────────
const ORDER_KEY = "questly_overview_order_v1";
const loadOrder  = () => { try { return JSON.parse(localStorage.getItem(ORDER_KEY)||"{}"); } catch { return {}; } };
const saveOrder  = m  => { try { localStorage.setItem(ORDER_KEY, JSON.stringify(m)); } catch {} };

// ─── Helpers ──────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const isInCurrentWeek = s => {
  const d = new Date(s+"T12:00:00"), now = new Date();
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay()+6)%7)); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
  return d >= mon && d <= sun;
};

const isInCurrentMonth = s => {
  const d = new Date(s+"T12:00:00"), now = new Date();
  return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
};

const daysLeft = s => {
  if (!s) return null;
  const diff = Math.ceil((new Date(s+"T23:59:59") - new Date()) / 86400000);
  if (diff < 0)  return { label:"просрочено", color:T.rose };
  if (diff === 0) return { label:"сегодня",   color:T.teal };
  if (diff === 1) return { label:"завтра",    color:T.gold };
  return { label:`${diff} дн.`, color:T.sub };
};

const todayFormatted = () => {
  const d = new Date();
  const days  = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
  const months= ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
};

// Применить сохранённый порядок к массиву задач
const applyOrder = (tasks, savedIds) => {
  if (!savedIds?.length) return tasks;
  const map = Object.fromEntries(tasks.map(t => [t.id, t]));
  const ordered  = savedIds.filter(id => map[id]).map(id => map[id]);
  const newTasks = tasks.filter(t => !savedIds.includes(t.id));
  return [...ordered, ...newTasks];
};

// ─── CARD ─────────────────────────────────────────────────────────
function OverviewCard({ task, sectionAccent, isDragging, isDropTarget }) {
  const xp  = task.xp || PERIOD_XP[task.period] || 15;
  const due = task.dueDate ? daysLeft(task.dueDate) : null;

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      background: isDragging ? T.bg3 : T.bg2,
      border:`1px solid ${isDropTarget ? sectionAccent : (isDragging ? sectionAccent+"44" : T.brd)}`,
      borderRadius:13,
      padding:"11px 12px",
      marginBottom:6,
      opacity: isDragging ? 0.5 : 1,
      boxShadow: isDropTarget ? `0 0 0 2px ${sectionAccent}66` : "none",
      transition:"border-color 0.15s, box-shadow 0.15s, opacity 0.15s, background 0.15s",
      cursor:"grab",
      userSelect:"none",
      WebkitUserSelect:"none",
    }}>
      {/* Drag handle */}
      <div style={{
        fontSize:16, color:T.dim, lineHeight:1, flexShrink:0,
        display:"flex", flexDirection:"column", gap:2.5,
        paddingRight:2,
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{display:"flex", gap:2.5}}>
            {[0,1].map(j => (
              <div key={j} style={{width:3, height:3, borderRadius:"50%", background:T.dim}}/>
            ))}
          </div>
        ))}
      </div>

      {/* Title */}
      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontSize:14, fontWeight:600, color:T.text,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          lineHeight:1.35,
        }}>
          {task.title}
        </div>
        <div style={{display:"flex", alignItems:"center", gap:6, marginTop:4, flexWrap:"wrap"}}>
          {/* Due date */}
          {due && (
            <span style={{
              fontSize:11, color:due.color, fontWeight:600,
              background:`${due.color}18`, borderRadius:5,
              padding:"1px 6px", letterSpacing:"0.01em",
            }}>
              {due.label}
            </span>
          )}
          {/* Recurring badge */}
          {task.recurring && (
            <span style={{fontSize:10, color:T.sub}}>🔁</span>
          )}
          {/* Streak */}
          {task.streakEnabled && task.streak > 0 && (
            <span style={{fontSize:10, color:T.gold, fontWeight:700}}>🔥 {task.streak}</span>
          )}
        </div>
      </div>

      {/* XP badge */}
      <div style={{
        fontSize:11, fontWeight:800, color:sectionAccent,
        background:`${sectionAccent}18`,
        border:`1px solid ${sectionAccent}33`,
        borderRadius:8, padding:"3px 8px",
        flexShrink:0, letterSpacing:"0.02em",
      }}>
        +{xp}
      </div>
    </div>
  );
}

// ─── DRAGGABLE LIST ───────────────────────────────────────────────
function DraggableSection({ section, tasks, orderMap, onReorder }) {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [overIdx,     setOverIdx]     = useState(null);
  const dragNode = useRef(null);

  const ordered = applyOrder(tasks, orderMap[section.key]);

  const handleDragStart = (e, idx) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    // Invisible drag image
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:absolute;top:-999px;left:-999px;width:1px;height:1px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== draggingIdx) setOverIdx(idx);
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (draggingIdx !== null && draggingIdx !== idx) {
      const reordered = [...ordered];
      const [moved] = reordered.splice(draggingIdx, 1);
      reordered.splice(idx, 0, moved);
      onReorder(section.key, reordered.map(t => t.id));
    }
    setDraggingIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setOverIdx(null);
  };

  // ── Empty state ──────────────────────────────────────────────────
  if (ordered.length === 0) {
    return (
      <div style={{
        textAlign:"center", padding:"18px 0 10px",
        color:T.dim, fontSize:13,
      }}>
        <span style={{fontSize:22}}>✨</span>
        <div style={{marginTop:6, fontWeight:600, color:T.sub}}>Всё готово!</div>
        <div style={{fontSize:12, marginTop:2}}>Нет незавершённых дел</div>
      </div>
    );
  }

  return (
    <div>
      {ordered.map((task, idx) => (
        <div
          key={task.id}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragOver={e => handleDragOver(e, idx)}
          onDrop={e => handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          ref={draggingIdx === idx ? dragNode : null}
        >
          <OverviewCard
            task={task}
            sectionAccent={section.accent}
            isDragging={draggingIdx === idx}
            isDropTarget={overIdx === idx && draggingIdx !== idx}
          />
        </div>
      ))}
    </div>
  );
}

// ─── OVERVIEW SCREEN ──────────────────────────────────────────────
export default function OverviewScreen({ tasks }) {
  const [orderMap, setOrderMap] = useState(loadOrder);
  const today = todayStr();

  // Persist order whenever it changes
  useEffect(() => { saveOrder(orderMap); }, [orderMap]);

  const handleReorder = useCallback((sectionKey, newIds) => {
    setOrderMap(prev => ({ ...prev, [sectionKey]: newIds }));
  }, []);

  // Filter tasks per section — only incomplete tasks
  const tasksBySection = {
    day:   tasks.filter(t => !t.done && t.period === "day"   && t.dueDate === today),
    week:  tasks.filter(t => !t.done && t.period === "week"  && isInCurrentWeek(t.dueDate||today)),
    month: tasks.filter(t => !t.done && t.period === "month" && isInCurrentMonth(t.dueDate||today)),
  };

  const totalRemaining = Object.values(tasksBySection).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{
      flex:1, display:"flex", flexDirection:"column",
      overflowY:"auto", WebkitOverflowScrolling:"touch",
    }}>

      {/* ── Date header ─────────────────────────────────────────── */}
      <div style={{
        padding:"14px 16px 10px",
        borderBottom:`1px solid ${T.brd}`,
        background:T.bg1, flexShrink:0,
      }}>
        <div style={{
          fontSize:13, color:T.sub, textTransform:"capitalize",
          letterSpacing:"0.03em", marginBottom:2,
        }}>
          {todayFormatted()}
        </div>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div style={{fontSize:20, fontWeight:900, color:T.text, letterSpacing:"-0.02em"}}>
            Мои дела
          </div>
          {totalRemaining > 0 ? (
            <div style={{
              fontSize:12, fontWeight:700,
              background:T.bg3, border:`1px solid ${T.brd}`,
              color:T.sub, borderRadius:20, padding:"3px 10px",
            }}>
              {totalRemaining} осталось
            </div>
          ) : (
            <div style={{
              fontSize:12, fontWeight:700, color:T.teal,
              background:`${T.teal}18`, borderRadius:20, padding:"3px 10px",
            }}>
              🎉 Всё сделано!
            </div>
          )}
        </div>

        {/* ── Progress dots ──────────────────────────────────────── */}
        <div style={{display:"flex", gap:6, marginTop:10}}>
          {SECTIONS.map(s => {
            const all  = tasks.filter(t => {
              if (t.period !== s.key) return false;
              if (s.key === "day")   return t.dueDate === today;
              if (s.key === "week")  return isInCurrentWeek(t.dueDate||today);
              if (s.key === "month") return isInCurrentMonth(t.dueDate||today);
              return false;
            });
            const done = all.filter(t => t.done).length;
            const pct  = all.length > 0 ? done / all.length : 0;
            return (
              <div key={s.key} style={{flex:1}}>
                <div style={{
                  display:"flex", justifyContent:"space-between",
                  fontSize:10, color:T.sub, marginBottom:4, fontWeight:600,
                }}>
                  <span style={{color:s.accent}}>{s.icon} {s.label}</span>
                  <span>{done}/{all.length}</span>
                </div>
                <div style={{
                  height:4, borderRadius:4,
                  background:T.bg3, overflow:"hidden",
                }}>
                  <div style={{
                    height:"100%", borderRadius:4,
                    background:s.accent,
                    width:`${Math.round(pct*100)}%`,
                    transition:"width 0.4s ease",
                    boxShadow:`0 0 8px ${s.accent}88`,
                  }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sections ────────────────────────────────────────────── */}
      <div style={{padding:"12px 16px 24px"}}>
        {SECTIONS.map(section => {
          const sectionTasks = tasksBySection[section.key];
          return (
            <div key={section.key} style={{marginBottom:20}}>

              {/* Section header */}
              <div style={{
                display:"flex", alignItems:"center", gap:8,
                marginBottom:10,
              }}>
                {/* Color bar */}
                <div style={{
                  width:3, height:18, borderRadius:2,
                  background:section.accent,
                  boxShadow:`0 0 8px ${section.accent}88`,
                  flexShrink:0,
                }}/>
                <div style={{flex:1}}>
                  <div style={{
                    display:"flex", alignItems:"center", gap:6,
                  }}>
                    <span style={{
                      fontSize:13, fontWeight:800, color:section.accent,
                      letterSpacing:"0.01em",
                    }}>
                      {section.icon} {section.label}
                    </span>
                    {sectionTasks.length > 0 && (
                      <span style={{
                        fontSize:11, color:section.accent,
                        background:`${section.accent}20`,
                        borderRadius:10, padding:"1px 7px", fontWeight:700,
                      }}>
                        {sectionTasks.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hint — drag to reorder */}
                {sectionTasks.length > 1 && (
                  <div style={{
                    fontSize:10, color:T.dim,
                    fontStyle:"italic",
                    letterSpacing:"0.01em",
                  }}>
                    перетащи для сортировки
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{
                height:1, background:`${section.accent}22`,
                marginBottom:10, borderRadius:1,
              }}/>

              {/* Draggable task list */}
              <DraggableSection
                section={section}
                tasks={sectionTasks}
                orderMap={orderMap}
                onReorder={handleReorder}
              />

            </div>
          );
        })}

        {/* Footer note */}
        <div style={{
          textAlign:"center", fontSize:11,
          color:T.dim, marginTop:8,
          lineHeight:1.6,
        }}>
          Только просмотр · порядок сохраняется автоматически<br/>
          Отметить выполнение → вкладка ⚔️ Квесты
        </div>
      </div>
    </div>
  );
}
