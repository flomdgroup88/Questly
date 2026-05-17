import { useState } from "react";
import { T } from "../theme.js";
import { PERIODS, PRIORITIES } from "../constants.js";
import { fmtDate, today, daysLeft } from "../utils";
import { PeriodBadge } from "./ui.jsx";

export default function TaskCard({ task, onToggle, onEdit, onShopToggle }) {
  const p=PERIODS.find(x=>x.id===task.period);
  const pr=PRIORITIES.find(x=>x.id===(task.priority??"normal"))||PRIORITIES[0];
  const [flash,setFlash]=useState(false);
  const [shopOpen,setShopOpen]=useState(false);

  const handleCheck=e=>{
    e.stopPropagation();
    if(!task.done){setFlash(true);setTimeout(()=>setFlash(false),600);}
    onToggle(task.id);
  };

  const hasShop=task.shopItems&&task.shopItems.length>0;
  const shopDone=hasShop?task.shopItems.filter(i=>i.done).length:0;
  const hasStripe=pr.id!=="normal";

  return (
    <div style={{marginBottom:8}}>
      <div onClick={onEdit} style={{
        background:flash?p.accent+"22":task.done?T.bg2+"88":T.bg2,
        border:`1px solid ${task.done?T.brdDim:task.rolledOver?"#F5A62355":T.brd}`,
        borderRadius:shopOpen?"13px 13px 0 0":13,padding:"13px 14px",
        display:"flex",alignItems:"center",gap:12,
        transition:"all 0.3s ease",opacity:task.done?0.6:1,cursor:"pointer",
        position:"relative",overflow:"hidden",
      }}>
        {/* Priority stripe */}
        {hasStripe&&!task.done&&(
          <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:pr.stripe,borderRadius:"13px 0 0 13px",transition:"opacity 0.2s"}}/>
        )}
        <div onClick={handleCheck} style={{
          width:30,height:30,borderRadius:"50%",
          border:`2.5px solid ${task.done?p.accent:T.dim}`,
          background:task.done?p.accent:"transparent",
          cursor:"pointer",flexShrink:0,
          display:"flex",alignItems:"center",justifyContent:"center",
          transition:"all 0.25s cubic-bezier(.34,1.56,.64,1)",
          boxShadow:task.done?`0 0 10px ${p.accent}66`:"none",
          marginLeft:hasStripe&&!task.done?4:0,
        }}>
          {task.done&&<span style={{fontSize:15,color:"#000",fontWeight:900}}>✓</span>}
        </div>

        <div style={{flex:1,minWidth:0}}>
          <div style={{
            fontSize:15,fontWeight:500,
            color:task.done?T.sub:T.text,
            textDecoration:task.done?"line-through":"none",
            wordBreak:"break-word",marginBottom:5,
          }}>{task.title}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <PeriodBadge period={task.period} small/>
            <span style={{fontSize:11,color:T.gold,fontWeight:700}}>+{task.xp} XP</span>
            {hasStripe&&!task.done&&(
              <span style={{fontSize:10,fontWeight:800,color:pr.stripe,background:pr.stripe+"22",border:`1px solid ${pr.stripe}44`,padding:"1px 7px",borderRadius:20}}>{pr.icon} {pr.label}</span>
            )}
            {task.recurring&&<span style={{fontSize:10,color:T.dim}}>🔄</span>}
            {task.streakEnabled&&task.streak>0&&(
              <span style={{fontSize:11,fontWeight:800,color:"#FF6B35",background:"#FF6B3522",border:"1px solid #FF6B3544",padding:"1px 7px",borderRadius:20,display:"flex",alignItems:"center",gap:3}}>🔥 {task.streak}</span>
            )}
            {task.streakEnabled&&task.streak===0&&!task.done&&(
              <span style={{fontSize:10,color:T.dim,fontWeight:600}}>🔥 серия</span>
            )}
            {task.rolledOver&&!task.done&&<span style={{fontSize:10,color:T.gold,fontWeight:600}}>↩ перенесено</span>}
            {task.dueDate&&task.dueDate!==today()&&task.period==="day"&&(
              <span style={{fontSize:10,color:T.sub}}>📅 {fmtDate(task.dueDate)}</span>
            )}
            {task.dueDate&&task.period!=="day"&&!task.done&&(
              <span style={{fontSize:10,color:daysLeft(task.dueDate)==="просрочено"?T.rose:T.sub}}>
                ⏳ {daysLeft(task.dueDate)}
              </span>
            )}
            {hasShop&&(
              <span style={{fontSize:11,fontWeight:700,color:T.purpL,background:T.purp+"22",border:`1px solid ${T.purp}44`,padding:"1px 7px",borderRadius:20}}>
                {task.checklistIcon||"🛒"} {shopDone}/{task.shopItems.length}
              </span>
            )}
          </div>
          {task.note&&!task.done&&(
            <div style={{
              fontSize:12,color:T.sub,marginTop:5,lineHeight:1.45,
              display:"-webkit-box",WebkitLineClamp:2,
              WebkitBoxOrient:"vertical",overflow:"hidden",
            }}>📝 {task.note}</div>
          )}
        </div>

        {hasShop?(
          <div onClick={e=>{e.stopPropagation();setShopOpen(v=>!v);}} style={{
            width:28,height:28,borderRadius:8,flexShrink:0,
            display:"flex",alignItems:"center",justifyContent:"center",
            background:shopOpen?T.purp+"33":T.bg3,
            border:`1px solid ${shopOpen?T.purp+"66":T.brd}`,
            color:shopOpen?T.purpL:T.dim,fontSize:14,cursor:"pointer",transition:"all 0.2s",
          }}>{shopOpen?"▲":"▼"}</div>
        ):(
          <span style={{color:T.dim,fontSize:18,flexShrink:0}}>›</span>
        )}
      </div>

      {hasShop&&shopOpen&&(
        <div style={{
          background:T.bg1,border:`1px solid ${T.brd}`,
          borderTop:`1px solid ${T.brd}`,
          borderRadius:"0 0 13px 13px",padding:"10px 14px 12px",
        }}>
          <div style={{fontSize:11,color:T.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
            {task.checklistIcon||"🛒"} {task.checklistName||"Список"} — {shopDone} из {task.shopItems.length}
          </div>
          <div style={{height:4,background:T.brd,borderRadius:2,overflow:"hidden",marginBottom:10}}>
            <div style={{height:"100%",borderRadius:2,width:`${task.shopItems.length>0?Math.round(shopDone/task.shopItems.length*100):0}%`,background:`linear-gradient(90deg,${T.purp},${T.teal})`,transition:"width 0.4s ease"}}/>
          </div>
          {task.shopItems.map((it,i)=>(
            <div key={it.id} onClick={e=>{e.stopPropagation();onShopToggle&&onShopToggle(task.id,it.id);}}
              style={{
                display:"flex",alignItems:"center",gap:10,
                padding:"9px 10px",borderRadius:9,cursor:"pointer",
                background:it.done?T.teal+"12":T.bg0,
                border:`1px solid ${it.done?T.teal+"44":T.brdDim}`,
                marginBottom:i<task.shopItems.length-1?6:0,transition:"all 0.2s",
              }}>
              <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,border:`2px solid ${it.done?T.teal:T.dim}`,background:it.done?T.teal:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#000",fontWeight:900,transition:"all 0.2s"}}>{it.done&&"✓"}</div>
              <span style={{fontSize:14,flex:1,color:it.done?T.sub:T.text,textDecoration:it.done?"line-through":"none"}}>{it.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
