import { useState } from "react";
import { T } from "../theme.js";
import { MONTHS_RU, WDAYS, EVENT_TYPES } from "../constants.js";
import { today, fmtDate } from "../utils.js";
import { PeriodBadge } from "../components/ui.jsx";
import EventModal from "./EventModal.jsx";

// ─── CALENDAR GRID ────────────────────────────────────────────────
function CalendarGrid({ year, month, events, selectedDate, onSelect }) {
  const first=new Date(year,month,1);
  const last=new Date(year,month+1,0);
  const startDow=(first.getDay()+6)%7;
  const cells=Array(startDow).fill(null).concat(Array.from({length:last.getDate()},(_,i)=>i+1));

  const evMap={};
  events.forEach(ev=>{
    const add=d=>{if(!evMap[d])evMap[d]=[];if(!evMap[d].find(e=>e.id===ev.id))evMap[d].push(ev);};
    const [ey,em,ed]=ev.date.split("-").map(Number);
    if(ey===year&&em===month+1) add(ed);
    if(ev.recurring&&ev.recurType==="year"&&em===month+1) add(ed);
    if(ev.recurring&&ev.recurType==="month"){const evStart=new Date(ey,em-1,1);const gridStart=new Date(year,month,1);if(gridStart>=evStart){const targetDay=Math.min(ed,last.getDate());add(targetDay);}}
    if(ev.recurring&&ev.recurType==="week"){const dow=new Date(ev.date).getDay();for(let d=1;d<=last.getDate();d++)if(new Date(year,month,d).getDay()===dow)add(d);}
    if(ev.recurring&&ev.recurType==="day") for(let d=1;d<=last.getDate();d++) add(d);
  });

  const now=new Date(),tD=now.getDate(),tM=now.getMonth(),tY=now.getFullYear();
  const isThisMonth=month===tM&&year===tY;
  const selDay=selectedDate?parseInt(selectedDate.split("-")[2]):null;
  const selSame=selectedDate&&parseInt(selectedDate.split("-")[1])-1===month&&parseInt(selectedDate.split("-")[0])===year;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
        {WDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:11,color:T.sub,fontWeight:700,padding:"4px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={`e${i}`}/>;
          const isToday=isThisMonth&&day===tD;
          const isSel=selSame&&day===selDay;
          const evs=evMap[day]||[];
          const colors=[...new Set(evs.slice(0,3).map(e=>e.color))];
          const hasBd=evs.some(e=>e.isBirthday);
          return (
            <div key={day} onClick={()=>onSelect(`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`)} style={{aspectRatio:"1",borderRadius:8,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:isSel?T.purp:isToday?T.bg3:"transparent",border:isToday&&!isSel?`1.5px solid ${T.purp}`:"1.5px solid transparent",transition:"all 0.15s",padding:"2px 0"}}>
              <span style={{fontSize:12,fontWeight:isToday?800:400,lineHeight:1,color:isSel?"#fff":isToday?T.purpL:hasBd?T.gold:T.text}}>{day}</span>
              {colors.length>0&&<div style={{display:"flex",gap:2,marginTop:2}}>{colors.map((c,ci)=><div key={ci} style={{width:4,height:4,borderRadius:"50%",background:c}}/>)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CALENDAR SCREEN ──────────────────────────────────────────────
export default function CalendarScreen({ events, tasks, onAddEvent, onEditEvent, onDeleteEvent }) {
  const now=new Date();
  const [month,setMonth]=useState(now.getMonth());
  const [year,setYear]=useState(now.getFullYear());
  const [selDate,setSel]=useState(today);
  const [showModal,setModal]=useState(false);
  const [editEvent,setEditEvent]=useState(null);

  const prev=()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);};
  const next=()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);};

  const selEvents=events.filter(ev=>{
    if(ev.date===selDate) return true;
    const [,em,ed]=ev.date.split("-").map(Number),[,sm,sd]=selDate.split("-").map(Number);
    if(ev.recurring&&ev.recurType==="year"&&em===sm&&ed===sd) return true;
    if(ev.recurring&&ev.recurType==="month"){const [ey2,em2,ed2]=ev.date.split("-").map(Number);const [sy,sm,sd]=selDate.split("-").map(Number);const evStart=new Date(ey2,em2-1,1);const selStart=new Date(sy,sm-1,1);if(selStart>=evStart){const lastDayOfSel=new Date(sy,sm,0).getDate();return Math.min(ed2,lastDayOfSel)===sd;}return false;}
    if(ev.recurring&&ev.recurType==="week") return new Date(ev.date).getDay()===new Date(selDate).getDay();
    if(ev.recurring&&ev.recurType==="day") return true;
    return false;
  });
  const selTasks=tasks.filter(t=>t.dueDate===selDate);

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
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
          <div style={{fontSize:14,fontWeight:700,color:T.text}}>{selDate===today()?"📅 Сегодня":`📅 ${fmtDate(selDate)}`}</div>
          <div onClick={()=>setModal(true)} style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,background:T.teal+"22",color:T.teal,border:`1px solid ${T.teal}55`}}>+ Событие</div>
        </div>

        {selEvents.length===0&&selTasks.length===0?(
          <div style={{textAlign:"center",padding:"30px 0",color:T.dim}}>
            <div style={{fontSize:36,marginBottom:8}}>📅</div>
            <div style={{fontSize:14}}>Нет событий в этот день</div>
          </div>
        ):(
          <>
            {selEvents.map(ev=>(
              <div key={ev.id} onClick={()=>setEditEvent(ev)} style={{background:`linear-gradient(135deg,${ev.color}18,${T.bg2})`,border:`1px solid ${ev.color}55`,borderLeft:`4px solid ${ev.color}`,borderRadius:12,padding:"13px 14px",marginBottom:9,display:"flex",alignItems:"center",gap:12,boxShadow:`0 2px 12px ${ev.color}22`,cursor:"pointer",transition:"opacity 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                <div style={{width:40,height:40,borderRadius:10,background:ev.color+"22",border:`1px solid ${ev.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                  {(()=>{const t=EVENT_TYPES.find(t=>t.id===ev.eventType);return t?t.icon:"📌";})()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.title}</div>
                  <div style={{fontSize:11,color:ev.color,marginTop:3,fontWeight:600}}>{ev.recurring?`🔄 ${ev.recurType==="year"?"Ежегодно":ev.recurType==="month"?"Ежемесячно":ev.recurType==="week"?"Еженедельно":"Ежедневно"}`:"📌 Разовое"}</div>
                </div>
                <div style={{fontSize:14,color:T.sub,flexShrink:0}}>✏️</div>
              </div>
            ))}
            {selTasks.length>0&&<div style={{fontSize:11,color:T.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Квесты на этот день</div>}
            {selTasks.map(t=>(
              <div key={t.id} style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:11,padding:"11px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:t.done?T.teal+"44":"transparent",border:`2px solid ${t.done?T.teal:T.dim}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{t.done&&"✓"}</div>
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
      {showModal&&<EventModal onClose={()=>setModal(false)} onCreate={onAddEvent} defaultDate={selDate}/>}
      {editEvent&&<EventModal existing={editEvent} onClose={()=>setEditEvent(null)} onUpdate={onEditEvent} onDelete={onDeleteEvent}/>}
    </div>
  );
}
