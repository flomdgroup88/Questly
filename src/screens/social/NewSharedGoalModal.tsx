import { useState } from "react";
import { T } from "../../theme.js";
import { today, uid, mkCode } from "../../utils";
import { ModalOverlay, SectionLabel, StyledInput, Btn } from "../../components/ui.jsx";
import { useUser } from "../../context/UserContext.js";
import type { SharedGoal, SharedGoalItem } from "../../types.js";

interface Props {
  onClose:  () => void;
  onCreate: (sg: SharedGoal) => void;
}

export function NewSharedGoalModal({ onClose, onCreate }: Props) {
  const { nickname } = useUser();

  const [title,      setTitle]      = useState("");
  const [itemText,   setItemText]   = useState("");
  const [items,      setItems]      = useState<SharedGoalItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => {
    if (!itemText.trim()) return;
    setItems(p => [...p, { id: uid(), title: itemText.trim(), assignedTo: null, doneBy: null, done: false }]);
    setItemText("");
  };

  const submit = () => {
    if (!title.trim() || items.length === 0 || submitting) return;
    setSubmitting(true);
    onCreate({
      id: uid(), title: title.trim(), emoji: "🎯",
      shareCode: mkCode(), createdAt: today(),
      participants: [nickname || "Я"], items,
    });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: T.teal }}>
        🎯 Общая цель
      </h3>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: T.sub }}>
        Раздели задачи с другом и выполняйте вместе
      </p>

      <div style={{ marginBottom: 14 }}>
        <SectionLabel>Название</SectionLabel>
        <StyledInput
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Список покупок / Подготовка к вечеринке…"
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionLabel>Пункты ({items.length})</SectionLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={itemText} onChange={e => setItemText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder="Добавить пункт…"
            style={{
              flex: 1, padding: "10px 13px", background: T.bg0,
              border: `1px solid ${T.brd}`, borderRadius: 10,
              color: T.text, fontSize: 14, outline: "none", colorScheme: "dark",
            }}
          />
          <div
            onClick={addItem}
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: T.teal + "33", border: `1px solid ${T.teal}66`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 20, color: T.teal, flexShrink: 0,
            }}
          >+</div>
        </div>

        {items.map(it => (
          <div key={it.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px", background: T.bg0,
            borderRadius: 10, border: `1px solid ${T.brd}`, marginBottom: 6,
          }}>
            <span style={{ fontSize: 14, color: T.text, flex: 1 }}>{it.title}</span>
            <div
              onClick={() => setItems(p => p.filter(x => x.id !== it.id))}
              style={{ fontSize: 14, color: T.rose, cursor: "pointer", padding: "2px 6px" }}
            >✕</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Отмена</Btn>
        <Btn
          variant="teal" onClick={submit} style={{ flex: 2 }}
          disabled={!title.trim() || items.length === 0 || submitting}
        >
          Создать 🎯
        </Btn>
      </div>
    </ModalOverlay>
  );
}
