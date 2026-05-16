import { useState, useEffect } from "react";
import { T } from "../theme.js";
import { PERIODS } from "../constants.js";

// ─── TOGGLE ───────────────────────────────────────────────────────
export function Toggle({ value, onChange }) {
  return (
    <div onClick={e=>{e.stopPropagation();onChange(!value);}} style={{
      width:44,height:24,borderRadius:12,cursor:"pointer",
      background:value?T.purp:T.dim,position:"relative",transition:"background 0.25s",flexShrink:0,
    }}>
      <div style={{
        position:"absolute",top:3,left:value?23:3,
        width:18,height:18,borderRadius:"50%",background:"#fff",
        transition:"left 0.2s cubic-bezier(.34,1.56,.64,1)",
        boxShadow:"0 1px 4px rgba(0,0,0,0.4)",
      }}/>
    </div>
  );
}

// ─── XP BAR ───────────────────────────────────────────────────────
export function XPBar({ progress, color=T.purp, height=8 }) {
  return (
    <div style={{height,background:T.brd,borderRadius:height/2,overflow:"hidden"}}>
      <div style={{
        height:"100%",borderRadius:height/2,
        width:`${Math.round(Math.min(progress,1)*100)}%`,
        background:`linear-gradient(90deg,${color},${T.gold})`,
        transition:"width 0.9s cubic-bezier(.34,1.56,.64,1)",
      }}/>
    </div>
  );
}

// ─── PERIOD BADGE ─────────────────────────────────────────────────
export function PeriodBadge({ period, small }) {
  const p=PERIODS.find(x=>x.id===period);
  return (
    <span style={{
      fontSize:small?10:11,fontWeight:600,
      padding:small?"1px 6px":"2px 8px",borderRadius:20,
      background:p.accent+"22",color:p.accent,
      border:`1px solid ${p.accent}44`,letterSpacing:"0.03em",whiteSpace:"nowrap",
    }}>{p.icon} {p.label}</span>
  );
}

// ─── MODAL OVERLAY ────────────────────────────────────────────────
export function ModalOverlay({ onClose, children }) {
  useEffect(()=>{document.body.style.overflow="hidden";return()=>{document.body.style.overflow="";};}, []);
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:100,
      background:"rgba(4,4,20,0.88)",backdropFilter:"blur(6px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center",
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:T.bg1,borderRadius:"20px 20px 0 0",
        padding:"8px 16px calc(36px + env(safe-area-inset-bottom,0px))",
        width:"100%",maxWidth:420,
        border:`1px solid ${T.brd}`,borderBottom:"none",
        animation:"slideUp 0.32s cubic-bezier(.34,1.56,.64,1)",
        maxHeight:"90vh",overflowY:"auto",
        position:"relative",
      }}>
        <div style={{width:40,height:4,borderRadius:2,background:T.brd,margin:"8px auto 16px"}}/>
        <div onClick={onClose} style={{
          position:"absolute",top:14,right:14,
          width:32,height:32,borderRadius:"50%",
          background:T.bg3,border:`1px solid ${T.brd}`,
          display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",fontSize:18,color:T.sub,fontWeight:400,
          lineHeight:1,zIndex:10,flexShrink:0,
          transition:"background 0.15s, color 0.15s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.background=T.rose+"33";e.currentTarget.style.color=T.rose;}}
        onMouseLeave={e=>{e.currentTarget.style.background=T.bg3;e.currentTarget.style.color=T.sub;}}
        >×</div>
        {children}
      </div>
    </div>
  );
}

// ─── SECTION LABEL ────────────────────────────────────────────────
export function SectionLabel({ children }) {
  return <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:8}}>{children}</div>;
}

// ─── BTN ──────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant="primary", style:s={}, disabled=false }) {
  const base={padding:"12px 16px",borderRadius:12,cursor:disabled?"not-allowed":"pointer",fontSize:14,fontWeight:700,border:"none",width:"100%",opacity:disabled?0.45:1,transition:"opacity 0.15s"};
  const v={
    primary:{background:`linear-gradient(135deg,${T.purp},${T.gold})`,color:"#fff"},
    teal:   {background:`linear-gradient(135deg,${T.teal},${T.sky})`,color:"#04202F"},
    ghost:  {background:"transparent",border:`1px solid ${T.brd}`,color:T.sub},
    danger: {background:T.rose+"22",border:`1px solid ${T.rose}55`,color:T.rose},
  };
  return <button onClick={disabled?undefined:onClick} style={{...base,...v[variant],...s}}>{children}</button>;
}

// ─── STYLED INPUT ─────────────────────────────────────────────────
export function StyledInput({ value, onChange, placeholder, type="text", autoFocus, onKeyDown }) {
  const [focused,setFocused]=useState(false);
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      autoFocus={autoFocus} onKeyDown={onKeyDown}
      onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
      style={{
        width:"100%",padding:"11px 14px",background:T.bg0,
        border:`1px solid ${focused?T.purp:T.brd}`,borderRadius:11,
        color:T.text,fontSize:15,outline:"none",
        transition:"border-color 0.15s",colorScheme:"dark",
      }}/>
  );
}

// ─── RECUR PICKER ─────────────────────────────────────────────────
export function RecurPicker({ value, onChange, accentC=T.purp, accentL=T.purpL }) {
  return (
    <div style={{display:"flex",gap:8}}>
      {[["day","Ежедневно"],["week","Еженедельно"],["month","Ежемесячно"],["year","Ежегодно"]].map(([rt,lbl])=>(
        <div key={rt} onClick={()=>onChange(rt)} style={{
          flex:1,padding:"8px 4px",borderRadius:9,cursor:"pointer",
          textAlign:"center",fontSize:12,fontWeight:600,
          border:`1px solid ${value===rt?accentC:T.brd}`,
          background:value===rt?accentC+"33":T.bg0,
          color:value===rt?accentL:T.sub,transition:"all 0.15s",
        }}>{lbl}</div>
      ))}
    </div>
  );
}
