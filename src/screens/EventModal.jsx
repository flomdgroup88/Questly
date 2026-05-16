import { useState } from "react";
import { T } from "../theme.js";
import { EVENT_TYPES } from "../constants.js";
import { uid, today, fmtDate } from "../utils.js";
import { ModalOverlay, SectionLabel, StyledInput, Toggle, RecurPicker, Btn } from "../components/ui.jsx";

export default function EventModal({ onClose, onCreate, onUpdate, onDelete, defaultDate, existing }) {
  const isEdit=!!existing;
  const [step,  setStep] =useState(isEdit?"details":"type");
  const [typeId,setTypeId]=useState(existing?.eventType||null);
  const [title, setTitle]=useState(existing?.title||"");
  const [date,  setDate] =useState(existing?.date||defaultDate||today());
  const [rec,   setRec]  =useState(existing?.recurring||false);
  const [rt,    setRT]   =useState(existing?.recurType||"week");
  const [color, setColor]=useState(existing?.color||T.sky);

  const evType=EVENT_TYPES.find(t=>t.id===typeId);

  const pickType=t=>{setTypeId(t.id);setRec(t.defaultRec);setRT(t.defaultRecType||"week");setColor(t.color);setStep("details");};

  const submit=()=>{
    if(!title.trim()||!evType) return;
    const isBd=evType.id==="birthday";
    const ev={id:existing?.id||uid(),title:title.trim(),date,recurring:rec,recurType:rec?rt:"",color:evType.color,isBirthday:isBd,eventType:evType.id};
    if(isEdit){onUpdate(ev);onClose();return;}
    const rawTasks=evType.makeTasks(title.trim(),date);
    const autoTasks=rawTasks.map(t=>({
      id:uid(),done:false,dueDate:t.dueDate||date,
      recurring:rec&&!["trip"].includes(evType.id),
      recurType:rec&&!["trip"].includes(evType.id)?rt:"",
      eventId:ev.id,...t,
    }));
    onCreate(ev,autoTasks);onClose();
  };

  if(step==="type") return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{margin:"0 0 4px",fontSize:18,fontWeight:800,color:T.teal}}>📅 {isEdit?"Изменить событие":"Новое событие"}</h3>
      <p style={{margin:"0 0 18px",fontSize:13,color:T.sub}}>Выбери тип — оформим автоматически</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        {EVENT_TYPES.map(t=>(
          <div key={t.id} onClick={()=>pickType(t)} style={{background:`linear-gradient(135deg,${t.color}18,${t.color}08)`,border:`1.5px solid ${t.color}44`,borderRadius:14,padding:"13px 14px",cursor:"pointer",transition:"all 0.15s",display:"flex",flexDirection:"column",gap:4}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=t.color}
          onMouseLeave={e=>e.currentTarget.style.borderColor=t.color+"44"}>
            <span style={{fontSize:22,lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:13,fontWeight:700,color:t.color,lineHeight:1.2}}>{t.label}</span>
          </div>
        ))}
      </div>
    </ModalOverlay>
  );

  const previewTasks=evType&&title.trim()?evType.makeTasks(title.trim(),date):[];

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        {!isEdit&&(
          <div onClick={()=>setStep("type")} style={{width:30,height:30,borderRadius:8,background:T.bg2,border:`1px solid ${T.brd}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:T.sub,flexShrink:0}}>‹</div>
        )}
        <h3 style={{margin:0,fontSize:17,fontWeight:800,color:evType?.color||T.teal,flex:1}}>
          {isEdit?"✏️ Редактировать событие":`${evType?.icon} ${evType?.label}`}
        </h3>
      </div>

      {evType?.hint&&(
        <div style={{background:evType.hintColor+"15",border:`1px solid ${evType.hintColor}44`,borderRadius:11,padding:"9px 13px",marginBottom:14,fontSize:12.5,color:evType.hintColor,lineHeight:1.5}}>
          {evType.hint}
        </div>
      )}

      <div style={{marginBottom:14}}>
        <SectionLabel>Название</SectionLabel>
        <StyledInput value={title} onChange={e=>setTitle(e.target.value)}
          placeholder={evType?.id==="birthday"?"ДР Алексея…":evType?.id==="meeting"?"Встреча с командой…":evType?.id==="trip"?"Поездка в Барселону…":evType?.id==="deadline"?"Отчёт Q2…":evType?.id==="holiday"?"Новый год…":evType?.id==="health"?"Приём у врача…":"Название события…"}
          onKeyDown={e=>e.key==="Enter"&&submit()}/>
      </div>

      <div style={{marginBottom:14}}>
        <SectionLabel>Дата</SectionLabel>
        <StyledInput type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </div>

      {typeId==="custom"&&(
        <div style={{marginBottom:12}}>
          <SectionLabel>Цвет метки</SectionLabel>
          <div style={{display:"flex",gap:10}}>
            {[T.sky,T.purpL,T.teal,T.gold,T.rose].map(c=>(
              <div key={c} onClick={()=>setColor(c)} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:`3px solid ${color===c?"#fff":"transparent"}`,boxShadow:color===c?`0 0 0 1px ${c}`:"none",transition:"all 0.15s"}}/>
            ))}
          </div>
        </div>
      )}

      {!["birthday","trip"].includes(typeId)&&(
        <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:rec?10:14,background:T.bg0,padding:"11px 14px",borderRadius:11,border:`1px solid ${T.brd}`}}>
            <span style={{fontSize:14,color:T.text}}>🔄 Повторение</span>
            <Toggle value={rec} onChange={setRec}/>
          </div>
          {rec&&<div style={{marginBottom:14}}><RecurPicker value={rt} onChange={setRT} accentC={evType?.color||T.teal} accentL={evType?.color||T.teal}/></div>}
        </>
      )}

      {previewTasks.length>0&&(
        <div style={{background:T.bg0,border:`1px solid ${T.brd}`,borderRadius:11,padding:"10px 13px",marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:T.sub,letterSpacing:"0.06em",marginBottom:7,textTransform:"uppercase"}}>Автозадачи на {date===today()?"сегодня":fmtDate(date)}</div>
          {previewTasks.map((t,i)=>(
            <div key={i} style={{fontSize:13,color:T.text,padding:"3px 0",borderBottom:i<previewTasks.length-1?`1px solid ${T.brd}`:"none"}}>{t.title}</div>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Отмена</Btn>
        <Btn onClick={submit} style={{flex:2,background:`linear-gradient(135deg,${evType?.color||T.teal},${evType?.color||T.teal}99)`,color:"#07071C",fontWeight:800,border:"none",opacity:title.trim()?1:0.5}} disabled={!title.trim()}>
          {isEdit?"Сохранить ✓":"Добавить ✨"}
        </Btn>
      </div>
      {isEdit&&onDelete&&(
        <Btn variant="ghost" onClick={()=>{onDelete(existing.id);onClose();}} style={{marginTop:8,width:"100%",color:T.rose,borderColor:T.rose+"55"}}>
          🗑 Удалить событие
        </Btn>
      )}
    </ModalOverlay>
  );
}
