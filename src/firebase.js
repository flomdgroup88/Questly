// ─── FIREBASE CONFIG ──────────────────────────────────────────────
// Это бесплатный проект Firebase специально для Questly.
// Firestore хранит соревнования и цели, чтобы друзья могли
// находить их по коду с любого устройства.

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC28BBF4vQcHXOEezxJ2LG2hOxRfyWLqoU",
  authDomain: "questly-social.firebaseapp.com",
  projectId: "questly-social",
  storageBucket: "questly-social.firebasestorage.app",
  messagingSenderId: "1091098265991",
  appId: "1:1091098265991:web:cfd2817f25ad963dc82b22",
  measurementId: "G-944C4YQF3S"
};

// ⚠️ ВАЖНО: замени firebaseConfig выше на свой из Firebase Console
// Инструкция: см. README_FIREBASE.md в папке проекта

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ─── Сохранить соревнование/цель в облако ────────────────────────
export async function cloudSave(type, item) {
  // type: "challenges" | "sharedGoals"
  // item.shareCode — уникальный ключ
  try {
    await setDoc(doc(db, type, item.shareCode), {
      ...item,
      _type: type,
      _savedAt: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn("Firebase save error:", e);
    return false;
  }
}

// ─── Найти по коду (ищем и в challenges, и в sharedGoals) ────────
export async function cloudFind(code) {
  const c = code.trim().toUpperCase();
  // Ошибки НЕ перехватываем — пусть JoinModal покажет правильное сообщение
  const chSnap = await getDoc(doc(db, "challenges", c));
  if (chSnap.exists()) return { type: "challenge", data: chSnap.data() };
  const sgSnap = await getDoc(doc(db, "sharedGoals", c));
  if (sgSnap.exists()) return { type: "goal", data: sgSnap.data() };
  return null;
}

// ─── Добавить участника к существующему соревнованию ─────────────
export async function cloudAddParticipant(type, shareCode, participant) {
  try {
    const col = type === "challenge" ? "challenges" : "sharedGoals";
    await updateDoc(doc(db, col, shareCode), {
      participants: arrayUnion(participant),
    });
    return true;
  } catch (e) {
    console.warn("Firebase addParticipant error:", e);
    return false;
  }
}
