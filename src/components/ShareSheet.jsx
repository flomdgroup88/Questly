import { useState } from "react";
import { T } from "../theme.js";
import { ModalOverlay, Btn } from "./ui.jsx";

const tg = typeof window !== "undefined" && window.Telegram?.WebApp;

export default function ShareSheet({ code, title, onClose }) {
  const [copied,setCopied]=useState(false);
  const link=`https://t.me/questlytaskbot?start=${code}`;
  const shareText=`Присоединяйся к квесту «${title}»! Код: ${code}`;

  const copy=()=>{
    navigator.clipboard?.writeText(link).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false),2000);
  };

  // Web Share API — нативный диалог (работает и в Telegram WebApp)
  const nativeShare=async()=>{
    try{
      await navigator.share({title:`Квест: ${title}`,text:shareText,url:link});
      onClose();
    }catch(e){
      if(e?.name!=="AbortError") copy(); // fallback на копирование
    }
  };

  // Telegram-нативный шаринг — открывает диалог отправки сообщения
  const tgShare=()=>{
    if(tg?.openTelegramLink){
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`);
    }else if(tg?.switchInlineQuery){
      tg.switchInlineQuery(shareText,["users","groups"]);
    }
    onClose();
  };

  const canNativeShare=typeof navigator!=="undefined"&&!!navigator.share;

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
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {tg
          ?<Btn variant="primary" onClick={tgShare}>✈️ Отправить в Telegram</Btn>
          :canNativeShare
            ?<Btn variant="primary" onClick={nativeShare}>↗ Поделиться</Btn>
            :<Btn variant="teal" onClick={copy}>{copied?"✓ Скопировано!":"📋 Скопировать ссылку"}</Btn>
        }
        {(tg||canNativeShare)&&(
          <Btn variant="ghost" onClick={copy}>{copied?"✓ Скопировано!":"📋 Скопировать ссылку"}</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Закрыть</Btn>
      </div>
    </ModalOverlay>
  );
}
