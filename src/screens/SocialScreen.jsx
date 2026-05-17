import { useState, useEffect } from "react";
import { T } from "../theme.js";
import { today, uid, mkCode } from "../utils.js";
import { ModalOverlay, SectionLabel, StyledInput, RecurPicker, Btn, XPBar } from "../components/ui.jsx";
import ShareSheet from "../components/ShareSheet.jsx";
import { cloudSave, cloudFind, cloudAddParticipant, cloudSubscribeParticipants, cloudUpdateMyProgress, cloudDeduplicateParticipants } from "../firebase.js";

// ─── NEW CHALLENGE MODAL ──────────────────────────────────────────
function NewChallengeModal({ onClose, onCreate, nickname }) {
  const [title,setTitle]=useState(""); const [emoji,setEmoji]=useState("🏋️"); const [desc,setDesc]=useState(""); const [rt,setRT]=useState("day");
  const [submitting,setSubmitting]=useState(false);
  const EMOJIS=["🏋️","🏃","🧘","📚","💧","🌅","🎯","💪","🚴","🍎","✏️","🎸"];
  const submit=()=>{
    if(!title.trim()||submitting) return;
    setSubmitting(true); // блокируем кнопку от повторного нажатия
    const tgUser=typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user;
    const creatorName=nickname||tgUser?.first_name||"Создатель";
    onCreate({id:uid(),title:title.trim(),emoji,desc:desc.trim(),shareCode:mkCode(),recurType:rt,createdAt:today(),myStreak:0,myHistory:[],participants:[],_myName:creatorName});
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
        <Btn variant="primary" onClick={submit} style={{flex:2}} disabled={!title.trim()||submitting}>Создать ⚡</Btn>
      </div>
    </ModalOverlay>
  );
}

// ─── NEW SHARED GOAL MODAL ────────────────────────────────────────
function NewSharedGoalModal({ onClose, onCreate, nickname }) {
  const [title,setTitle]=useState(""); const [itemText,setItemText]=useState(""); const [items,setItems]=useState([]);
  const [submitting,setSubmitting]=useState(false);
  const addItem=()=>{if(!itemText.trim())return;setItems(p=>[...p,{id:uid(),title:itemText.trim(),assignedTo:null,doneBy:null,done:false}]);setItemText("");};
  const submit=()=>{
    if(!title.trim()||items.length===0||submitting) return;
    setSubmitting(true); // блокируем кнопку от повторного нажатия
    onCreate({id:uid(),title:title.trim(),emoji:"🎯",shareCode:mkCode(),createdAt:today(),participants:[nickname||"Я"],items});
    onClose();
  };
  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{margin:"0 0 4px",fontSize:18,fontWeight:800,color:T.teal}}>🎯 Общая цель</h3>
      <p style={{margin:"0 0 18px",fontSize:13,color:T.sub}}>Раздели задачи с другом и выполняйте вместе</p>
      <div style={{marginBottom:14}}><SectionLabel>Название</SectionLabel><StyledInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="Список покупок / Подготовка к вечеринке…"/></div>
      <div style={{marginBottom:14}}>
        <SectionLabel>Пункты ({items.length})</SectionLabel>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input value={itemText} onChange={e=>setItemText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Добавить пункт…" style={{flex:1,padding:"10px 13px",background:T.bg0,border:`1px solid ${T.brd}`,borderRadius:10,color:T.text,fontSize:14,outline:"none",colorScheme:"dark"}}/>
          <div onClick={addItem} style={{width:40,height:40,borderRadius:10,background:T.teal+"33",border:`1px solid ${T.teal}66`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:20,color:T.teal,flexShrink:0}}>+</div>
        </div>
        {items.map(it=>(
          <div key={it.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.bg0,borderRadius:10,border:`1px solid ${T.brd}`,marginBottom:6}}>
            <span style={{fontSize:14,color:T.text,flex:1}}>{it.title}</span>
            <div onClick={()=>setItems(p=>p.filter(x=>x.id!==it.id))} style={{fontSize:14,color:T.rose,cursor:"pointer",padding:"2px 6px"}}>✕</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Отмена</Btn>
        <Btn variant="teal" onClick={submit} style={{flex:2}} disabled={!title.trim()||items.length===0||submitting}>Создать 🎯</Btn>
      </div>
    </ModalOverlay>
  );
}

// ─── JOIN MODAL ───────────────────────────────────────────────────
function JoinModal({ challenges, sharedGoals, onClose, onJoinCh, onJoinSg, nickname, userAvatar }) {
  const [code,setCode]=useState(""); const [result,setResult]=useState(null); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const search=async(c)=>{
    if(!c){setErr("Введи код");return;}
    const localCh=challenges.find(x=>x.shareCode===c);
    const localSg=sharedGoals.find(x=>x.shareCode===c);
    if(localCh){setResult({type:"challenge",data:localCh});setErr("");return;}
    if(localSg){setResult({type:"goal",data:localSg});setErr("");return;}
    setLoading(true);setErr("");setResult(null);
    try{const found=await cloudFind(c);if(found){setResult(found);setErr("");}else setErr("Код не найден. Проверь правильность кода.");}
    catch{setErr("Ошибка соединения. Проверь интернет.");}
    finally{setLoading(false);}
  };
  const handleChange=e=>{
    const val=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
    setCode(val);setResult(null);setErr("");
    if(val.length===6) search(val);
  };
  const join=async()=>{
    if(!result) return;
    const tgUser=typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userName=nickname||tgUser?.first_name||"Друг";
    const tgId=tgUser?.id?String(tgUser.id):null;
    if(result.type==="challenge"){
      onJoinCh(result.data);
      await cloudAddParticipant("challenge",result.data.shareCode,{name:userName,avatar:userAvatar||"👤",streak:0,lastCompleted:null,history:[],...(tgId?{tgId}:{})});
      // Дедупликация только при вступлении — не при каждом открытии
      cloudDeduplicateParticipants(result.data.shareCode).catch(()=>{});
    }else{
      onJoinSg(result.data);
      await cloudAddParticipant("goal",result.data.shareCode,userName);
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
        <div style={{textAlign:"center",marginTop:8,fontSize:12,color:T.sub}}>{loading?"⏳ Ищем...":code.length<6?`${code.length}/6 символов`:""}</div>
      </div>
      {err&&<div style={{color:T.rose,fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</div>}
      {result&&(
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

// ─── CHALLENGE DETAIL ─────────────────────────────────────────────
function ChallengeDetail({ ch, onClose, onComplete, onShare, onDelete, nickname, userAvatar }) {
  const tgUser=typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user;
  const myName=nickname||tgUser?.first_name||ch._myName||"Ты";
  const myTgId=tgUser?.id?String(tgUser.id):null;
  const myDoneToday=ch.myHistory.includes(today());
  const period=ch.recurType==="day"?"Ежедневно":ch.recurType==="week"?"Еженедельно":"Ежегодно";
  const [freshParts,setFreshParts]=useState(ch.participants||[]);
  const [syncing,setSyncing]=useState(false);
  // Оптимистик: локальный флаг — кнопка реагирует мгновенно, не ждёт родителя
  const [doneToday,setDoneToday]=useState(ch.myHistory.includes(today()));
  const [saving,setSaving]=useState(false);
  const [saveErr,setSaveErr]=useState(false);

  const pastDay=n=>{const d=new Date();d.setDate(d.getDate()-n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};

  useEffect(()=>{
    if(!ch.shareCode) return;
    setSyncing(true);
    // onSnapshot: Firestore присылает обновления сам — setInterval больше не нужен
    const unsub=cloudSubscribeParticipants(ch.shareCode,(parts)=>{
      const others=myTgId?parts.filter(p=>p.tgId?p.tgId!==myTgId:p.name!==myName):parts.filter(p=>p.name!==myName);
      setFreshParts(others);
      setSyncing(false);
    });
    return unsub; // отписка при закрытии модала
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ch.shareCode,myTgId,myName]);

  const allParts=[{name:myName,avatar:userAvatar||"🧙",streak:ch.myStreak,history:ch.myHistory,isMe:true},...freshParts.map(p=>({...p,isMe:false}))].sort((a,b)=>b.streak-a.streak);
  const last28=Array.from({length:28},(_,i)=>pastDay(27-i));

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <button onClick={onClose} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,background:T.bg0,border:`1px solid ${T.brd}`,color:T.sub,fontSize:13,fontWeight:600,cursor:"pointer"}}>← Назад</button>
        <div style={{fontSize:12,fontWeight:600,color:syncing?T.dim:T.teal,display:"flex",alignItems:"center",gap:5}}>
          {syncing?<>⏳ Подключение…</>:<><span style={{width:7,height:7,borderRadius:"50%",background:T.teal,display:"inline-block"}}/>в реальном времени</>}
        </div>
      </div>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:44,marginBottom:4}}>{ch.emoji}</div>
        <h3 style={{margin:0,fontSize:19,fontWeight:900,color:T.text}}>{ch.title}</h3>
        {ch.desc&&<p style={{margin:"4px 0 0",fontSize:13,color:T.sub}}>{ch.desc}</p>}
        <div style={{fontSize:12,color:T.dim,marginTop:4}}>{period}</div>
      </div>
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
      <div style={{marginBottom:16}}>
        <SectionLabel>Активность за 4 недели</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {last28.map(d=>{
            const myD=ch.myHistory.includes(d);
            const friendDs=freshParts.filter(p=>p.history&&p.history.includes(d));
            return (
              <div key={d} style={{aspectRatio:"1",borderRadius:6,position:"relative",overflow:"hidden",background:T.bg0,border:`1px solid ${T.brd}`}}>
                {myD&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:"50%",background:T.purp+"88"}}/>}
                {friendDs.length>0&&<div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:T.teal+"88"}}/>}
                {myD&&friendDs.length>0&&<div style={{position:"absolute",inset:0,background:"transparent",border:`2px solid ${T.gold}66`,borderRadius:5}}/>}
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
        <Btn
          variant={doneToday?"ghost":"primary"}
          style={{flex:2,transition:"all 0.2s",opacity:saving?0.7:1}}
          disabled={doneToday||saving}
          onClick={async()=>{
            if(doneToday||saving) return;
            setDoneToday(true); // мгновенная реакция кнопки
            setSaving(true);
            setSaveErr(false);
            await onComplete(ch.id);
            setSaving(false);
            // закрываем с небольшой задержкой — пользователь видит ✓
            setTimeout(onClose,600);
          }}
        >
          {saving?"⏳ Сохраняем…":doneToday?"✓ Сделано сегодня":"Отметить сегодня ✓"}
        </Btn>
      </div>
      <Btn variant="danger" onClick={()=>{onDelete(ch.id);onClose();}}>🗑 Удалить соревнование</Btn>
    </ModalOverlay>
  );
}

// ─── SHARED GOAL DETAIL ───────────────────────────────────────────
function SharedGoalDetail({ sg, onClose, onToggleItem, onAssign, onShare, onDelete, nickname }) {
  const myName=nickname||"Я";
  const done=sg.items.filter(x=>x.done).length, total=sg.items.length;
  const pct=total>0?done/total:0;
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
          <span style={{fontSize:13,fontWeight:700,color:T.teal}}>{done}/{total} · {Math.round(pct*100)}%</span>
        </div>
        <XPBar progress={pct} color={T.teal} height={8}/>
      </div>
      <div style={{marginBottom:16}}>
        <SectionLabel>Список ({done} из {total} выполнено)</SectionLabel>
        {sg.items.map(it=>(
          <div key={it.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px",background:it.done?T.teal+"12":T.bg0,borderRadius:11,border:`1px solid ${it.done?T.teal+"44":T.brd}`,marginBottom:8,transition:"all 0.2s"}}>
            <div onClick={()=>onToggleItem(sg.id,it.id)} style={{width:26,height:26,borderRadius:"50%",border:`2.5px solid ${it.done?T.teal:T.dim}`,background:it.done?T.teal:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:13,fontWeight:900,color:"#000",transition:"all 0.2s"}}>{it.done&&"✓"}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,color:it.done?T.sub:T.text,textDecoration:it.done?"line-through":"none"}}>{it.title}</div>
              {it.assignedTo&&<div style={{fontSize:11,color:it.done?T.teal:T.sub,marginTop:2}}>{it.done?`✓ ${it.doneBy}`:` ${it.assignedTo}`}</div>}
            </div>
            {!it.done&&!it.assignedTo&&<div onClick={()=>onAssign(sg.id,it.id,myName)} style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:T.purp+"33",color:T.purpL,border:`1px solid ${T.purp}55`,cursor:"pointer",whiteSpace:"nowrap"}}>Беру я</div>}
            {!it.done&&it.assignedTo===myName&&<div style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:T.purp+"22",color:T.purpL,border:`1px solid ${T.purp}44`}}>→ {myName}</div>}
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

// ─── CHALLENGE CARD (top-level — стабильный тип, без remount при re-render) ──
function ChallengeCard({ ch, myDisplayName, onOpen, onShare }) {
  const allParts=[{name:myDisplayName,streak:ch.myStreak,isMe:true},...(ch.participants||[])];
  const myDoneToday=ch.myHistory.includes(today());
  return (
    <div onClick={onOpen} style={{background:T.bg2,borderRadius:14,border:`1px solid ${T.brd}`,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
        <div style={{fontSize:32,width:48,height:48,borderRadius:12,background:T.purp+"22",border:`1px solid ${T.purp}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{ch.emoji}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text}}>{ch.title}</div>
          {ch.desc&&<div style={{fontSize:12,color:T.sub,marginTop:2,lineHeight:1.4}}>{ch.desc}</div>}
          <div style={{fontSize:11,color:T.dim,marginTop:3}}>{ch.recurType==="day"?"Ежедневно":ch.recurType==="week"?"Еженедельно":"Ежегодно"}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
          {myDoneToday
            ?<span style={{fontSize:11,fontWeight:700,color:T.teal,background:T.teal+"22",padding:"3px 9px",borderRadius:20}}>✓ сегодня</span>
            :<span style={{fontSize:11,color:T.rose,background:T.rose+"22",padding:"3px 9px",borderRadius:20}}>сегодня</span>}
          {ch.shareCode&&<div onClick={e=>{e.stopPropagation();onShare();}} style={{fontSize:11,color:T.sky,background:T.sky+"18",padding:"3px 9px",borderRadius:20,border:`1px solid ${T.sky}33`,cursor:"pointer",whiteSpace:"nowrap"}}>🔗 Позвать</div>}
        </div>
      </div>
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
}

// ─── GOAL CARD (top-level — стабильный тип) ───────────────────────
function GoalCard({ sg, myDisplayName, onOpen }) {
  const done=sg.items.filter(x=>x.done).length,total=sg.items.length;
  const myDone=sg.items.filter(x=>x.doneBy===myDisplayName).length;
  return (
    <div onClick={onOpen} style={{background:T.bg2,borderRadius:14,border:`1px solid ${T.brd}`,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
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
        {myDone>0&&<div style={{fontSize:11,color:T.teal,fontWeight:700}}>ты взял: {myDone} ✓</div>}
      </div>
    </div>
  );
}

// ─── SOCIAL SCREEN ────────────────────────────────────────────────
export default function SocialScreen({ challenges, sharedGoals, onUpdateCh, onUpdateSg, onDeleteCh, onDeleteSg, onCreateCh, onCreateSg, nickname, userAvatar }) {
  const [tab,setTab]=useState("challenges");
  const [showNewCh,setNewCh]=useState(false);
  const [showNewSg,setNewSg]=useState(false);
  const [showJoin,setJoin]=useState(false);
  const [detailCh,setDetailCh]=useState(null);
  const [detailSg,setDetailSg]=useState(null);
  // Всегда берём свежую версию из sharedGoals (а не снимок на момент клика),
  // чтобы отметка пункта сразу отражалась без закрытия/переоткрытия окна.
  // Всегда берём свежую версию из state (а не снимок на момент клика)
  const currentDetailCh = detailCh ? challenges.find(c => c.id === detailCh.id) ?? detailCh : null;
  const currentDetailSg = detailSg ? sharedGoals.find(s => s.id === detailSg.id) ?? detailSg : null;
  const [shareItem,setShare]=useState(null);

  const tgUserSocial=typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user;
  const myDisplayName=nickname||tgUserSocial?.first_name||"Ты";
  const myTgId=tgUserSocial?.id?String(tgUserSocial.id):null;

  // Ключ зависимости — список id. Переподписываемся только при добавлении/удалении соревнований.
  const challengeKeys=challenges.map(c=>c.id).join(",");
  useEffect(()=>{
    const active=challenges.filter(ch=>ch.shareCode);
    if(active.length===0) return;
    // onSnapshot: Firestore сам присылает обновления — теперь и в списке карточек, не только в деталях
    const unsubs=active.map(ch=>
      cloudSubscribeParticipants(ch.shareCode,(parts)=>{
        const others=myTgId
          ?parts.filter(p=>p.tgId?p.tgId!==myTgId:p.name!==myDisplayName)
          :parts.filter(p=>p.name!==myDisplayName);
        onUpdateCh(ch.id,c=>({...c,participants:others}));
      })
    );
    return ()=>unsubs.forEach(unsub=>unsub());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[challengeKeys]);

  const completeCh=async(id)=>{
    let prevCh=null;
    // 1. Сразу обновляем локальный стейт — UI реагирует мгновенно
    onUpdateCh(id,ch=>{
      if(ch.myHistory.includes(today())) return ch;
      prevCh=ch; // запоминаем для отката
      const newHistory=[...(ch.myHistory),today()];
      let streak=0;
      const sorted=[...newHistory].sort();
      if(sorted[sorted.length-1]===today()){
        let cur=today();streak=1;
        while(true){const d=new Date(cur);d.setDate(d.getDate()-1);const prev=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;if(sorted.includes(prev)){streak++;cur=prev;}else break;}
      }
      // 2. Синкаем с облаком в фоне, не блокируя UI
      if(ch.shareCode){
        cloudUpdateMyProgress(ch.shareCode,myDisplayName,streak,newHistory,myTgId,userAvatar)
          .then(ok=>{
            if(!ok&&prevCh) onUpdateCh(id,()=>prevCh); // 3. Откат при ошибке
          });
      }
      return {...ch,myHistory:newHistory,myStreak:streak};
    });
  };

  const joinCh=chData=>{
    const exists=challenges.find(c=>c.id===chData.id||c.shareCode===chData.shareCode);
    if(exists) onUpdateCh(chData.id,ch=>({...ch,joined:true,_myName:myDisplayName}));
    else onCreateCh({...chData,myStreak:0,myHistory:[],joined:true,_myName:myDisplayName});
  };
  const joinSg=sgData=>{
    const exists=sharedGoals.find(s=>s.id===sgData.id||s.shareCode===sgData.shareCode);
    if(exists) onUpdateSg(sgData.id,sg=>({...sg,participants:[...new Set([...sg.participants,myDisplayName])]}));
    else onCreateSg({...sgData,participants:[...new Set([...(sgData.participants||[]),myDisplayName])]});
  };

  const toggleSgItem=(sgId,itemId)=>onUpdateSg(sgId,sg=>({...sg,items:sg.items.map(it=>it.id!==itemId?it:{...it,done:!it.done,doneBy:!it.done?myDisplayName:null})}));
  const assignSgItem=(sgId,itemId,name)=>onUpdateSg(sgId,sg=>({...sg,items:sg.items.map(it=>it.id!==itemId?it:{...it,assignedTo:name})}));


  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 16px 8px",flexShrink:0}}>
        <div style={{display:"flex",background:T.bg2,borderRadius:13,padding:4,border:`1px solid ${T.brd}`,gap:4}}>
          {[["challenges","🏆 Соревнования"],["goals","🎯 Общие цели"]].map(([id,label])=>(
            <div key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px 0",borderRadius:9,cursor:"pointer",textAlign:"center",fontSize:13,fontWeight:700,background:tab===id?T.purp:"transparent",color:tab===id?"#fff":T.sub,transition:"all 0.2s"}}>{label}</div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:8,padding:"0 16px 10px",flexShrink:0}}>
        <div onClick={()=>tab==="challenges"?setNewCh(true):setNewSg(true)} style={{flex:1,padding:"9px 0",borderRadius:11,background:`linear-gradient(135deg,${T.purp},${T.gold})`,color:"#fff",fontWeight:700,fontSize:13,textAlign:"center",cursor:"pointer"}}>+ {tab==="challenges"?"Создать":"Новая цель"}</div>
        <div onClick={()=>setJoin(true)} style={{padding:"9px 14px",borderRadius:11,background:T.sky+"22",color:T.sky,fontWeight:700,fontSize:13,border:`1px solid ${T.sky}44`,cursor:"pointer",whiteSpace:"nowrap"}}>🔗 Войти</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"0 16px",WebkitOverflowScrolling:"touch"}}>
        {tab==="challenges"&&(challenges.length===0?<div style={{textAlign:"center",padding:"48px 0",color:T.dim}}><div style={{fontSize:44,marginBottom:12}}>🏆</div><div style={{fontSize:15,fontWeight:600,color:T.sub}}>Нет соревнований</div><div style={{fontSize:13,marginTop:6}}>Создай серию и поделись с другом</div></div>:challenges.map(ch=><ChallengeCard key={ch.id} ch={ch} myDisplayName={myDisplayName} onOpen={()=>setDetailCh(ch)} onShare={()=>setShare({code:ch.shareCode,title:ch.title})}/>))}
        {tab==="goals"&&(sharedGoals.length===0?<div style={{textAlign:"center",padding:"48px 0",color:T.dim}}><div style={{fontSize:44,marginBottom:12}}>🎯</div><div style={{fontSize:15,fontWeight:600,color:T.sub}}>Нет общих целей</div><div style={{fontSize:13,marginTop:6}}>Поделись списком задач с другом</div></div>:sharedGoals.map(sg=><GoalCard key={sg.id} sg={sg} myDisplayName={myDisplayName} onOpen={()=>setDetailSg(sg)}/>))}
        <div style={{height:20}}/>
      </div>
      {showNewCh&&<NewChallengeModal onClose={()=>setNewCh(false)} onCreate={ch=>{onCreateCh(ch);setNewCh(false);}} nickname={nickname}/>}
      {showNewSg&&<NewSharedGoalModal onClose={()=>setNewSg(false)} onCreate={sg=>{onCreateSg(sg);setNewSg(false);}} nickname={nickname}/>}
      {showJoin&&<JoinModal challenges={challenges} sharedGoals={sharedGoals} onClose={()=>setJoin(false)} onJoinCh={joinCh} onJoinSg={joinSg} nickname={nickname} userAvatar={userAvatar}/>}
      {shareItem&&<ShareSheet code={shareItem.code} title={shareItem.title} onClose={()=>setShare(null)}/>}
      {currentDetailCh&&<ChallengeDetail ch={currentDetailCh} onClose={()=>setDetailCh(null)} nickname={nickname} userAvatar={userAvatar} onComplete={completeCh} onShare={()=>{setShare({code:currentDetailCh.shareCode,title:currentDetailCh.title});setDetailCh(null);}} onDelete={id=>{onDeleteCh(id);setDetailCh(null);}}/>}
      {currentDetailSg&&<SharedGoalDetail sg={currentDetailSg} onClose={()=>setDetailSg(null)} nickname={nickname} onToggleItem={toggleSgItem} onAssign={assignSgItem} onShare={()=>{setShare({code:currentDetailSg.shareCode,title:currentDetailSg.title});setDetailSg(null);}} onDelete={id=>{onDeleteSg(id);setDetailSg(null);}}/>}
    </div>
  );
}
