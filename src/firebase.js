// ─── FIREBASE CONFIG ──────────────────────────────────────────────
// Ключи берутся из файла .env (не из кода!)
// Vite автоматически подставляет переменные с префиксом VITE_
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, onSnapshot, runTransaction } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
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
  // Оба запроса идут параллельно — поиск вдвое быстрее
  const [chSnap, sgSnap] = await Promise.all([
    getDoc(doc(db, "challenges", c)),
    getDoc(doc(db, "sharedGoals", c)),
  ]);
  if (chSnap.exists()) return { type: "challenge", data: chSnap.data() };
  if (sgSnap.exists()) return { type: "goal", data: sgSnap.data() };
  return null;
}

// ─── SOCIAL: Участники ────────────────────────────────────────────

// Подписка в реальном времени на участников соревнования.
// Возвращает функцию unsubscribe — вызови её при размонтировании компонента.
// callback получает массив participants каждый раз, когда он меняется в Firestore.
export function cloudSubscribeParticipants(shareCode, callback) {
  const ref = doc(db, "challenges", shareCode);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) callback(snap.data().participants || []);
    },
    (err) => console.warn("cloudSubscribeParticipants error:", err)
  );
}

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
  // runTransaction гарантирует атомарность: если два участника отмечают выполнение
  // одновременно, Firestore повторит транзакцию и никто не потеряет свои данные.
  try {
    const ref = doc(db, "challenges", shareCode);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const parts = snap.data().participants || [];
      const idx = tgId
        ? parts.findIndex(p => p.tgId ? p.tgId === tgId : p.name === name)
        : parts.findIndex(p => p.name === name);
      const entry = { name, avatar: "👤", streak, history, lastCompleted: history[history.length-1] || null, ...(tgId?{tgId}:{}) };
      if (idx >= 0) parts[idx] = entry; else parts.push(entry);
      tx.update(ref, { participants: parts });
    });
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
