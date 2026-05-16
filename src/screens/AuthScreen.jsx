import { useState } from "react";
import { T } from "../theme.js";
import { emailSignIn, emailRegister } from "../firebase.js";

// Человекочитаемые тексты для ошибок Firebase
const FIREBASE_ERRORS = {
  "auth/user-not-found":      "Пользователь с таким email не найден",
  "auth/wrong-password":      "Неверный пароль",
  "auth/invalid-credential":  "Неверный email или пароль",
  "auth/email-already-in-use":"Этот email уже зарегистрирован",
  "auth/weak-password":       "Пароль слишком короткий — минимум 6 символов",
  "auth/invalid-email":       "Неверный формат email",
  "auth/too-many-requests":   "Слишком много попыток. Подожди пару минут",
  "auth/network-request-failed": "Нет соединения. Проверь интернет",
};

export default function AuthScreen() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const canSubmit = email.trim() && password.trim() && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "login") {
        await emailSignIn(email.trim(), password);
      } else {
        await emailRegister(email.trim(), password);
      }
      // onAuthStateChanged в App.jsx сам обновит состояние — ничего не делаем здесь
    } catch (e) {
      setError(FIREBASE_ERRORS[e.code] ?? "Что-то пошло не так. Попробуй ещё раз.");
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === "login" ? "register" : "login");
    setError("");
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 32, minHeight: "100vh", background: T.bg0,
    }}>
      <div style={{
        background: T.bg1, borderRadius: 24, padding: "36px 28px 28px",
        width: "100%", maxWidth: 340,
        border: `1px solid ${T.brd}`,
        boxShadow: `0 0 60px ${T.purp}33`,
      }}>
        {/* Логотип */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>⚔️</div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>
            <span style={{ color: T.gold }}>Q</span>
            <span style={{ color: T.text }}>uestly</span>
          </div>
          <div style={{ fontSize: 13, color: T.sub, marginTop: 4 }}>
            {mode === "login"
              ? "Войди чтобы продолжить приключение"
              : "Создай аккаунт — начни приключение"}
          </div>
        </div>

        {/* Email */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: T.sub, marginBottom: 5, fontWeight: 700, letterSpacing: "0.08em" }}>
            EMAIL
          </div>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="твой@email.com"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              background: T.bg0, border: `1px solid ${T.brd}`,
              color: T.text, fontSize: 15, outline: "none",
              boxSizing: "border-box", colorScheme: "dark",
            }}
          />
        </div>

        {/* Пароль */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.sub, marginBottom: 5, fontWeight: 700, letterSpacing: "0.08em" }}>
            ПАРОЛЬ
          </div>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder={mode === "register" ? "Минимум 6 символов" : "••••••••"}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              background: T.bg0, border: `1px solid ${T.brd}`,
              color: T.text, fontSize: 15, outline: "none",
              boxSizing: "border-box", colorScheme: "dark",
            }}
          />
        </div>

        {/* Ошибка */}
        {error && (
          <div style={{
            background: `${T.rose}18`, border: `1px solid ${T.rose}44`,
            borderRadius: 10, padding: "10px 13px", marginBottom: 16,
            fontSize: 13, color: T.rose, lineHeight: 1.45,
          }}>
            {error}
          </div>
        )}

        {/* Кнопка */}
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 16,
            border: "none",
            background: canSubmit ? T.purp : T.brd,
            color: canSubmit ? "#fff" : T.dim,
            fontSize: 15, fontWeight: 800,
            cursor: canSubmit ? "pointer" : "default",
            boxShadow: canSubmit ? `0 4px 20px ${T.purp}55` : "none",
            transition: "all 0.2s",
            marginBottom: 16,
          }}
        >
          {loading
            ? "⏳ Загружаем…"
            : mode === "login"
              ? "Войти ⚡"
              : "Создать аккаунт ⚡"}
        </button>

        {/* Переключатель режима */}
        <div style={{ textAlign: "center", fontSize: 13 }}>
          <span style={{ color: T.sub }}>
            {mode === "login" ? "Ещё нет аккаунта? " : "Уже есть аккаунт? "}
          </span>
          <span
            onClick={switchMode}
            style={{ color: T.purpL, cursor: "pointer", fontWeight: 700 }}
          >
            {mode === "login" ? "Создать" : "Войти"}
          </span>
        </div>
      </div>
    </div>
  );
}
