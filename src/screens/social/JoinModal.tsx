import { useState } from "react";
import { T } from "../../theme.js";
import { ModalOverlay, Btn } from "../../components/ui.jsx";
import { useUser } from "../../context/UserContext.js";
import {
  cloudFind, cloudAddParticipant, cloudDeduplicateParticipants,
} from "../../firebase.js";
import type { Challenge, SharedGoal } from "../../types.js";

interface Props {
  challenges:  Challenge[];
  sharedGoals: SharedGoal[];
  onClose:     () => void;
  onJoinCh:    (ch: Challenge) => void;
  onJoinSg:    (sg: SharedGoal) => void;
}

type FoundResult =
  | { type: "challenge"; data: Challenge }
  | { type: "goal";      data: SharedGoal };

export function JoinModal({ challenges, sharedGoals, onClose, onJoinCh, onJoinSg }: Props) {
  const { nickname, userAvatar } = useUser();

  const [code,    setCode]    = useState("");
  const [result,  setResult]  = useState<FoundResult | null>(null);
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const search = async (code: string) => {
    if (!code) { setErr("Введи код"); return; }

    // Сначала ищем локально — мгновенный отклик
    const localCh = challenges.find(x => x.shareCode === code);
    const localSg = sharedGoals.find(x => x.shareCode === code);
    if (localCh) { setResult({ type: "challenge", data: localCh }); setErr(""); return; }
    if (localSg) { setResult({ type: "goal",      data: localSg }); setErr(""); return; }

    // Потом в облаке
    setLoading(true); setErr(""); setResult(null);
    try {
      const found = await cloudFind(code);
      if (found) { setResult(found); setErr(""); }
      else        setErr("Код не найден. Проверь правильность кода.");
    } catch {
      setErr("Ошибка соединения. Проверь интернет.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setCode(val); setResult(null); setErr("");
    if (val.length === 6) search(val);
  };

  const join = async () => {
    if (!result) return;
    const tgUser  = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userName = nickname || tgUser?.first_name || "Друг";
    const tgId     = tgUser?.id ? String(tgUser.id) : null;

    if (result.type === "challenge") {
      onJoinCh(result.data);
      await cloudAddParticipant("challenge", result.data.shareCode, {
        name: userName, avatar: userAvatar || "👤",
        streak: 0, lastCompleted: null, history: [],
        ...(tgId ? { tgId } : {}),
      });
      cloudDeduplicateParticipants(result.data.shareCode).catch(() => {});
    } else {
      onJoinSg(result.data);
      await cloudAddParticipant("goal", result.data.shareCode, userName);
    }
    onClose();
  };

  const borderColor = code.length === 6
    ? result ? T.teal : err ? T.rose : T.brd
    : T.brd;

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: T.sky }}>
        🔗 Присоединиться
      </h3>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: T.sub }}>
        Введи 6-значный код от друга
      </p>

      <div style={{ marginBottom: 14 }}>
        <input
          value={code} onChange={handleChange}
          placeholder="ABCDEF" maxLength={6}
          style={{
            width: "100%", boxSizing: "border-box", padding: "14px",
            background: T.bg0, border: `2px solid ${borderColor}`,
            borderRadius: 11, color: T.text, fontSize: 24, fontWeight: 800,
            letterSpacing: "0.2em", textAlign: "center", outline: "none",
            colorScheme: "dark", transition: "border-color 0.2s",
          }}
        />
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: T.sub }}>
          {loading ? "⏳ Ищем..." : code.length < 6 ? `${code.length}/6 символов` : ""}
        </div>
      </div>

      {err && (
        <div style={{ color: T.rose, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{err}</div>
      )}

      {result && (
        <div style={{
          background: T.bg0, borderRadius: 13,
          border: `2px solid ${result.type === "challenge" ? T.purp : T.teal}`,
          padding: "16px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>
            {result.type === "challenge" ? "🏆" : "🎯"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 4 }}>
            {result.data.title}
          </div>
          <div style={{ fontSize: 12, color: T.sub }}>
            {result.type === "challenge"
              ? `Соревнование · ${result.data.participants.length + 1} участников`
              : `Общая цель · ${(result.data as SharedGoal).items.length} пунктов`}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Отмена</Btn>
        <Btn variant="primary" onClick={join} style={{ flex: 2 }} disabled={!result}>
          Присоединиться 🤝
        </Btn>
      </div>
    </ModalOverlay>
  );
}
