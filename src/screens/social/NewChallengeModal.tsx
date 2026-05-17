import { useState } from "react";
import { T } from "../../theme.js";
import { today, uid, mkCode } from "../../utils.js";
import { ModalOverlay, SectionLabel, StyledInput, RecurPicker, Btn } from "../../components/ui.jsx";
import { useUser } from "../../context/UserContext.js";
import type { Challenge } from "../../types.js";

const EMOJIS = ["🏋️","🏃","🧘","📚","💧","🌅","🎯","💪","🚴","🍎","✏️","🎸"];

interface Props {
  onClose:  () => void;
  onCreate: (ch: Challenge) => void;
}

export function NewChallengeModal({ onClose, onCreate }: Props) {
  const { nickname } = useUser();

  const [title,      setTitle]      = useState("");
  const [emoji,      setEmoji]      = useState("🏋️");
  const [desc,       setDesc]       = useState("");
  const [recurType,  setRecurType]  = useState("day");
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);

    const tgUser     = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const creatorName = nickname || tgUser?.first_name || "Создатель";

    onCreate({
      id: uid(), title: title.trim(), emoji,
      desc: desc.trim(), shareCode: mkCode(),
      recurType, createdAt: today(),
      myStreak: 0, myHistory: [], participants: [],
      _myName: creatorName,
    } as Challenge);

    onClose();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: T.purpL }}>
        🏆 Новое соревнование
      </h3>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: T.sub }}>
        Создай серию задач и соревнуйся с другом
      </p>

      <div style={{ marginBottom: 14 }}>
        <SectionLabel>Эмодзи</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EMOJIS.map(e => (
            <div
              key={e} onClick={() => setEmoji(e)}
              style={{
                width: 38, height: 38, borderRadius: 10, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20,
                background: emoji === e ? T.purp + "44" : T.bg0,
                border: `2px solid ${emoji === e ? T.purp : T.brd}`,
                transition: "all 0.15s",
              }}
            >{e}</div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionLabel>Название</SectionLabel>
        <StyledInput
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Утренняя зарядка…"
          onKeyDown={e => e.key === "Enter" && submit()}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionLabel>Описание (необязательно)</SectionLabel>
        <StyledInput
          value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Что нужно делать каждый день?"
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <SectionLabel>Периодичность</SectionLabel>
        <RecurPicker value={recurType} onChange={setRecurType} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Отмена</Btn>
        <Btn
          variant="primary" onClick={submit} style={{ flex: 2 }}
          disabled={!title.trim() || submitting}
        >
          Создать ⚡
        </Btn>
      </div>
    </ModalOverlay>
  );
}
