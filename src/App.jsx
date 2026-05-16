import { useState, useEffect, useCallback, useRef } from "react";
import { cloudSave, initUserSync, cloudSaveUserData, cloudLoadUserData } from "./firebase.js";
import OverviewScreen from "./OverviewScreen.jsx";
import { T } from "./theme.js";
import { RANKS, RANK_ICONS } from "./constants.js";
import {
  lvlOf, progOf, today,
  loadState, saveState, loadSocial, saveSocial,
  autoRollover, spawnRecurring,
  INIT_TASKS, INIT_EVENTS, INIT_CHALLENGES, INIT_SHARED_GOALS,
} from "./utils.js";
import { XPBar } from "./components/ui.jsx";
import TaskModal from "./screens/TaskModal.jsx";
import TasksScreen from "./screens/TasksScreen.jsx";
import CalendarScreen from "./screens/CalendarScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import SocialScreen from "./screens/SocialScreen.jsx";

// ─── TELEGRAM WEBAPP INIT ─────────────────────────────────────────
const tg = typeof window !== "undefined" && window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor("#07071C"); tg.setBackgroundColor("#07071C"); }

// ─── CLOUD SYNC HELPERS ───────────────────────────────────────────
const CLOUD_DEBOUNCE_MS = 4000; // сохраняем в облако через 4 сек после последнего изменения

export default function App() {
  const saved    = loadState();
  const savedSoc = loadSocial();

  const [xp,       setXP]       = useState(saved?.xp       ?? 340);
  const [tasks,    setTasks]    = useState(saved?.tasks     ?? INIT_TASKS);
  const [events,   setEvts]     = useState(saved?.events    ?? INIT_EVENTS);
  const [nickname, setNickname] = useState(saved?.nickname  ?? "");
  const [tab,      setTab]      = useState("overview");
  const [overviewEditTask, setOverviewEditTask] = useState(null);
  const [xpAnim,   setXPAnim]  = useState(null);
  const [lvlUpAnim,setLvlUp]   = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const prevLvlRef  = useRef(lvlOf(saved?.xp ?? 340));
  const userKeyRef  = useRef(null);   // Firebase UID или "tg_{id}"
  const syncTimerRef = useRef(null);  // debounce timer

  const [challenges,  setChallenges]  = useState(savedSoc?.challenges  ?? INIT_CHALLENGES);
  const [sharedGoals, setSharedGoals] = useState(savedSoc?.sharedGoals ?? INIT_SHARED_GOALS);

  // ── Инициализация: auth + загрузка облачных данных ───────────────
  useEffect(() => {
    // 1. Спаун повторяющихся задач из localStorage
    setTasks(prev => spawnRecurring(autoRollover(prev), events, today));

    // 2. Инициализация облачного синка
    initUserSync().then(async (key) => {
      if (!key) return;
      userKeyRef.current = key;

      // 3. Загружаем данные из облака — берём если они НОВЕЕ локальных
      const cloud = await cloudLoadUserData(key);
      if (!cloud) return; // первый запуск — облако пустое

      const localTime  = saved?._savedAt ?? 0;
      const cloudTime  = cloud._savedAt  ?? 0;

      if (cloudTime > localTime) {
        // Облако актуальнее localStorage → применяем
        if (cloud.tasks)    setTasks(prev => spawnRecurring(autoRollover(cloud.tasks), cloud.events ?? [], today));
        if (cloud.events)   setEvts(cloud.events);
        if (cloud.xp   !== undefined) setXP(cloud.xp);
        if (cloud.nickname) setNickname(cloud.nickname);
        setSyncStatus("saved");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Сохранение в localStorage при каждом изменении ───────────────
  useEffect(() => {
    saveState({ xp, tasks, events, nickname, _savedAt: Date.now() });
  }, [xp, tasks, events, nickname]);

  useEffect(() => { saveSocial({ challenges, sharedGoals }); }, [challenges, sharedGoals]);

  // ── Дебаунс-сохранение в облако ───────────────────────────────────
  useEffect(() => {
    if (!userKeyRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncStatus("idle");
    syncTimerRef.current = setTimeout(async () => {
      setSyncStatus("saving");
      const ok = await cloudSaveUserData(userKeyRef.current, {
        xp, tasks, events, nickname, _savedAt: Date.now(),
      });
      setSyncStatus(ok ? "saved" : "error");
      // Сбросить иконку через 3 сек
      setTimeout(() => setSyncStatus("idle"), 3000);
    }, CLOUD_DEBOUNCE_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xp, tasks, events, nickname]);

  // ── Импорт данных (из JSON-файла) ────────────────────────────────
  const handleImport = useCallback((data) => {
    if (data.tasks)    setTasks(data.tasks);
    if (data.events)   setEvts(data.events);
    if (data.xp   !== undefined) setXP(data.xp);
    if (data.nickname) setNickname(data.nickname);
  }, []);

  // ── Social handlers ───────────────────────────────────────────────
  const handleUpdateCh = useCallback((id, updFn) => setChallenges(p => p.map(c => c.id===id ? updFn(c) : c)), []);
  const handleUpdateSg = useCallback((id, updFn) => setSharedGoals(p => p.map(s => s.id===id ? updFn(s) : s)), []);
  const handleDeleteCh = useCallback(id => setChallenges(p => p.filter(c => c.id!==id)), []);
  const handleDeleteSg = useCallback(id => setSharedGoals(p => p.filter(s => s.id!==id)), []);

  const handleCreateCh = useCallback(ch => {
    const tgUser = typeof window!=="undefined" && window.Telegram?.WebApp?.initDataUnsafe?.user;
    const myName = nickname || ch._myName || tgUser?.first_name || "Создатель";
    const myTgId = tgUser?.id ? String(tgUser.id) : null;
    setChallenges(p => [ch, ...p]);
    cloudSave("challenges", { ...ch, participants:[{name:myName,avatar:"🧙",streak:0,history:[],lastCompleted:null,...(myTgId?{tgId:myTgId}:{})}] })
      .then(ok => { if(!ok) console.error("⚠️ Не удалось сохранить соревнование."); });
  }, [nickname]);

  const handleCreateSg = useCallback(sg => {
    setSharedGoals(p => [sg, ...p]);
    cloudSave("sharedGoals", sg).then(ok => { if(!ok) console.error("⚠️ Не удалось сохранить цель."); });
  }, []);

  const level = lvlOf(xp);

  // ── Task handlers ─────────────────────────────────────────────────
  const handleToggle = useCallback(id => {
    setTasks(prev => prev.map(t => {
      if(t.id !== id) return t;
      if(!t.done) {
        const newStreak = t.streakEnabled ? (t.streak||0)+1 : (t.streak||0);
        setXP(prev => {
          const newXP = prev + t.xp, newLvl = lvlOf(newXP);
          if(newLvl > prevLvlRef.current) { setLvlUp(true); setTimeout(()=>setLvlUp(false),3000); prevLvlRef.current=newLvl; }
          return newXP;
        });
        setXPAnim({amount:t.xp}); setTimeout(()=>setXPAnim(null),2200);
        return {...t, done:true, streak:newStreak};
      }
      setXP(prev => Math.max(0,prev-t.xp));
      return {...t, done:false, streak:t.streakEnabled?Math.max(0,(t.streak||0)-1):(t.streak||0)};
    }));
  }, []);

  const handleSave = useCallback(task => {
    setTasks(prev => { const idx=prev.findIndex(t=>t.id===task.id); if(idx===-1) return [task,...prev]; const u=[...prev]; u[idx]={...prev[idx],...task}; return u; });
  }, []);

  const handleDelete     = useCallback(id => setTasks(p => p.filter(t=>t.id!==id)), []);
  const handleShopToggle = useCallback((taskId, itemId) => {
    setTasks(prev => prev.map(t => t.id!==taskId||!t.shopItems ? t : {...t, shopItems:t.shopItems.map(it=>it.id===itemId?{...it,done:!it.done}:it)}));
  }, []);
  const handleAddEvent    = useCallback((ev, autoTasks) => { if(ev) setEvts(p=>[ev,...p]); if(autoTasks?.length) setTasks(p=>[...autoTasks,...p]); }, []);
  const handleEditEvent   = useCallback(ev => setEvts(p=>{const i=p.findIndex(e=>e.id===ev.id);if(i===-1)return p;const u=[...p];u[i]={...p[i],...ev};return u;}), []);
  const handleDeleteEvent = useCallback(id => { setEvts(p=>p.filter(e=>e.id!==id)); setTasks(p=>p.filter(t=>t.eventId!==id)); }, []);

  // ── Sync status indicator ─────────────────────────────────────────
  const syncIcon = syncStatus==="saving"?"⏳":syncStatus==="saved"?"☁️✓":syncStatus==="error"?"⚠️":null;

  const TABS = [
    {id:"overview",label:"Главная",  icon:"🏠"},
    {id:"tasks",   label:"Квесты",   icon:"⚔️"},
    {id:"calendar",label:"Календарь",icon:"📅"},
    {id:"social",  label:"Союзники", icon:"🤝"},
    {id:"profile", label:"Герой",    icon:"🧙"},
  ];

  return (
    <div style={{width:"100%",maxWidth:420,margin:"0 auto",background:T.bg0,minHeight:"100vh",maxHeight:"100vh",fontFamily:"'Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif",color:T.text,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.7);cursor:pointer;}
        input[type=date]{color-scheme:dark;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:${T.brd};border-radius:2px;}
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes xpFloat{0%{opacity:0;transform:translateY(10px) scale(.7)}15%{opacity:1;transform:translateY(-5px) scale(1.2)}70%{opacity:1;transform:translateY(-50px) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(.8)}}
        @keyframes lvlGlow{0%,100%{opacity:0;transform:scale(.8)}20%,80%{opacity:1;transform:scale(1)}}
        @keyframes sparkle{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.1)}100%{transform:rotate(360deg) scale(1)}}
      `}</style>

      {xpAnim&&<div style={{position:"fixed",top:"25%",left:"50%",transform:"translateX(-50%)",zIndex:300,pointerEvents:"none",textAlign:"center",animation:"xpFloat 2.2s ease forwards"}}><div style={{fontSize:32,fontWeight:900,color:T.gold,textShadow:`0 0 30px ${T.gold},0 0 60px ${T.gold}88`}}>+{xpAnim.amount} XP</div><div style={{fontSize:14,color:T.goldL,marginTop:2}}>✨ Квест выполнен!</div></div>}
      {lvlUpAnim&&<div style={{position:"fixed",inset:0,zIndex:200,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",animation:"lvlGlow 3s ease forwards",background:"rgba(139,92,246,0.15)"}}><div style={{background:T.bg1,border:`2px solid ${T.gold}`,borderRadius:20,padding:"28px 40px",textAlign:"center",boxShadow:`0 0 60px ${T.purp}88`}}><div style={{fontSize:48,marginBottom:8,animation:"sparkle 1s ease"}}>⭐</div><div style={{fontSize:13,color:T.sub,textTransform:"uppercase",letterSpacing:"0.1em"}}>Новый уровень</div><div style={{fontSize:36,fontWeight:900,color:T.gold}}>Уровень {level}</div><div style={{fontSize:16,color:T.purpL,marginTop:4}}>{RANKS[Math.min(level-1,RANKS.length-1)]}</div></div></div>}

      {tab!=="calendar"&&tab!=="overview"&&(
        <div style={{padding:`calc(14px + env(safe-area-inset-top,0px)) 16px 12px`,background:T.bg1,borderBottom:`1px solid ${T.brd}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div><div style={{fontSize:20,fontWeight:900,letterSpacing:"-0.03em"}}><span style={{color:T.gold}}>Q</span><span style={{color:T.text}}>uestly</span></div><div style={{fontSize:11,color:T.sub,letterSpacing:"0.05em"}}>RPG-трекер задач</div></div>
            <div style={{textAlign:"right"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end",marginBottom:4}}>
                {syncIcon&&<span style={{fontSize:11,color:syncStatus==="error"?T.rose:T.teal}}>{syncIcon}</span>}
                <span style={{fontSize:11,color:T.sub}}>Ур.{level}</span>
                <span style={{fontSize:13,fontWeight:800,color:T.purpL}}>{RANK_ICONS[Math.min(level-1,RANK_ICONS.length-1)]} {RANKS[Math.min(level-1,RANKS.length-1)]}</span>
              </div>
              <span style={{fontSize:11,color:T.gold,fontWeight:700}}>⚡ {xp.toLocaleString()} XP</span>
            </div>
          </div>
          <XPBar progress={progOf(xp)} height={5}/>
        </div>
      )}

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
        {tab==="overview" &&<OverviewScreen tasks={tasks} xp={xp} level={level} rank={RANKS[Math.min(level-1,RANKS.length-1)]} rankIcon={RANK_ICONS[Math.min(level-1,RANK_ICONS.length-1)]} xpProgress={progOf(xp)} onEditTask={setOverviewEditTask}/>}
        {tab==="tasks"    &&<TasksScreen    tasks={tasks} onToggle={handleToggle} onSave={handleSave} onDelete={handleDelete} onShopToggle={handleShopToggle}/>}
        {tab==="calendar" &&<CalendarScreen events={events} tasks={tasks} onAddEvent={handleAddEvent} onEditEvent={handleEditEvent} onDeleteEvent={handleDeleteEvent}/>}
        {tab==="social"   &&<SocialScreen   nickname={nickname} challenges={challenges} sharedGoals={sharedGoals} onUpdateCh={handleUpdateCh} onUpdateSg={handleUpdateSg} onDeleteCh={handleDeleteCh} onDeleteSg={handleDeleteSg} onCreateCh={handleCreateCh} onCreateSg={handleCreateSg}/>}
        {tab==="profile"  &&<ProfileScreen  xp={xp} tasks={tasks} events={events} nickname={nickname} onSetNickname={setNickname} syncStatus={syncStatus} onImport={handleImport}/>}
      </div>

      <div style={{display:"flex",background:T.bg1,borderTop:`1px solid ${T.brd}`,flexShrink:0,paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
        {TABS.map(t=>(
          <div key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div style={{fontSize:22,transform:tab===t.id?"scale(1.15)":"scale(1)",transition:"transform 0.2s cubic-bezier(.34,1.56,.64,1)"}}>{t.icon}</div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.03em",color:tab===t.id?T.purpL:T.dim,transition:"color 0.2s"}}>{t.label}</div>
            {tab===t.id&&<div style={{width:20,height:3,borderRadius:2,background:T.purp,marginTop:1}}/>}
          </div>
        ))}
      </div>

      {overviewEditTask&&<TaskModal existing={overviewEditTask} onClose={()=>setOverviewEditTask(null)} onSave={t=>{handleSave(t);setOverviewEditTask(null);}} onDelete={id=>{handleDelete(id);setOverviewEditTask(null);}}/>}
    </div>
  );
}
