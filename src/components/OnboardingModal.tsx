import { useState } from "react";
import { T } from "../theme.js";

const STEPS = [
  {
    emoji: "⚔️",
    title: "Добро пожаловать в Questly!",
    text:  "Это RPG-трекер задач: выполняй квесты, зарабатывай опыт и прокачивай своего героя.",
  },
  {
    emoji: "⚡",
    title: "XP и уровни",
    text:  "За каждую выполненную задачу ты получаешь XP. Набирай очки — и твой герой растёт в уровнях.",
  },
  {
    emoji: "🤝",
    title: "Союзники рядом",
    text:  "В разделе «Союзники» можно соревноваться с друзьями или вести общие списки дел.",
  },
  {
    emoji: "🎯",
    title: "Создай первый квест!",
    text:  "Нажми кнопку ниже и добавь свою первую задачу. Первый шаг — самый важный.",
    isAction: true,
  },
] as const;

interface Props {
  onDone:        () => void;
  onCreateFirst: () => void;
}

export function OnboardingModal({ onDone, onCreateFirst }: Props) {
  const [step, setStep] = useState(0);
  const s      = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(7,7,28,0.92)", backdropFilter: "blur(6px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 32,
    }}>
      <div style={{
        background: T.bg1, borderRadius: 24, padding: "36px 28px 28px",
        width: "100%", maxWidth: 340, textAlign: "center",
        border: `1px solid ${T.brd}`, boxShadow: `0 0 60px ${T.purp}44`,
      }}>
        {/* Индикатор шагов */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 8, height: 8, borderRadius: 4,
              background: i === step ? T.purp : T.brd,
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        <div style={{ fontSize: 56, marginBottom: 16 }}>{s.emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 10, lineHeight: 1.3 }}>
          {s.title}
        </div>
        <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.6, marginBottom: 32 }}>
          {s.text}
        </div>

        {"isAction" in s && s.isAction ? (
          <>
            <button
              onClick={onCreateFirst}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 16, border: "none",
                background: `linear-gradient(135deg,${T.purp},${T.gold})`,
                color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
                boxShadow: `0 4px 20px ${T.purp}66`, marginBottom: 10,
              }}
            >
              ⚔️ Создать первый квест
            </button>
            <button onClick={onDone} style={{ background: "none", border: "none", color: T.dim, fontSize: 13, cursor: "pointer" }}>
              Пропустить
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => isLast ? onDone() : setStep(n => n + 1)}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 16, border: "none",
                background: T.purp, color: "#fff", fontSize: 15, fontWeight: 800,
                cursor: "pointer", boxShadow: `0 4px 20px ${T.purp}66`,
              }}
            >
              {isLast ? "Начать приключение! ⚡" : "Далее →"}
            </button>
            <button onClick={onDone} style={{ marginTop: 12, background: "none", border: "none", color: T.dim, fontSize: 13, cursor: "pointer" }}>
              Пропустить
            </button>
          </>
        )}
      </div>
    </div>
  );
}
