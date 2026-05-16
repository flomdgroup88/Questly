// ─── FIREBASE CONFIG ──────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC28BBF4vQcHXOEezxJ2LG2hOxRfyWLqoU",
  authDomain: "questly-social.firebaseapp.com",
  projectId: "questly-social",
  storageBucket: "questly-social.firebasestorage.app",
  messagingSenderId: "1091098265991",
  appId: "1:1091098265991:web:cfd2817f25ad963dc82b22",
  measurementId: "G-944C4YQF3S"
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ─── USER SYNC INIT ───────────────────────────────────────────────
// Возвращает ключ для облака:
//   • Telegram-пользователь → "tg_{id}"  (постоянный, работает на любом устройстве)
//   • Остальные             → Firebase anonymous UID (хранится в IndexedDB браузера)
export async function initUserSync() {
  try {
    const tgUser = typeof window !== "undefined" && window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) {
      return `tg_${tgUser.id}`;          // ← устойчив к смене устройства
    }
    // Анонимный вход — Firebase сам кэширует токен в IndexedDB
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (e) {
    console.warn("initUserSync failed:", e);
    return null;
  }
}

// ─── USER DATA SYNC ───────────────────────────────────────────────
// Сохранить личные задачи + события в облако
export async function cloudSaveUserData(userKey, data) {
  if (!userKey) return false;
  try {
    await setDoc(doc(db, "userData", userKey), {
      ...data,
      _savedAt: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn("cloudSaveUserData error:", e);
    return false;
  }
}

// Загрузить личные данные из облака
export async function cloudLoadUserData(userKey) {
  if (!userKey) return null;
  try {
    const snap = await getDoc(doc(db, "userData", userKey));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("cloudLoadUserData error:", e);
    return null;
  }
}

// ─── SOCIAL: Сохранить соревнование/цель ─────────────────────────
export async function cloudSave(type, item) {
  try {
    await setDoc(doc(db, type, item.shareCode), {
      ...item, _type: type, _savedAt: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn("Firebase save error:", e);
    return false;
  }
}

// ─── SOCIAL: Найти по коду ────────────────────────────────────────
export async function cloudFind(code) {
  const c = code.trim().toUpperCase();
  const chSnap = await getDoc(doc(db, "challenges", c));
  if (chSnap.exists()) return { type: "challenge", data: chSnap.data() };
  const sgSnap = await getDoc(doc(db, "sharedGoals", c));
  if (sgSnap.exists()) return { type: "goal", data: sgSnap.data() };
  return null;
}

// ─── SOCIAL: Участники ────────────────────────────────────────────
export async function cloudGetParticipants(shareCode) {
  try {
    const snap = await getDoc(doc(db, "challenges", shareCode));
    if (snap.exists()) return snap.data().participants || [];
    return [];
  } catch (e) {
    console.warn("Firebase getParticipants error:", e);
    return [];
  }
}

export async function cloudUpdateMyProgress(shareCode, name, streak, history, tgId) {
  try {
    const snap = await getDoc(doc(db, "challenges", shareCode));
    if (!snap.exists()) return false;
    const parts = snap.data().participants || [];
    const idx = tgId
      ? parts.findIndex(p => p.tgId ? p.tgId === tgId : p.name === name)
      : parts.findIndex(p => p.name === name);
    const entry = { name, avatar: "👤", streak, history, lastCompleted: history[history.length-1] || null, ...(tgId?{tgId}:{}) };
    if (idx >= 0) parts[idx] = entry; else parts.push(entry);
    await updateDoc(doc(db, "challenges", shareCode), { participants: parts });
    return true;
  } catch (e) {
    console.warn("Firebase updateMyProgress error:", e);
    return false;
  }
}

export async function cloudAddParticipant(type, shareCode, participant) {
  try {
    const col = type === "challenge" ? "challenges" : "sharedGoals";
    if (type === "challenge") {
      const snap = await getDoc(doc(db, col, shareCode));
      if (!snap.exists()) return false;
      const parts = snap.data().participants || [];
      const alreadyExists = participant.tgId
        ? parts.some(p => p.tgId ? p.tgId === participant.tgId : p.name === participant.name)
        : parts.some(p => p.name === participant.name);
      if (alreadyExists) return true;
      await updateDoc(doc(db, col, shareCode), { participants: [...parts, participant] });
    } else {
      await updateDoc(doc(db, col, shareCode), { participants: arrayUnion(participant) });
    }
    return true;
  } catch (e) {
    console.warn("Firebase addParticipant error:", e);
    return false;
  }
}

export async function cloudDeduplicateParticipants(shareCode) {
  try {
    const snap = await getDoc(doc(db, "challenges", shareCode));
    if (!snap.exists()) return;
    const parts = snap.data().participants || [];
    const seen = {};
    for (const p of parts) {
      const key = p.tgId ? `tgid:${p.tgId}` : `name:${p.name}`;
      if (!seen[key] || (p.streak||0) > (seen[key].streak||0)) seen[key] = p;
    }
    const deduped = Object.values(seen);
    if (deduped.length < parts.length)
      await updateDoc(doc(db, "challenges", shareCode), { participants: deduped });
  } catch (e) {
    console.warn("Firebase dedup error:", e);
  }
}
