import { useState, useMemo } from "react";
import { T } from "../theme.js";
import { today, tomorrowStr, isInCurrentWeek, isInCurrentMonth, isInCurrentYear } from "../utils.js";
import { XPBar } from "../components/ui.jsx";
import TaskCard from "../components/TaskCard.jsx";
import TaskModal from "./TaskModal.jsx";

const FILTER_TABS = [
  { id:"day",      label:"Сегодня", icon:"⚡", accent:T.teal  },
  { id:"tomorrow", label:"Завтра",  icon:"🌅", accent:T.sky   },
  { id:"week",     label:"Неделя",  icon:"🌊", accent:T.sky   },
  { id:"month",    label:"Месяц",   icon:"💫", accent:T.purpL },
  { id:"year",     label:"Год",     icon:"👑", accent:T.gold  },
];

export default function TasksScreen({ tasks, onToggle, onSave, onDelete, onShopToggle }) {
  const [filter,setFilter]=useState("day");
  const [showCreate,setCreate]=useState(false);
  const [editTask,setEdit]=useState(null);

  const tmrw = tomorrowStr();

  // useMemo: пересчитываем список только когда реально изменился массив задач
  // или выбранный фильтр — не при каждом рендере родителя.
  const filtered = useMemo(() => tasks.filter((t) => {
    if (filter === "tomorrow") return t.period === "day" && t.dueDate === tmrw;
    if (t.period !== filter) return false;
    if (!t.dueDate) return filter === "day";
    if (filter === "day")   return t.dueDate === today;
    if (filter === "week")  return isInCurrentWeek(t.dueDate);
    if (filter === "month") return isInCurrentMonth(t.dueDate);
    if (filter === "year")  return isInCurrentYear(t.dueDate);
    return true;
  }), [tasks, filter, tmrw]);

  const done  = useMemo(() => filtered.filter((t) => t.done).length, [filtered]);
  const total = filtered.length;
  const pct   = total > 0 ? done / total : 0;
  const ft    = FILTER_TABS.find((x) => x.id === filter);
  const p     = filter === "tomorrow"
    ? { accent: T.sky, desc: "на завтра", xp: 15 }
    : { accent: ft.accent, desc: filter === "day" ? "на сегодня" : filter === "week" ? "на неделю" : filter === "month" ? "на месяц" : "на год", xp: 0 };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
      <div style={{padding:"12px 16px 8px",flexShrink:0}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3,background:T.bg2,borderRadius:14,padding:3,border:`1px solid ${T.brd}`}}>
          {FILTER_TABS.map(ft=>{
            const active=filter===ft.id;
            return (
              <div key={ft.id} onClick={()=>setFilter(ft.id)} style={{borderRadius:10,cursor:"pointer",padding:"7px 2px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:active?ft.accent:"transparent",boxShadow:active?`0 2px 8px ${ft.accent}55`:"none",transition:"all 0.2s cubic-bezier(.34,1.56,.64,1)"}}>
                <span style={{fontSize:13,lineHeight:1}}>{ft.icon}</span>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.01em",color:active?(ft.id==="month"?"#fff":"#000"):T.sub,transition:"color 0.2s"}}>{ft.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{margin:"4px 16px 12px",background:T.bg2,borderRadius:14,padding:"14px 16px",border:`1px solid ${T.brd}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
          <div>
            <div style={{fontSize:12,color:T.sub,marginBottom:2}}>Прогресс {p.desc}</div>
            <div style={{fontSize:22,fontWeight:800,color:p.accent}}>{done}<span style={{fontSize:14,color:T.sub,fontWeight:400}}>/{total} квестов</span></div>
          </div>
          <div style={{fontSize:13,color:T.gold,fontWeight:700}}>{Math.round(pct*100)}%</div>
        </div>
        <XPBar progress={pct} color={p.accent} height={6}/>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"0 16px",WebkitOverflowScrolling:"touch"}}>
        {filtered.length===0?(
          <div style={{textAlign:"center",padding:"40px 0",color:T.dim}}>
            <div style={{fontSize:40,marginBottom:12}}>🗡️</div>
            <div style={{fontSize:15,fontWeight:600,color:T.sub}}>Нет активных квестов</div>
            <div style={{fontSize:13,marginTop:4}}>Нажми + чтобы создать задачу</div>
          </div>
        ):(
          <>
            {filtered.filter(t=>!t.done).map(t=>(
              <TaskCard key={t.id} task={t} onToggle={onToggle} onEdit={()=>setEdit(t)} onShopToggle={onShopToggle}/>
            ))}
            {filtered.some(t=>t.done)&&(
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

      <div style={{position:"absolute",bottom:20,right:16,zIndex:10}}>
        <div onClick={()=>setCreate(true)} style={{width:52,height:52,borderRadius:"50%",cursor:"pointer",background:`linear-gradient(135deg,${T.purp},${T.gold})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,color:"#fff",boxShadow:`0 4px 20px ${T.purp}88, 0 0 0 4px ${T.bg0}`,transition:"transform 0.2s cubic-bezier(.34,1.56,.64,1)"}}>+</div>
      </div>

      {showCreate&&<TaskModal onClose={()=>setCreate(false)} onSave={t=>{onSave(t);setCreate(false);}} initialDate={filter==="tomorrow"?tomorrowStr():null}/>}
      {editTask&&<TaskModal existing={editTask} onClose={()=>setEdit(null)} onSave={t=>{onSave(t);setEdit(null);}} onDelete={id=>{onDelete(id);setEdit(null);}}/>}
    </div>
  );
}
