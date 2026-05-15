import { useState, useRef, useCallback, useEffect } from "react";

const T = {
  bg0:"#07071C", bg1:"#0D0D28", bg2:"#13133A", bg3:"#1A1A4A",
  brd:"#252565",
  gold:"#F5A623",
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
  return { label:`${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`, color:"#3A3A6A" };
};

const applyOrder = (tasks, savedIds) => {
  if (!savedIds?.length) return tasks;
  const map = Object.fromEntries(tasks.map(t=>[t.id,t]));
  const ordered  = savedIds.filter(id=>map[id]).map(id=>map[id]);
  const newTasks = tasks.filter(t=>!savedIds.includes(t.id));
  return [...ordered, ...newTasks];
};

function DragDots({ color }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:3,flexShrink:0,padding:"0 2px"}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{display:"flex",gap:3}}>
          {[0,1].map(j=>(
            <div key={j} style={{width:3,height:3,borderRadius:"50%",background:color}}/>
          ))}
        </div>
      ))}
    </div>
  );
}

function TaskRow({ task, accent, activeTab, isDragging, isDropTarget }) {
  const due = activeTab!=="day" ? fmtDue(task.dueDate) : null;
  return (
    <div style={{
      display:"flex",
      alignItems:"center",
      gap:12,
      padding:"15px 16px",
      background: isDragging ? T.bg3 : "transparent",
      borderBottom:`1px solid ${isDropTarget ? accent : T.brd}`,
      opacity: isDragging ? 0.45 : 1,
      boxShadow: isDropTarget ? `inset 3px 0 0 ${accent}` : "inset 3px 0 0 transparent",
      transition:"opacity 0.12s, box-shadow 0.12s, background 0.12s",
      cursor:"grab",
      userSelect:"none",
      WebkitUserSelect:"none",
    }}>
      <DragDots color={isDragging ? accent : T.dim}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{
          fontSize:15,
          fontWeight:500,
          color:T.text,
          lineHeight:1.35,
          letterSpacing:"-0.01em",
        }}>
          {task.title}
        </div>
        {due && (
          <div style={{fontSize:11,color:due.color,marginTop:3,fontWeight:500}}>
            {due.label}
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableList({ tasks, accent, activeTab, orderMap, sectionKey, onReorder }) {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [overIdx, setOverIdx]         = useState(null);

  const ordered = applyOrder(tasks, orderMap[sectionKey]);

  const handleDragStart = (e, idx) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:absolute;top:-9999px;left:-9999px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(()=>document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (idx!==draggingIdx) setOverIdx(idx);
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (draggingIdx!==null && draggingIdx!==idx) {
      const arr = [...ordered];
      const [moved] = arr.splice(draggingIdx,1);
      arr.splice(idx,0,moved);
      onReorder(sectionKey, arr.map(t=>t.id));
    }
    setDraggingIdx(null); setOverIdx(null);
  };

  if (ordered.length===0) {
    return (
      <div style={{padding:"60px 24px",textAlign:"center"}}>
        <div style={{fontSize:36,marginBottom:10,opacity:0.4}}>✓</div>
        <div style={{fontSize:14,color:T.sub,fontWeight:500}}>Нет незавершённых дел</div>
      </div>
    );
  }

  return (
    <div>
      {ordered.map((task, idx)=>(
        <div
          key={task.id}
          draggable
          onDragStart={e=>handleDragStart(e,idx)}
          onDragOver={e=>handleDragOver(e,idx)}
          onDrop={e=>handleDrop(e,idx)}
          onDragEnd={()=>{setDraggingIdx(null);setOverIdx(null);}}
        >
          <TaskRow
            task={task}
            accent={accent}
            activeTab={activeTab}
            isDragging={draggingIdx===idx}
            isDropTarget={overIdx===idx && draggingIdx!==idx}
          />
        </div>
      ))}
    </div>
  );
}

export default function OverviewScreen({ tasks }) {
  const [activeTab, setActiveTab] = useState("day");
  const [orderMap,  setOrderMap]  = useState(loadOrder);
  const today = todayStr();

  useEffect(()=>{ saveOrder(orderMap); }, [orderMap]);

  const handleReorder = useCallback((key, ids)=>{
    setOrderMap(prev=>({...prev,[key]:ids}));
  },[]);

  const tasksByTab = {
    day:   tasks.filter(t=>!t.done && t.period==="day"   && t.dueDate===today),
    week:  tasks.filter(t=>!t.done && t.period==="week"  && isInCurrentWeek(t.dueDate||today)),
    month: tasks.filter(t=>!t.done && t.period==="month" && isInCurrentMonth(t.dueDate||today)),
  };

  const ACCENT = { day:T.teal, week:T.sky, month:T.purpL };
  const accent = ACCENT[activeTab];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Tab bar */}
      <div style={{
        display:"flex",
        borderBottom:`1px solid ${T.brd}`,
        background:T.bg1,
        flexShrink:0,
      }}>
        {TABS.map(tab=>{
          const active = activeTab===tab.key;
          const cnt    = tasksByTab[tab.key].length;
          const acc    = ACCENT[tab.key];
          return (
            <div
              key={tab.key}
              onClick={()=>setActiveTab(tab.key)}
              style={{
                flex:1,
                padding:"14px 0 12px",
                textAlign:"center",
                cursor:"pointer",
                position:"relative",
                transition:"all 0.18s",
              }}
            >
              <span style={{
                fontSize:13,
                fontWeight: active ? 700 : 500,
                color: active ? acc : T.sub,
                transition:"color 0.18s",
                letterSpacing:"0.01em",
              }}>
                {tab.label}
              </span>
              {cnt>0 && (
                <span style={{
                  marginLeft:5,
                  fontSize:10,
                  fontWeight:700,
                  color: active ? acc : T.dim,
                  transition:"color 0.18s",
                }}>
                  {cnt}
                </span>
              )}
              {active && (
                <div style={{
                  position:"absolute",
                  bottom:0,left:"20%",right:"20%",
                  height:2,
                  borderRadius:2,
                  background:acc,
                  boxShadow:`0 0 8px ${acc}`,
                }}/>
              )}
            </div>
          );
        })}
      </div>

      {/* List */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        <DraggableList
          key={activeTab}
          tasks={tasksByTab[activeTab]}
          accent={accent}
          activeTab={activeTab}
          orderMap={orderMap}
          sectionKey={activeTab}
          onReorder={handleReorder}
        />
        <div style={{height:24}}/>
      </div>
    </div>
  );
}
