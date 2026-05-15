import { useState, useEffect, useRef, useCallback } from "react";

const T = {
  bg0:"#07071C", bg1:"#0D0D28", bg2:"#13133A", bg3:"#1A1A4A",
  brd:"#252565", brdDim:"#1A1A48",
  gold:"#F5A623", goldL:"#FFD080",
  purp:"#8B5CF6", purpL:"#C4A5FF",
  teal:"#06D6A0",
  rose:"#F43F5E", sky:"#38BDF8",
  text:"#EEEEFF", sub:"#8888BB", dim:"#3A3A6A",
};

const TABS = [
  { key:"day",   label:"Сегодня" },
  { key:"week",  label:"Неделя"  },
  { key:"month", label:"Месяц"   },
];

const MONTHS_GEN = [
  "января","февраля","марта","апреля","мая","июня",
  "июля","августа","сентября","октября","ноября","декабря"
];

const ORDER_KEY = "questly_overview_order_v2";
const loadOrder  = () => { try { return JSON.parse(localStorage.getItem(ORDER_KEY)||"{}"); } catch { return {}; } };
const saveOrder  = m  => { try { localStorage.setItem(ORDER_KEY, JSON.stringify(m)); } catch {} };

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const isInCurrentWeek = s => {
  const d = new Date(s+"T12:00:00"), now = new Date();
  const mon = new Date(now); mon.setDate(now.getDate()-((now.getDay()+6)%7)); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
  return d>=mon && d<=sun;
};

const isInCurrentMonth = s => {
  const d = new Date(s+"T12:00:00"), now = new Date();
  return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
};

const fmtDue = s => {
  if (!s) return null;
  const d = new Date(s+"T12:00:00");
  const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  const days   = ["вс","пн","вт","ср","чт","пт","сб"];
  const diff = Math.ceil((new Date(s+"T23:59:59") - new Date()) / 86400000);
  if (diff < 0) return { label:"просрочено", color:"#F43F5E" };
  return { label:`${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`, color:T.sub };
};

const applyOrder = (tasks, savedIds) => {
  if (!savedIds?.length) return tasks;
  const map = Object.fromEntries(tasks.map(t=>[t.id,t]));
  const ordered  = savedIds.filter(id=>map[id]).map(id=>map[id]);
  const newTasks = tasks.filter(t=>!savedIds.includes(t.id));
  return [...ordered, ...newTasks];
};

// ─── Drag Handle ──────────────────────────────────────────────────
function DragHandle({ active, onStart }) {
  return (
    <div
      onMouseDown={onStart}
      onTouchStart={onStart}
      style={{
        display:"flex", flexDirection:"column", gap:3.5,
        flexShrink:0, padding:"6px 5px 6px 2px",
        cursor:"grab", touchAction:"none",
        transition:"opacity 0.15s",
        opacity: active ? 1 : 0.35,
      }}
    >
      {[0,1,2].map(i => (
        <div key={i} style={{display:"flex", gap:3}}>
          {[0,1].map(j => (
            <div key={j} style={{
              width:3, height:3, borderRadius:"50%",
              background: active ? T.purpL : T.dim,
              transition:"background 0.15s",
            }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────
function TaskRow({ task, num, accent, activeTab, isDragging, isDropTarget, onDragHandleStart, onEdit }) {
  const due = activeTab !== "day" ? fmtDue(task.dueDate) : null;

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8,
      padding:"12px 12px 12px 6px",
      background: isDragging ? T.bg3 : "transparent",
      borderBottom:`1px solid ${isDropTarget ? accent+"77" : T.brdDim}`,
      boxShadow: isDropTarget ? `inset 3px 0 0 ${accent}` : "inset 3px 0 0 transparent",
      opacity: isDragging ? 0.4 : 1,
      transition:"opacity 0.12s, box-shadow 0.12s, background 0.12s",
    }}>

      {/* Drag handle */}
      <DragHandle active={isDragging} onStart={onDragHandleStart}/>

      {/* Number badge */}
      <div style={{
        minWidth:22, height:22,
        borderRadius:"50%",
        background: T.bg3,
        border:`1px solid ${T.brd}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:10, fontWeight:800, color: T.sub,
        flexShrink:0, letterSpacing:"-0.02em",
      }}>
        {num}
      </div>

      {/* Content */}
      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontSize:15, fontWeight:500, color:T.text,
          lineHeight:1.35, letterSpacing:"-0.01em",
          wordBreak:"break-word",
        }}>
          {task.title}
        </div>
        {due && (
          <div style={{fontSize:11, color:due.color, marginTop:3, fontWeight:500}}>
            {due.label}
          </div>
        )}
      </div>

      {/* Edit / settings button */}
      <div
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        style={{
          width:32, height:32,
          borderRadius:9,
          background:T.bg3,
          border:`1px solid ${T.brd}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", fontSize:13, color:T.sub,
          flexShrink:0,
          transition:"background 0.15s, color 0.15s, border-color 0.15s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.background=T.purp+"33";e.currentTarget.style.color=T.purpL;e.currentTarget.style.borderColor=T.purp+"55";}}
        onMouseLeave={e=>{e.currentTarget.style.background=T.bg3;e.currentTarget.style.color=T.sub;e.currentTarget.style.borderColor=T.brd;}}
      >
        ⚙️
      </div>
    </div>
  );
}

// ─── Draggable List ───────────────────────────────────────────────
function DraggableList({ tasks, accent, activeTab, orderMap, sectionKey, onReorder, onEditTask }) {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [overIdx, setOverIdx]         = useState(null);
  const listRef = useRef(null);

  const ordered = applyOrder(tasks, orderMap[sectionKey]);

  const startDrag = useCallback((e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIdx(idx);
    setOverIdx(idx);
  }, []);

  useEffect(() => {
    if (draggingIdx === null) return;

    // Snapshot at drag-start
    const snap = applyOrder(tasks, orderMap[sectionKey]);
    let curOver = draggingIdx;

    const findIdx = (clientY) => {
      if (!listRef.current) return null;
      const rows = listRef.current.querySelectorAll("[data-row]");
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (clientY >= r.top && clientY <= r.bottom) return i;
      }
      return null;
    };

    const onMove = (e) => {
      e.preventDefault();
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const idx = findIdx(clientY);
      if (idx !== null && idx !== curOver) {
        curOver = idx;
        setOverIdx(idx);
      }
    };

    const onEnd = () => {
      if (curOver !== null && draggingIdx !== curOver) {
        const arr = [...snap];
        const [moved] = arr.splice(draggingIdx, 1);
        arr.splice(curOver, 0, moved);
        onReorder(sectionKey, arr.map(t => t.id));
      }
      setDraggingIdx(null);
      setOverIdx(null);
    };

    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend",  onEnd);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onEnd);

    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend",  onEnd);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onEnd);
    };
  }, [draggingIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ordered.length === 0) {
    return (
      <div style={{padding:"60px 24px", textAlign:"center"}}>
        <div style={{fontSize:36, marginBottom:10, opacity:0.4}}>✓</div>
        <div style={{fontSize:14, color:T.sub, fontWeight:500}}>Нет незавершённых дел</div>
      </div>
    );
  }

  return (
    <div ref={listRef}>
      {ordered.map((task, idx) => (
        <div key={task.id} data-row>
          <TaskRow
            task={task}
            num={idx + 1}
            accent={accent}
            activeTab={activeTab}
            isDragging={draggingIdx === idx}
            isDropTarget={overIdx === idx && draggingIdx !== idx}
            onDragHandleStart={(e) => startDrag(e, idx)}
            onEdit={() => onEditTask && onEditTask(task)}
          />
        </div>
      ))}
    </div>
  );
}

// ─── XP Bar ───────────────────────────────────────────────────────
function XPBar({ progress }) {
  return (
    <div style={{height:5, background:T.brd, borderRadius:3, overflow:"hidden"}}>
      <div style={{
        height:"100%", borderRadius:3,
        width:`${Math.round(Math.min(progress, 1) * 100)}%`,
        background:`linear-gradient(90deg, ${T.purp}, ${T.gold})`,
        transition:"width 0.9s cubic-bezier(.34,1.56,.64,1)",
      }}/>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────
export default function OverviewScreen({
  tasks,
  xp = 0,
  level = 1,
  rank = "Новобранец",
  rankIcon = "🪨",
  xpProgress = 0,
  onEditTask,
}) {
  const [activeTab, setActiveTab] = useState("day");
  const [orderMap,  setOrderMap]  = useState(loadOrder);
  const today = todayStr();
  const now   = new Date();

  useEffect(() => { saveOrder(orderMap); }, [orderMap]);

  const handleReorder = useCallback((key, ids) => {
    setOrderMap(prev => ({ ...prev, [key]: ids }));
  }, []);

  const tasksByTab = {
    day:   tasks.filter(t => !t.done && t.period==="day"   && t.dueDate===today),
    week:  tasks.filter(t => !t.done && t.period==="week"  && isInCurrentWeek(t.dueDate||today)),
    month: tasks.filter(t => !t.done && t.period==="month" && isInCurrentMonth(t.dueDate||today)),
  };

  const ACCENT  = { day:T.teal, week:T.sky, month:T.purpL };
  const accent  = ACCENT[activeTab];

  const sectionLabel = (() => {
    if (activeTab === "day")   return `ДЕЛА ${now.getDate()} ${MONTHS_GEN[now.getMonth()]}`;
    if (activeTab === "week")  return "ДЕЛА НА НЕДЕЛЮ";
    return "ДЕЛА НА МЕСЯЦ";
  })();

  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>

      {/* ── Questly RPG Header ──────────────────────────────────────── */}
      <div style={{
        padding:`calc(14px + env(safe-area-inset-top,0px)) 16px 12px`,
        background:T.bg1,
        borderBottom:`1px solid ${T.brd}`,
        flexShrink:0,
      }}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
          <div>
            <div style={{fontSize:20, fontWeight:900, letterSpacing:"-0.03em"}}>
              <span style={{color:T.gold}}>Q</span>
              <span style={{color:T.text}}>uestly</span>
            </div>
            <div style={{fontSize:11, color:T.sub, letterSpacing:"0.05em"}}>RPG-трекер задач</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", marginBottom:4}}>
              <span style={{fontSize:11, color:T.sub}}>Ур.{level}</span>
              <span style={{fontSize:13, fontWeight:800, color:T.purpL}}>{rankIcon} {rank}</span>
            </div>
            <span style={{fontSize:11, color:T.gold, fontWeight:700}}>⚡ {xp.toLocaleString()} XP</span>
          </div>
        </div>
        <XPBar progress={xpProgress}/>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────── */}
      <div style={{
        display:"flex",
        borderBottom:`1px solid ${T.brd}`,
        background:T.bg1,
        flexShrink:0,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          const cnt    = tasksByTab[tab.key].length;
          const acc    = ACCENT[tab.key];
          return (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex:1, padding:"14px 0 12px", textAlign:"center",
                cursor:"pointer", position:"relative", transition:"all 0.18s",
              }}
            >
              <span style={{
                fontSize:13, fontWeight:active?700:500,
                color:active?acc:T.sub,
                transition:"color 0.18s", letterSpacing:"0.01em",
              }}>
                {tab.label}
              </span>
              {cnt > 0 && (
                <span style={{
                  marginLeft:5, fontSize:10, fontWeight:700,
                  color:active?acc:T.dim, transition:"color 0.18s",
                }}>
                  {cnt}
                </span>
              )}
              {active && (
                <div style={{
                  position:"absolute", bottom:0, left:"20%", right:"20%",
                  height:2, borderRadius:2,
                  background:acc, boxShadow:`0 0 8px ${acc}`,
                }}/>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Section Label ───────────────────────────────────────────── */}
      <div style={{
        padding:"10px 16px 8px",
        fontSize:11, fontWeight:800, color:T.sub,
        letterSpacing:"0.12em", textTransform:"uppercase",
        flexShrink:0,
        display:"flex", alignItems:"center", gap:7,
        borderBottom:`1px solid ${T.brdDim}`,
      }}>
        <span style={{
          display:"inline-block",
          width:7, height:7, borderRadius:"50%",
          background:accent, boxShadow:`0 0 6px ${accent}`,
          flexShrink:0,
        }}/>
        {sectionLabel}:
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      <div style={{flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch"}}>
        <DraggableList
          key={activeTab}
          tasks={tasksByTab[activeTab]}
          accent={accent}
          activeTab={activeTab}
          orderMap={orderMap}
          sectionKey={activeTab}
          onReorder={handleReorder}
          onEditTask={onEditTask}
        />
        <div style={{height:24}}/>
      </div>
    </div>
  );
}
