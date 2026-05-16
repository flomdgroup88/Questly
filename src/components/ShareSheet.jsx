import { useState } from "react";
import { T } from "../theme.js";
import { ModalOverlay, Btn } from "./ui.jsx";

const tg = typeof window !== "undefined" && window.Telegram?.WebApp;

export default function ShareSheet({ code, title, onClose }) {
  const [copied,setCopied]=useState(false);
  const link=`https://t.me/questlytaskbot?start=${code}`;
  const copy=()=>{navigator.clipboard?.writeText(link).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),2000);};
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:40,marginBottom:8}}>🔗</div>
        <h3 style={{margin:0,fontSize:18,fontWeight:800,color:T.teal}}>Поделиться</h3>
        <p style={{margin:"6px 0 0",fontSize:13,color:T.sub}}>«{title}»</p>
      </div>
      <div style={{background:T.bg0,borderRadius:12,padding:"14px 16px",marginBottom:14,border:`1px solid ${T.brd}`}}>
        <div style={{fontSize:11,color:T.sub,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Код для друга</div>
        <div style={{fontSize:28,fontWeight:900,color:T.gold,letterSpacing:"0.15em",textAlign:"center"}}>{code}</div>
      </div>
      <div style={{background:T.bg0,borderRadius:12,padding:"12px 14px",marginBottom:16,border:`1px solid ${T.brd}`,wordBreak:"break-all",fontSize:12,color:T.sub}}>{link}</div>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onClose} style={{flex:1}}>Закрыть</Btn>
        <Btn variant="teal" onClick={copy} style={{flex:2}}>{copied?"✓ Скопировано!":"📋 Скопировать ссылку"}</Btn>
      </div>
      {tg&&<div style={{marginTop:10}}><Btn variant="primary" onClick={()=>{tg.switchInlineQuery&&tg.switchInlineQuery(`Присоединяйся к квесту «${title}» — код: ${code}`,["users","groups"]);onClose();}}>✈️ Отправить в Telegram</Btn></div>}
    </ModalOverlay>
  );
}
