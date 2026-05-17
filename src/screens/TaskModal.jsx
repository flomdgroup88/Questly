import { useState } from "react";
import { T } from "../theme.js";
import { PERIODS, CHECKLIST_PRESETS } from "../constants.js";
import { uid, defaultDueForPeriod, today } from "../utils";
import { ModalOverlay, SectionLabel, StyledInput, Toggle, RecurPicker, Btn } from "../components/ui.jsx";

export default function TaskModal({ onClose, onSave, onDelete, existing=null, initialDate=null, initialPeriod=null }) {
  const isEdit=!!existing;
  const [title,   setTitle] =useState(existing?.title    ??"");
  const [period,  setPeriod]=useState(existing?.period   ??(initialPeriod??"day"));
  const [dueDate, setDate]  =useState(existing?.dueDate  ??initialDate??defaultDueForPeriod(existing?.period??"day"));
  const [recurring,setRec]  =useState(existing?.recurring??false);
  const [recurType,setRT]   =useState(existing?.recurType??"day");
  const [streakEnabled,setStreak]=useState(existing?.streakEnabled??false);
  const [bulkMode,setBulk]  =useState(false);
  const [bulkText,setBulkText]=useState("");
  const [hasChecklist,setHasChecklist]=useState(!!(existing?.shopItems?.length));
  const [checkPresetId,setCheckPresetId]=useState(existing?.checklistPresetId||"shop");
  const [checklistIcon,setCheckIcon]=useState(existing?.checklistIcon||"🛒");
  const [checklistName,setCheckName]=useState(existing?.checklistName||"Покупки");
  const [customEmoji,setCustomEmoji]=useState(existing?.checklistIcon||"");
  const [customLabel,setCustomLabel]=useState(existing?.checklistName||"");
  const [shopItems,setShopItems]=useState(existing?.shopItems??[]);
  const [shopInput,setShopInput]=useState("");

  const pickPreset=p=>{
    setCheckPresetId(p.id);
    if(p.id!=="custom"){setCheckIcon(p.icon);setCheckName(p.label);}
    else{setCheckIcon(customEmoji||"📋");setCheckName(customLabel||"Список");}
  };
  const handleSetRec=v=>{setRec(v);if(!v)setStreak(false);};
  const handlePeriodChange=p=>{setPeriod(p);if(!isEdit)setDate(defaultDueForPeriod(p));};

  const submit=()=>{
    const p=PERIODS.find(x=>x.id===period);
    if(bulkMode&&!isEdit){
      const lines=bulkText.split("\n").map(l=>l.trim()).filter(Boolean);
      if(!lines.length) return;
      lines.forEach(line=>onSave({id:uid(),title:line,period,done:false,xp:p.xp,dueDate,recurring,recurType,streakEnabled,streak:0}));
      onClose();return;
    }
    if(!title.trim()) return;
    onSave({
      id:existing?.id??uid(),title:title.trim(),period,done:existing?.done??false,
      xp:p.xp,dueDate,recurring,recurType,streakEnabled,streak:existing?.streak??0,
      ...(hasChecklist?{
        shopItems,
        checklistIcon:checkPresetId==="custom"?(customEmoji||"📋"):checklistIcon,
        checklistName:checkPresetId==="custom"?(customLabel||"Список"):checklistName,
        checklistPresetId:checkPresetId,
      }:{}),
    });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{margin:"0 0 18px",fontSize:18,fontWeight:800,color:isEdit?T.purpL:T.gold}}>
        {isEdit?"✏️ Редактировать квест":"⚔️ Новый квест"}
      </h3>

      {!isEdit&&(
        <div style={{display:"flex",gap:6,marginBottom:14,background:T.bg0,borderRadius:11,padding:4,border:`1px solid ${T.brd}`}}>
          {[["single","⚡ Одна задача"],["bulk","📋 Список"]].map(([mode,label])=>(
            <div key={mode} onClick={()=>setBulk(mode==="bulk")} style={{flex:1,padding:"8px 0",borderRadius:8,textAlign:"center",fontSize:13,fontWeight:700,cursor:"pointer",background:bulkMode===(mode==="bulk")?T.purp:"transparent",color:bulkMode===(mode==="bulk")?"#fff":T.sub,transition:"all 0.2s"}}>{label}</div>
          ))}
        </div>
      )}

      <div style={{marginBottom:14}}>
        <SectionLabel>{bulkMode&&!isEdit?"Задачи (каждая строка — новое дело)":"Название задачи"}</SectionLabel>
        {bulkMode&&!isEdit?(
          <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)}
            placeholder={"Утренняя зарядка\nПрочитать 20 страниц\nОтправить отчёт..."} rows={5}
            style={{width:"100%",padding:"11px 14px",background:T.bg0,border:`1px solid ${T.purp}`,borderRadius:11,color:T.text,fontSize:15,outline:"none",resize:"vertical",colorScheme:"dark",fontFamily:"inherit",lineHeight:1.6,minHeight:120}}/>
        ):(
          <StyledInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="Введите задачу..." onKeyDown={e=>e.key==="Enter"&&submit()}/>
        )}
        {bulkMode&&!isEdit&&bulkText.trim()&&(
          <div style={{fontSize:11,color:T.teal,marginTop:6,fontWeight:600}}>✓ Будет создано задач: {bulkText.split("\n").filter(l=>l.trim()).length}</div>
        )}
      </div>

      <div style={{marginBottom:14}}>
        <SectionLabel>Период</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {PERIODS.map(p=>(
            <div key={p.id} onClick={()=>handlePeriodChange(p.id)} style={{padding:"10px 12px",borderRadius:11,cursor:"pointer",border:`2px solid ${period===p.id?p.accent:T.brd}`,background:period===p.id?p.accent+"20":T.bg0,transition:"all 0.15s"}}>
              <div style={{fontSize:14,fontWeight:700,color:period===p.id?p.accent:T.sub}}>{p.icon} {p.label}</div>
              <div style={{fontSize:11,color:period===p.id?p.accent+"AA":T.dim,marginTop:2}}>+{p.xp} XP</div>
            </div>
          ))}
        </div>
      </div>

      {!bulkMode&&(
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg0,padding:"11px 14px",borderRadius:11,border:`1px solid ${T.brd}`,marginBottom:hasChecklist?10:0,cursor:"pointer"}} onClick={()=>setHasChecklist(v=>!v)}>
            <div>
              <span style={{fontSize:14,color:T.text}}>
                {hasChecklist?`${checkPresetId==="custom"?(customEmoji||"📋"):checklistIcon} ${checkPresetId==="custom"?(customLabel||"Список"):checklistName}`:"📋 Добавить чеклист"}
              </span>
              {hasChecklist&&<div style={{fontSize:11,color:T.purpL,marginTop:3,fontWeight:600}}>Отмечай пункты прямо в задаче</div>}
            </div>
            <Toggle value={hasChecklist} onChange={setHasChecklist}/>
          </div>
          {hasChecklist&&(
            <div style={{background:T.bg0,border:`1px solid ${T.brd}`,borderRadius:11,padding:"12px 14px"}}>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,marginBottom:8}}>Тип списка</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  {CHECKLIST_PRESETS.map(p=>(
                    <div key={p.id} onClick={()=>pickPreset(p)} style={{padding:"8px 4px",borderRadius:9,cursor:"pointer",textAlign:"center",border:`1.5px solid ${checkPresetId===p.id?T.purp:T.brd}`,background:checkPresetId===p.id?T.purp+"33":T.bg2,transition:"all 0.15s"}}>
                      <div style={{fontSize:18,lineHeight:1,marginBottom:2}}>{p.icon}</div>
                      <div style={{fontSize:9,fontWeight:700,color:checkPresetId===p.id?T.purpL:T.sub,lineHeight:1.2}}>{p.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              {checkPresetId==="custom"&&(
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  <input value={customEmoji} onChange={e=>{setCustomEmoji(e.target.value.slice(-2));setCheckIcon(e.target.value.slice(-2)||"📋");}} placeholder="😊" style={{width:48,padding:"9px 8px",background:T.bg2,textAlign:"center",border:`1px solid ${T.purp}`,borderRadius:9,color:T.text,fontSize:18,outline:"none",colorScheme:"dark",flexShrink:0}}/>
                  <input value={customLabel} onChange={e=>{setCustomLabel(e.target.value);setCheckName(e.target.value||"Список");}} placeholder="Название списка…" style={{flex:1,padding:"9px 12px",background:T.bg2,border:`1px solid ${T.purp}`,borderRadius:9,color:T.text,fontSize:14,outline:"none",colorScheme:"dark"}}/>
                </div>
              )}
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <input value={shopInput} onChange={e=>setShopInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){if(!shopInput.trim())return;setShopItems(p=>[...p,{id:uid(),title:shopInput.trim(),done:false}]);setShopInput("");}}}
                  placeholder="Добавить пункт…"
                  style={{flex:1,padding:"9px 12px",background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:9,color:T.text,fontSize:14,outline:"none",colorScheme:"dark"}}/>
                <div onClick={()=>{if(!shopInput.trim())return;setShopItems(p=>[...p,{id:uid(),title:shopInput.trim(),done:false}]);setShopInput("");}} style={{width:38,height:38,borderRadius:9,background:T.purp+"33",border:`1px solid ${T.purp}66`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:T.purpL,flexShrink:0}}>+</div>
              </div>
              {shopItems.length===0?(
                <div style={{fontSize:12,color:T.dim,textAlign:"center",padding:"4px 0"}}>Добавь пункты 👆</div>
              ):(
                shopItems.map((it,i)=>(
                  <div key={it.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 4px",borderBottom:i<shopItems.length-1?`1px solid ${T.brdDim}`:"none"}}>
                    <span style={{fontSize:14,marginRight:2}}>{checkPresetId==="custom"?(customEmoji||"📋"):checklistIcon}</span>
                    <span style={{fontSize:13,color:T.text,flex:1}}>{it.title}</span>
                    <div onClick={()=>setShopItems(p=>p.filter(x=>x.id!==it.id))} style={{fontSize:13,color:T.rose,cursor:"pointer",padding:"2px 8px",borderRadius:6,background:T.rose+"11"}}>✕</div>
                  </div>
                ))
              )}
              {shopItems.length>0&&<div style={{fontSize:11,color:T.purpL,marginTop:8,fontWeight:600,textAlign:"center"}}>{shopItems.length} {shopItems.length===1?"пункт":"пункт(ов)"} в списке</div>}
            </div>
          )}
        </div>
      )}

      {period !== "dream" && (
      <div style={{marginBottom:14}}>
        <SectionLabel>Срок выполнения</SectionLabel>
        <StyledInput type="date" value={dueDate} onChange={e=>setDate(e.target.value)}/>
      </div>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:recurring?10:18,background:T.bg0,padding:"11px 14px",borderRadius:11,border:`1px solid ${T.brd}`}}>
        <span style={{fontSize:14,color:T.text}}>🔄 Повторяемая задача</span>
        <Toggle value={recurring} onChange={handleSetRec}/>
      </div>

      {recurring&&(
        <>
          <div style={{marginBottom:10}}><RecurPicker value={recurType} onChange={setRT}/></div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,background:T.bg0,padding:"11px 14px",borderRadius:11,border:`1px solid ${streakEnabled?"#FF6B3555":T.brd}`,transition:"border-color 0.2s"}}>
            <div>
              <span style={{fontSize:14,color:T.text}}>🔥 Отслеживать серию</span>
              {streakEnabled&&<div style={{fontSize:11,color:"#FF6B35",marginTop:3,fontWeight:600}}>Считает дни подряд — не прерви цепочку!</div>}
            </div>
            <Toggle value={streakEnabled} onChange={setStreak}/>
          </div>
        </>
      )}

      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Отмена</Btn>
        <Btn variant="primary" onClick={submit} style={{flex:2}} disabled={bulkMode&&!isEdit?!bulkText.trim():!title.trim()}>
          {isEdit?"Сохранить ✓":bulkMode?"Создать квесты ⚡":"Создать квест ⚡"}
        </Btn>
      </div>
      {isEdit&&onDelete&&(
        <div style={{marginTop:12}}>
          <Btn variant="danger" onClick={()=>{onDelete(existing.id);onClose();}}>🗑 Удалить квест</Btn>
        </div>
      )}
    </ModalOverlay>
  );
}
