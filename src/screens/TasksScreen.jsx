import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { T } from "../theme.js";
import { today, tomorrowStr, isInCurrentWeek, isInCurrentMonth, isInCurrentYear } from "../utils";
import { XPBar } from "../components/ui.jsx";
import TaskCard from "../components/TaskCard.jsx";
import TaskModal from "./TaskModal.jsx";

const FILTER_TABS = [
  { id:"day",      label:"Сегодня", icon:"⚡", accent:T.teal     },
  { id:"tomorrow", label:"Завтра",  icon:"🌅", accent:T.sky      },
  { id:"week",     label:"Неделя",  icon:"🌊", accent:T.sky      },
  { id:"month",    label:"Месяц",   icon:"💫", accent:T.purpL    },
  { id:"year",     label:"Год",     icon:"👑", accent:T.gold     },
  { id:"dream",    label:"Мечта",   icon:"🌠", accent:"#FF6B9D"  },
];

// ─── DRAG HANDLE ICON ────────────────────────────────────────────
function DragHandle({ onPointerDown }) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        width: 28, height: 44, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 4,
        cursor: "grab", flexShrink: 0, touchAction: "none",
        opacity: 0.35, userSelect: "none",
      }}
    >
      {[0,1,2].map(i => (
        <div key={i} style={{ width: 16, height: 2, borderRadius: 2, background: T.sub }} />
      ))}
    </div>
  );
}

// ─── DRAGGABLE TASK ROW ──────────────────────────────────────────
function DraggableRow({ task, isDragging, isDropTarget, onToggle, onEdit, onShopToggle, onDragStart }) {
  return (
    <div
      data-task-id={task.id}
      style={{
        display: "flex", alignItems: "center",
        opacity: isDragging ? 0.35 : 1,
        transition: isDragging ? "none" : "opacity 0.2s",
        transform: isDropTarget ? "scale(1.01)" : "scale(1)",
      }}
    >
      <DragHandle onPointerDown={(e) => onDragStart(task, e)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <TaskCard task={task} onToggle={onToggle} onEdit={() => onEdit(task)} onShopToggle={onShopToggle} />
      </div>
    </div>
  );
}

// ─── DROP LINE ───────────────────────────────────────────────────
function DropLine() {
  return (
    <div style={{
      height: 3, borderRadius: 2, margin: "2px 0 2px 32px",
      background: `linear-gradient(90deg, ${T.purp}, ${T.teal})`,
      boxShadow: `0 0 8px ${T.purp}88`,
      animation: "dropLinePulse 1s ease infinite alternate",
    }} />
  );
}

// ─── MAIN SCREEN ────────────────────────────────────────────────
export default function TasksScreen({ tasks, onToggle, onSave, onDelete, onShopToggle, onReorder }) {
  const [filter, setFilter] = useState("day");
  const [showCreate, setCreate] = useState(false);
  const [editTask, setEdit] = useState(null);

  // Drag state
  const [draggingId, setDraggingId] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);   // index to insert BEFORE in activeTasks
  const dragRef = useRef({ active: false, id: null });
  const listRef = useRef(null);
  const activeTasksRef = useRef([]);

  const tmrw = tomorrowStr();

  const filtered = useMemo(() => tasks.filter((t) => {
    if (filter === "tomorrow") return t.period === "day" && t.dueDate === tmrw;
    if (t.period !== filter) return false;
    if (!t.dueDate) return filter === "day";
    if (filter === "day")   return t.dueDate === today();
    if (filter === "week")  return isInCurrentWeek(t.dueDate);
    if (filter === "month") return isInCurrentMonth(t.dueDate);
    if (filter === "year")  return isInCurrentYear(t.dueDate);
    if (filter === "dream") return true;
    return true;
  }), [tasks, filter, tmrw]);

  const activeTasks = useMemo(() => filtered.filter(t => !t.done), [filtered]);
  const doneTasks   = useMemo(() => filtered.filter(t => t.done),  [filtered]);

  // Keep ref in sync so closures can read current value
  useEffect(() => { activeTasksRef.current = activeTasks; }, [activeTasks]);

  const done  = doneTasks.length;
  const total = filtered.length;
  const pct   = total > 0 ? done / total : 0;
  const ft    = FILTER_TABS.find((x) => x.id === filter);
  const p     = filter === "tomorrow"
    ? { accent: T.sky }
    : { accent: ft.accent };

  // ── Drag logic ────────────────────────────────────────────────
  const getDropIdxFromY = useCallback((y) => {
    if (!listRef.current) return null;
    const items = listRef.current.querySelectorAll("[data-task-id]");
    const list = activeTasksRef.current;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (y < rect.top + rect.height * 0.5) return i;
    }
    return list.length; // drop at end
  }, []);

  const startDrag = useCallback((task, e) => {
    e.preventDefault();
    dragRef.current = { active: true, id: task.id };
    setDraggingId(task.id);
    setDropIdx(activeTasksRef.current.findIndex(t => t.id === task.id));

    const onMove = (ev) => {
      if (!dragRef.current.active) return;
      const y = ev.clientY ?? ev.touches?.[0]?.clientY;
      if (y !== undefined) setDropIdx(getDropIdxFromY(y));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      const fromId = dragRef.current.id;
      dragRef.current = { active: false };
      setDraggingId(null);
      setDropIdx(null);

      // Commit reorder
      setDropIdx(prev => {
        const list = activeTasksRef.current;
        const fromIdx = list.findIndex(t => t.id === fromId);
        if (prev === null || prev === fromIdx || prev === fromIdx + 1) return null;

        const newList = [...list];
        const [removed] = newList.splice(fromIdx, 1);
        const insertAt = prev > fromIdx ? prev - 1 : prev;
        newList.splice(insertAt, 0, removed);
        onReorder(newList.map(t => t.id));
        return null;
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
  }, [getDropIdxFromY, onReorder]);

  // ── Render active tasks with drop indicator ───────────────────
  const renderActiveTasks = () => {
    const rows = [];
    const list = activeTasks;

    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const isDragging = t.id === draggingId;
      const isDropTarget = dropIdx === i && draggingId && !isDragging;

      if (isDropTarget) rows.push(<DropLine key={`drop-${i}`} />);

      rows.push(
        <DraggableRow
          key={t.id}
          task={t}
          isDragging={isDragging}
          isDropTarget={false}
          onToggle={onToggle}
          onEdit={setEdit}
          onShopToggle={onShopToggle}
          onDragStart={startDrag}
        />
      );
    }

    // Drop at end
    if (draggingId && dropIdx === list.length) {
      rows.push(<DropLine key="drop-end" />);
    }

    return rows;
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
      <style>{`
        @keyframes dropLinePulse {
          from { opacity: 0.7; } to { opacity: 1; }
        }
      `}</style>

      {/* Filter tabs */}
      <div style={{ padding:"12px 16px 8px", flexShrink:0 }}>
        <div style={{ display:"flex", gap:3, background:T.bg2, borderRadius:14, padding:3, border:`1px solid ${T.brd}`, overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none" }}>
          {FILTER_TABS.map(ft => {
            const active = filter === ft.id;
            return (
              <div key={ft.id} onClick={() => setFilter(ft.id)} style={{ flex:1, minWidth:48, borderRadius:10, cursor:"pointer", padding:"7px 6px", display:"flex", flexDirection:"column", alignItems:"center", gap:2, background:active?ft.accent:"transparent", boxShadow:active?`0 2px 8px ${ft.accent}55`:"none", transition:"all 0.2s cubic-bezier(.34,1.56,.64,1)" }}>
                <span style={{ fontSize:13, lineHeight:1 }}>{ft.icon}</span>
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.01em", color:active?(ft.id==="month"?"#fff":"#000"):T.sub, transition:"color 0.2s" }}>{ft.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ margin:"4px 16px 12px", background:T.bg2, borderRadius:14, padding:"14px 16px", border:`1px solid ${T.brd}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:12, color:T.sub, marginBottom:2 }}>
              Прогресс {filter === "day" ? "на сегодня" : filter === "tomorrow" ? "на завтра" : filter === "week" ? "на неделю" : filter === "month" ? "на месяц" : filter === "year" ? "на год" : "мечта"}
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:p.accent }}>
              {done}<span style={{ fontSize:14, color:T.sub, fontWeight:400 }}>/{total} квестов</span>
            </div>
          </div>
          <div style={{ fontSize:13, color:T.gold, fontWeight:700 }}>{Math.round(pct * 100)}%</div>
        </div>
        <XPBar progress={pct} color={p.accent} height={6} />
      </div>

      {/* Task list */}
      <div
        ref={listRef}
        style={{ flex:1, overflowY: draggingId ? "hidden" : "auto", padding:"0 16px", WebkitOverflowScrolling:"touch" }}
      >
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:T.dim }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🗡️</div>
            <div style={{ fontSize:15, fontWeight:600, color:T.sub }}>Нет активных квестов</div>
            <div style={{ fontSize:13, marginTop:4 }}>Нажми + чтобы создать задачу</div>
          </div>
        ) : (
          <>
            {activeTasks.length > 0 && (
              <>
                {activeTasks.length > 1 && (
                  <div style={{ fontSize:10, color:T.dim, textAlign:"right", marginBottom:4, fontWeight:600, letterSpacing:"0.05em" }}>
                    ↕ держи и тяни чтобы изменить порядок
                  </div>
                )}
                {renderActiveTasks()}
              </>
            )}

            {doneTasks.length > 0 && (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:11, color:T.dim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, fontWeight:700 }}>
                  ✓ Выполнено
                </div>
                {doneTasks.map(t => (
                  <TaskCard key={t.id} task={t} onToggle={onToggle} onEdit={() => setEdit(t)} onShopToggle={onShopToggle} />
                ))}
              </div>
            )}
          </>
        )}
        <div style={{ height:88 }} />
      </div>

      {/* FAB */}
      <div style={{ position:"absolute", bottom:20, right:16, zIndex:10 }}>
        <div onClick={() => setCreate(true)} style={{ width:52, height:52, borderRadius:"50%", cursor:"pointer", background:`linear-gradient(135deg,${T.purp},${T.gold})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, color:"#fff", boxShadow:`0 4px 20px ${T.purp}88, 0 0 0 4px ${T.bg0}`, transition:"transform 0.2s cubic-bezier(.34,1.56,.64,1)" }}>+</div>
      </div>

      {showCreate && <TaskModal onClose={() => setCreate(false)} onSave={t => { onSave(t); setCreate(false); }} initialDate={filter === "tomorrow" ? tomorrowStr() : null} initialPeriod={filter === "tomorrow" ? "day" : filter} />}
      {editTask  && <TaskModal existing={editTask} onClose={() => setEdit(null)} onSave={t => { onSave(t); setEdit(null); }} onDelete={id => { onDelete(id); setEdit(null); }} />}
    </div>
  );
}
