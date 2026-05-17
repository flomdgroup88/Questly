/**
 * AchievementToast — красивый тост-уведомление о новой ачивке.
 *
 * Особенности:
 *  - Вылетает снизу с пружинной анимацией (overshoot + settle)
 *  - Частицы-конфетти при появлении
 *  - Пульсирующее свечение и шиммер на карточке
 *  - Иконка "выпрыгивает" с bounce-эффектом
 *  - Плавно уходит вниз через 4 сек (или по тапу)
 *  - Цветовая схема зависит от категории ачивки
 */

import { useEffect, useState, useRef } from "react";
import { T } from "../theme.js";

// ─── Частицы ─────────────────────────────────────────────────────
const PARTICLE_COUNT = 20;

function makeParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle    = (i / PARTICLE_COUNT) * 360 + (Math.random() - 0.5) * 25;
    const dist     = 45 + Math.random() * 45;
    const rad      = (angle * Math.PI) / 180;
    const isSquare = i % 4 === 0;
    const COLORS   = ["#F5A623","#8B5CF6","#06D6A0","#F43F5E","#38BDF8","#FFD080","#C4A5FF","#FF6B9D"];
    return {
      id:      i,
      tx:      Math.cos(rad) * dist,
      ty:      -(Math.abs(Math.sin(rad)) * dist + 10 + Math.random() * 20),
      size:    isSquare ? 5 + Math.random() * 4 : 4 + Math.random() * 5,
      color:   COLORS[i % COLORS.length],
      delay:   0.05 + Math.random() * 0.25,
      isSquare,
    };
  });
}

// ─── Цветовые схемы по категориям ────────────────────────────────
const CAT_THEMES = {
  tasks:  { from:"#1E0F4A", to:"#130A30", border:"#8B5CF6", label:"Задача выполнена" },
  level:  { from:"#2A1A00", to:"#180F00", border:"#F5A623", label:"Новый уровень!" },
  streak: { from:"#2A0A10", to:"#180610", border:"#F43F5E", label:"Серия засчитана" },
  habit:  { from:"#002A1A", to:"#001810", border:"#06D6A0", label:"Привычка сформирована" },
  events: { from:"#00182A", to:"#000F1A", border:"#38BDF8", label:"Событие отмечено" },
  period: { from:"#1A0030", to:"#100020", border:"#C4A5FF", label:"Период освоен" },
  bonus:  { from:"#2A2000", to:"#181200", border:"#FFD080", label:"Бонусная ачивка!" },
};

const KEYFRAMES = `
  @keyframes ach-slide-up {
    0%   { transform: translateX(-50%) translateY(110px) scale(0.92); opacity: 0; }
    18%  { transform: translateX(-50%) translateY(-10px) scale(1.02); opacity: 1; }
    28%  { transform: translateX(-50%) translateY(4px)  scale(0.99); }
    36%  { transform: translateX(-50%) translateY(-3px) scale(1.005); }
    44%  { transform: translateX(-50%) translateY(0)    scale(1); }
    100% { transform: translateX(-50%) translateY(0)    scale(1); opacity: 1; }
  }
  @keyframes ach-slide-down {
    0%   { transform: translateX(-50%) translateY(0)      scale(1);    opacity: 1; }
    100% { transform: translateX(-50%) translateY(130px)  scale(0.9);  opacity: 0; }
  }
  @keyframes ach-icon-pop {
    0%   { transform: scale(0) rotate(-20deg); }
    50%  { transform: scale(1.4) rotate(10deg); }
    68%  { transform: scale(0.88) rotate(-4deg); }
    82%  { transform: scale(1.07) rotate(2deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  @keyframes ach-particle {
    0%   { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
    60%  { opacity: 0.8; }
    100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.2) rotate(180deg); }
  }
  @keyframes ach-shimmer {
    0%   { background-position: -300% center; }
    100% { background-position: 300% center; }
  }
  @keyframes ach-glow-pulse {
    0%, 100% { opacity: 0.5; transform: scale(0.95); }
    50%       { opacity: 1;   transform: scale(1.05); }
  }
  @keyframes ach-label-in {
    0%   { opacity: 0; transform: translateX(-8px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  @keyframes ach-badge-pop {
    0%   { opacity: 0; transform: scale(0.6) translateY(4px); }
    70%  { opacity: 1; transform: scale(1.1) translateY(-1px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes ach-timer-bar {
    0%   { width: 100%; }
    100% { width: 0%; }
  }
`;

export function AchievementToast({ achievement, onDismiss, queueLength }) {
  const [phase, setPhase] = useState("in");
  const particles = useRef(makeParticles()).current;

  const theme = CAT_THEMES[achievement.cat] ?? CAT_THEMES.tasks;

  useEffect(() => {
    setPhase("in");
    const t1 = setTimeout(() => setPhase("out"), 4000);
    const t2 = setTimeout(() => onDismiss(),      4700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement.label]);

  const handleClick = () => {
    if (phase === "out") return;
    setPhase("out");
    setTimeout(onDismiss, 400);
  };

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Частицы ── */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          bottom: 90,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9995,
          pointerEvents: "none",
          width: 0,
          height: 0,
        }}
      >
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              width:  p.size,
              height: p.size,
              borderRadius: p.isSquare ? "2px" : "50%",
              background: p.color,
              // CSS custom props для анимации
              ["--tx"]: `${p.tx}px`,
              ["--ty"]: `${p.ty}px`,
              animation: `ach-particle 0.85s cubic-bezier(.2,.8,.4,1) ${p.delay}s both`,
            }}
          />
        ))}
      </div>

      {/* ── Основная карточка ── */}
      <div
        role="alert"
        onClick={handleClick}
        style={{
          position:   "fixed",
          bottom:     80,
          left:       "50%",
          zIndex:     9996,
          width:      "min(360px, calc(100vw - 24px))",
          borderRadius: 22,
          overflow:   "hidden",
          cursor:     "pointer",
          animation:  phase === "out"
            ? "ach-slide-down 0.65s cubic-bezier(.4,0,1,1) both"
            : "ach-slide-up 0.75s cubic-bezier(.22,1,.36,1) both",
          // Свечение
          boxShadow: `0 0 0 1px ${theme.border}55, 0 12px 40px #00000088, 0 0 30px ${theme.border}33`,
        }}
      >
        {/* Фон */}
        <div style={{
          position:   "absolute",
          inset:      0,
          background: `linear-gradient(145deg, ${theme.from} 0%, ${theme.to} 100%)`,
        }} />

        {/* Пульсирующий ореол (за карточкой) */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: 26,
            border: `2px solid ${theme.border}`,
            animation: "ach-glow-pulse 1.8s ease-in-out 0.4s infinite",
            pointerEvents: "none",
          }}
        />

        {/* Шиммер */}
        <div
          aria-hidden="true"
          style={{
            position:   "absolute",
            inset:      0,
            borderRadius: 22,
            background: `linear-gradient(105deg, transparent 30%, ${theme.border}28 50%, transparent 70%)`,
            backgroundSize: "200% 100%",
            animation:  "ach-shimmer 2.2s linear 0.5s infinite",
            pointerEvents: "none",
          }}
        />

        {/* ── Контент ── */}
        <div style={{
          position: "relative",
          zIndex:   1,
          padding:  "16px 16px 14px",
          display:  "flex",
          alignItems: "center",
          gap:      14,
        }}>

          {/* Иконка */}
          <div style={{
            flexShrink: 0,
            width:  62,
            height: 62,
            borderRadius: 16,
            background: `${theme.border}22`,
            border: `1.5px solid ${theme.border}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            animation: "ach-icon-pop 0.7s cubic-bezier(.22,1,.36,1) 0.1s both",
            filter: `drop-shadow(0 0 12px ${theme.border}99)`,
          }}>
            {achievement.icon}
          </div>

          {/* Текст */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Бейдж */}
            <div style={{
              display:     "inline-flex",
              alignItems:  "center",
              gap:         5,
              background:  `${theme.border}20`,
              border:      `1px solid ${theme.border}44`,
              borderRadius: 20,
              padding:     "2px 9px",
              marginBottom: 5,
              animation:   "ach-badge-pop 0.4s cubic-bezier(.22,1,.36,1) 0.25s both",
            }}>
              <span style={{ fontSize: 9, letterSpacing: "0.1em", fontWeight: 800, color: theme.border, textTransform: "uppercase" }}>
                🏅 Ачивка разблокирована
              </span>
            </div>

            {/* Название */}
            <div style={{
              fontSize:   17,
              fontWeight: 900,
              color:      "#FFFFFF",
              lineHeight: 1.2,
              marginBottom: 3,
              animation:  "ach-label-in 0.35s ease 0.35s both",
            }}>
              {achievement.label}
            </div>

            {/* Описание */}
            {achievement.desc && (
              <div style={{
                fontSize:  12,
                color:     "rgba(255,255,255,0.55)",
                lineHeight: 1.35,
                animation: "ach-label-in 0.35s ease 0.45s both",
                opacity:   0,
              }}>
                {achievement.desc}
              </div>
            )}
          </div>

          {/* Правый блок */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>✕</div>
            {queueLength > 0 && (
              <div style={{
                fontSize:   10,
                fontWeight: 700,
                color:      theme.border,
                background: `${theme.border}22`,
                borderRadius: 10,
                padding:    "1px 6px",
              }}>
                +{queueLength}
              </div>
            )}
          </div>
        </div>

        {/* ── Таймер-бар ── */}
        <div style={{ position: "relative", height: 3, background: `${theme.border}22` }}>
          <div style={{
            position:   "absolute",
            left:       0, top: 0, bottom: 0,
            background: `linear-gradient(90deg, ${theme.border}88, ${theme.border})`,
            borderRadius: "0 2px 2px 0",
            animation:  phase === "out" ? "none" : "ach-timer-bar 4s linear 0.1s both",
          }} />
        </div>
      </div>
    </>
  );
}
