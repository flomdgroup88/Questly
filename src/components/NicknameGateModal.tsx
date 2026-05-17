import { useState } from "react";
import { T } from "../theme.js";
import { useUser } from "../context/UserContext.js";

const AVATAR_OPTIONS = [
  "🧙","🦊","🐼","🦁","🐯","🐸","🐧","🦄",
  "🤖","👾","🧸","🦋","🐉","🦅","🐬","🧠",
];

interface Props {
  /** Вызывается когда пользователь сохранил имя — переключаем вкладку */
  onDone:  () => void;
  /** Вызывается при нажатии «Позже» — просто закрываем */
  onClose: () => void;
}

/**
 * Спрашивает никнейм и аватар перед входом в «Союзники».
 * Пишет результат напрямую в UserContext — не нужно тащить колбэки
 * через App.jsx.
 */
export function NicknameGateModal({ onDone, onClose }: Props) {
  const { userAvatar, setNickname, setUserAvatar } = useUser();

  const [name,   setName]   = useState("");
  const [avatar, setAvatar] = useState(userAvatar);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setNickname(trimmed);
    setUserAvatar(avatar);
    onDone();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(7,7,28,0.88)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "24px 24px 0",
      overflowY: "auto",
    }}>
      <div style={{
        background: T.bg1, borderRadius: 20, padding: "28px 24px",
        width: "100%", maxWidth: 340, border: `1px solid ${T.brd}`,
        boxShadow: `0 0 40px ${T.purp}33`,
        marginBottom: 24, flexShrink: 0,
      }}>
        <div style={{ fontSize: 52, textAlign: "center", marginBottom: 10, lineHeight: 1 }}>{avatar}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.purpL, textAlign: "center", marginBottom: 4 }}>
          Как тебя зовут?
        </div>
        <div style={{ fontSize: 13, color: T.sub, textAlign: "center", marginBottom: 16 }}>
          Имя и аватар будут видны друзьям в соревнованиях
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Выбери аватар
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
            {AVATAR_OPTIONS.map(em => (
              <div
                key={em}
                onClick={() => setAvatar(em)}
                style={{
                  aspectRatio: "1", borderRadius: 10, fontSize: 22,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  background: avatar === em ? T.purp + "44" : T.bg0,
                  border: `2px solid ${avatar === em ? T.purp : T.brd}`,
                  transition: "all 0.15s",
                }}
              >{em}</div>
            ))}
          </div>
        </div>

        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          placeholder="Твоё имя или никнейм…"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 12,
            background: T.bg0, border: `1px solid ${T.brd}`,
            color: T.text, fontSize: 15, outline: "none",
            marginBottom: 16, boxSizing: "border-box", colorScheme: "dark",
          }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: T.bg0, border: `1px solid ${T.brd}`, color: T.sub, fontSize: 14, cursor: "pointer" }}>
            Позже
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 12,
              background: name.trim() ? T.purp : T.bg0,
              border: "none", color: name.trim() ? "#fff" : T.dim,
              fontSize: 14, fontWeight: 700,
              cursor: name.trim() ? "pointer" : "default",
              transition: "all 0.2s",
            }}
          >
            Сохранить ✓
          </button>
        </div>
      </div>
    </div>
  );
}
