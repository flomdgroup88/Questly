import { useState } from "react";
import { T } from "../theme.js";
import { PERIODS, RANKS, RANK_ICONS, XP_TABLE } from "../constants.js";
import { lvlOf, progOf, nextXP } from "../utils.js";
import { XPBar } from "../components/ui.jsx";

export default function ProfileScreen({ xp, tasks, events, nickname, onSetNickname }) {
  const level=lvlOf(xp), rank=RANKS[Math.min(level-1,RANKS.length-1)];
  const rankIcon=RANK_ICONS[Math.min(level-1,RANK_ICONS.length-1)];
  const toNext=nextXP(xp), completed=tasks.filter(t=>t.done).length, total=tasks.length;
  const [showLevelTable,setShowLevelTable]=useState(false);
  const [editingNick,setEditingNick]=useState(false);
  const [nickDraft,setNickDraft]=useState(nickname||"");

  const tgName=typeof window!=="undefined"&&window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name;
  const displayName=nickname||tgName||"Герой";

  const saveNick=()=>{onSetNickname(nickDraft.trim());setEditingNick(false);};

  const bestStreak=Math.max(0,...tasks.filter(t=>t.streakEnabled).map(t=>t.streak||0));
  const hasShopTask=tasks.some(t=>t.shopItems&&t.shopItems.length>0);
  const shopItemsDone=tasks.reduce((acc,t)=>acc+(t.shopItems?t.shopItems.filter(i=>i.done).length:0),0);
  const allPeriodsCovered=["day","week","month","year"].every(p=>tasks.some(t=>t.period===p));

  const ACHIEVEMENTS=[
    {icon:"⚡",label:"Первый шаг",       desc:"Выполни 1 задачу",          done:completed>=1,  cat:"tasks"},
    {icon:"🔥",label:"На волне",         desc:"Выполни 5 задач",            done:completed>=5,  cat:"tasks"},
    {icon:"💪",label:"В ритме",          desc:"Выполни 25 задач",           done:completed>=25, cat:"tasks"},
    {icon:"🏆",label:"Сотня",            desc:"Выполни 100 задач",          done:completed>=100,cat:"tasks"},
    {icon:"🌟",label:"Мастер квестов",   desc:"Выполни 500 задач",          done:completed>=500,cat:"tasks"},
    {icon:"💎",label:"Целеустремлён",    desc:"Создай 10 задач",            done:total>=10,     cat:"tasks"},
    {icon:"📦",label:"Архив квестов",    desc:"Создай 50 задач",            done:total>=50,     cat:"tasks"},
    {icon:"👑",label:"Годовой план",     desc:"Добавь годовую цель",        done:tasks.some(t=>t.period==="year"),  cat:"period"},
    {icon:"🌊",label:"Неделя",          desc:"Добавь еженедельную цель",   done:tasks.some(t=>t.period==="week"),  cat:"period"},
    {icon:"💫",label:"Месяц",           desc:"Добавь ежемесячную цель",    done:tasks.some(t=>t.period==="month"), cat:"period"},
    {icon:"🗓️",label:"Всё охвачено",   desc:"Добавь цели на все периоды", done:allPeriodsCovered,                 cat:"period"},
    {icon:"🔥",label:"Серийщик",        desc:"Серия 7 дней подряд",        done:bestStreak>=7,   cat:"streak"},
    {icon:"💪",label:"Стойкий",         desc:"Серия 30 дней подряд",       done:bestStreak>=30,  cat:"streak"},
    {icon:"🔮",label:"Легенда серии",   desc:"Серия 100 дней подряд",      done:bestStreak>=100, cat:"streak"},
    {icon:"♾️",label:"Вечный огонь",   desc:"Серия 365 дней подряд",      done:bestStreak>=365, cat:"streak"},
    {icon:"⭐",label:"Посвящённый",     desc:"Достигни 5 уровня",          done:level>=5,  cat:"level"},
    {icon:"🌟",label:"Искушённый",      desc:"Достигни 10 уровня",         done:level>=10, cat:"level"},
    {icon:"💫",label:"Избранный",       desc:"Достигни 20 уровня",         done:level>=20, cat:"level"},
    {icon:"🔮",label:"Архимаг",         desc:"Достигни 40 уровня",         done:level>=40, cat:"level"},
    {icon:"👑",label:"Легенда",         desc:"Достигни 60 уровня",         done:level>=60, cat:"level"},
    {icon:"⚡",label:"Запредельный",    desc:"Достигни 80 уровня",         done:level>=80, cat:"level"},
    {icon:"🔄",label:"Привычка",        desc:"Создай повторяемую задачу",  done:tasks.some(t=>t.recurring), cat:"habit"},
    {icon:"📋",label:"Оптовик",         desc:"Используй режим «Список»",   done:tasks.filter(t=>!t.recurring).length>=5&&total>=5, cat:"habit"},
    {icon:"🛒",label:"Шопоголик",       desc:"Создай список покупок",      done:hasShopTask,     cat:"habit"},
    {icon:"🧺",label:"Закупился",       desc:"Отметь 10 покупок",          done:shopItemsDone>=10,cat:"habit"},
    {icon:"🎂",label:"Не забуду",       desc:"Добавь день рождения",       done:events.some(e=>e.isBirthday),  cat:"events"},
    {icon:"📅",label:"Организатор",     desc:"Добавь 5 событий",           done:events.length>=5,               cat:"events"},
    {icon:"🗺️",label:"Путешественник", desc:"Добавь событие «Поездка»",   done:events.some(e=>e.eventType==="trip"), cat:"events"},
    {icon:"⏰",label:"Дедлайнер",       desc:"Добавь событие «Дедлайн»",   done:events.some(e=>e.eventType==="deadline"), cat:"events"},
    {icon:"🎉",label:"Праздник!",       desc:"Добавь событие «Праздник»",  done:events.some(e=>e.eventType==="holiday"), cat:"events"},
    {icon:"📅",label:"Хронист",         desc:"Добавь 20 событий",          done:events.length>=20, cat:"events"},
  ];

  const doneCount=ACHIEVEMENTS.filter(a=>a.done).length;

  const MILESTONE_LEVELS=[1,2,3,5,10,15,20,30,40,50,60,70,80];
  const tableRows=[...new Set([...MILESTONE_LEVELS,level,level+1,level+2])].filter(l=>l>=1&&l<=80).sort((a,b)=>a-b);
  const fmtXP=n=>n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(0)+"K":n;

  return (
    <div style={{flex:1,overflowY:"auto",padding:"14px 16px",WebkitOverflowScrolling:"touch"}}>
      {/* Character card */}
      <div style={{background:`linear-gradient(145deg,${T.bg2},${T.bg3})`,border:`1px solid ${T.brd}`,borderRadius:20,padding:"20px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:T.purp+"22",filter:"blur(30px)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-20,left:-20,width:80,height:80,borderRadius:"50%",background:T.gold+"22",filter:"blur(20px)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
          <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${T.purpDim},${T.bg3})`,border:`2px solid ${T.purp}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,boxShadow:`0 0 20px ${T.purp}44`}}>{rankIcon}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Уровень {level} / 80</div>
            {editingNick?(
              <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4,marginBottom:4}}>
                <input autoFocus value={nickDraft} onChange={e=>setNickDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")saveNick();if(e.key==="Escape")setEditingNick(false);}}
                  placeholder="Введи ник…" maxLength={24}
                  style={{flex:1,padding:"6px 10px",background:T.bg0,border:`1px solid ${T.purp}`,borderRadius:9,color:T.text,fontSize:16,fontWeight:800,outline:"none",colorScheme:"dark"}}/>
                <div onClick={saveNick} style={{padding:"6px 12px",borderRadius:9,cursor:"pointer",background:T.purp,color:"#fff",fontSize:13,fontWeight:700,flexShrink:0}}>✓</div>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={()=>{setNickDraft(nickname||"");setEditingNick(true);}}>
                <div style={{fontSize:22,fontWeight:900,color:T.text,lineHeight:1.1}}>{displayName}</div>
                <div style={{fontSize:12,color:T.sub,background:T.bg3,border:`1px solid ${T.brd}`,borderRadius:6,padding:"2px 7px",flexShrink:0}}>✏️</div>
              </div>
            )}
            <div style={{fontSize:14,color:T.purpL,fontWeight:600}}>{rank}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:24,fontWeight:900,color:T.gold,lineHeight:1}}>{xp.toLocaleString()}</div>
            <div style={{fontSize:11,color:T.goldDim}}>очков опыта</div>
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:12,color:T.sub}}>До уровня {level<80?level+1:"MAX"}</span>
            <span style={{fontSize:12,color:T.gold,fontWeight:700}}>{toNext>0?`ещё ${toNext.toLocaleString()} XP`:"Максимум! 👑"}</span>
          </div>
          <XPBar progress={progOf(xp)} color={T.purp} height={10}/>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[
          {label:"Выполнено",     value:completed,                          icon:"✅",color:T.teal},
          {label:"Всего квестов", value:total,                              icon:"📜",color:T.sky},
          {label:"Событий",       value:events.length,                      icon:"📅",color:T.purpL},
          {label:"Лучшая серия",  value:bestStreak>0?`${bestStreak} 🔥`:"—",icon:"🏆",color:"#FF6B35"},
        ].map(s=>(
          <div key={s.label} style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:13,padding:"14px 16px"}}>
            <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:26,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:12,color:T.sub,marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* By period */}
      <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>📊 Выполнено по периодам</div>
        {PERIODS.map(p=>{
          const cnt=tasks.filter(t=>t.period===p.id&&t.done).length;
          const tot=tasks.filter(t=>t.period===p.id).length;
          return (
            <div key={p.id} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:13,color:p.accent}}>{p.icon} {p.label}</span>
                <span style={{fontSize:12,color:T.sub}}>{cnt}/{tot}</span>
              </div>
              <XPBar progress={tot>0?cnt/tot:0} color={p.accent} height={5}/>
            </div>
          );
        })}
      </div>

      {/* Achievements */}
      <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>🏆 Достижения</div>
          <div style={{fontSize:12,color:T.gold,fontWeight:700}}>{doneCount}/{ACHIEVEMENTS.length}</div>
        </div>
        <XPBar progress={doneCount/ACHIEVEMENTS.length} color={T.gold} height={4}/>
        <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {ACHIEVEMENTS.map(a=>(
            <div key={a.label} style={{background:a.done?T.gold+"22":T.bg0,border:`1px solid ${a.done?T.gold+"66":T.brd}`,borderRadius:11,padding:"12px",transition:"all 0.3s"}}>
              <div style={{fontSize:22,marginBottom:4,filter:a.done?"none":"grayscale(0.8) opacity(0.4)"}}>{a.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:a.done?T.gold:T.sub}}>{a.label}</div>
              <div style={{fontSize:10,color:a.done?T.goldDim:T.dim,marginTop:3,lineHeight:1.4}}>{a.desc}</div>
              {!a.done&&<div style={{fontSize:9,color:T.dim,marginTop:4,fontWeight:600,letterSpacing:"0.04em"}}>🔒 не открыто</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Level table */}
      <div style={{background:T.bg2,border:`1px solid ${T.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,cursor:"pointer"}} onClick={()=>setShowLevelTable(v=>!v)}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>📈 Таблица уровней (80)</div>
          <div style={{fontSize:11,color:T.purpL,fontWeight:700,background:T.purp+"22",border:`1px solid ${T.purp}44`,padding:"3px 10px",borderRadius:20}}>{showLevelTable?"▲ Свернуть":"▼ Показать"}</div>
        </div>
        {showLevelTable&&(
          <>
            <div style={{fontSize:11,color:T.sub,marginBottom:10,lineHeight:1.5}}>Ранние уровни достигаются быстро. С каждым уровнем требования растут — уровень 80 потребует миллионы XP.</div>
            <div style={{display:"grid",gridTemplateColumns:"36px 1fr 80px 60px",gap:"0 8px",fontSize:11}}>
              {["Ур.","Ранг","Нужно XP","Всего"].map(h=>(
                <div key={h} style={{color:T.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",padding:"4px 0",borderBottom:`1px solid ${T.brd}`,marginBottom:4}}>{h}</div>
              ))}
              {tableRows.map(l=>{
                const isCurrent=l===level;
                const isReached=xp>=(XP_TABLE[l-1]??0);
                const needed=l===1?0:(XP_TABLE[l-1]??0)-(XP_TABLE[l-2]??0);
                const total_=XP_TABLE[l-1]??0;
                return [
                  <div key={`l${l}`} style={{color:isCurrent?T.gold:isReached?T.teal:T.sub,fontWeight:isCurrent?900:600,padding:"5px 0",borderBottom:`1px solid ${T.brdDim}`,display:"flex",alignItems:"center",gap:3}}>{isCurrent?"▶":""}{l}</div>,
                  <div key={`r${l}`} style={{color:isCurrent?T.gold:isReached?T.text:T.dim,fontWeight:isCurrent?800:400,padding:"5px 0",borderBottom:`1px solid ${T.brdDim}`,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{RANK_ICONS[Math.min(l-1,79)]} {RANKS[Math.min(l-1,79)]}</div>,
                  <div key={`n${l}`} style={{color:isCurrent?T.purpL:isReached?T.sub:T.dim,padding:"5px 0",borderBottom:`1px solid ${T.brdDim}`,textAlign:"right"}}>{l===1?"—":"+"+fmtXP(needed)}</div>,
                  <div key={`t${l}`} style={{color:isCurrent?T.gold:isReached?T.teal:T.dim,fontWeight:isCurrent?800:400,padding:"5px 0",borderBottom:`1px solid ${T.brdDim}`,textAlign:"right"}}>{l===1?"0":fmtXP(total_)}</div>,
                ];
              })}
            </div>
            <div style={{marginTop:12,fontSize:11,color:T.dim,textAlign:"center"}}>Уровень 80 требует {(XP_TABLE[79]/1000000).toFixed(1)}M XP — ~{Math.round(XP_TABLE[79]/15).toLocaleString()} ежедневных задач</div>
          </>
        )}
      </div>
      <div style={{height:20}}/>
    </div>
  );
}
