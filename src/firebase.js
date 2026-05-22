// ─── FIREBASE CONFIG ──────────────────────────────────────────────
// Ключи берутся из файла .env (не из кода!)
// Vite автоматически подставляет переменные с префиксом VITE_
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, onSnapshot, runTransaction } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

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
export const db        = getFirestore(app);
export const auth      = getAuth(app);
export const messaging = (typeof window !== "undefined" && "serviceWorker" in navigator)
  ? getMessaging(app)
  : null;

// ─── USER SYNC INIT ───────────────────────────────────────────────
// Возвращает ключ для облака:
//   • Уже залогинен (email) → Firebase UID (постоянный)
//   • Telegram-пользователь → "tg_{id}"  (постоянный, работает на любом устройстве)
//   • Остальные             → Firebase anonymous UID (хранится в IndexedDB браузера)

// Ждём, пока Firebase восстановит сессию из IndexedDB (срабатывает один раз при старте).
// auth.currentUser === null до этого момента — нельзя на него полагаться напрямую.
function waitForAuthReady() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      resolve(user ?? null);
    });
  });
}

export async function initUserSync() {
  try {
    // Ждём восстановления сессии — только потом принимаем решения
    const currentUser = await waitForAuthReady();

    // 1. Уже залогинен (email или анонимный) — берём uid напрямую
    if (currentUser) return currentUser.uid;

    // 2. Telegram
    const tgUser = typeof window !== "undefined" && window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) {
      return `tg_${tgUser.id}`;          // ← устойчив к смене устройства
    }

    // 3. Анонимный вход — только если реально никого нет
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (e) {
    console.warn("initUserSync failed:", e);
    return null;
  }
}

// ─── EMAIL AUTH ───────────────────────────────────────────────────
export async function emailSignIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function emailRegister(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut() {
  await signOut(auth);
}

// ─── USER DATA SYNC ───────────────────────────────────────────────
// Сохранить личные задачи + события в облако
// Ошибки, при которых retry бессмысленен (проблема не в сети)
const NO_RETRY_CODES = new Set(["permission-denied", "unauthenticated", "not-found", "invalid-argument"]);

// Firestore не принимает undefined — заменяем на null рекурсивно
function stripUndefined(obj) {
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : stripUndefined(v)])
    );
  }
  return obj;
}

export async function cloudSaveUserData(userKey, data, { retries = 3, baseDelay = 1500 } = {}) {
  if (!userKey) return { ok: false, code: "no-key" };

  const payload = stripUndefined({ ...data, _savedAt: Date.now() });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await setDoc(doc(db, "userData", userKey), payload, { merge: true });
      return { ok: true };
    } catch (e) {
      const code = e.code ?? "unknown";
      console.warn(`cloudSaveUserData attempt ${attempt + 1} failed:`, code, e.message);

      // Не повторяем при ошибках, не связанных с сетью
      if (NO_RETRY_CODES.has(code)) {
        return { ok: false, code, message: e.message };
      }

      // Последняя попытка — возвращаем ошибку
      if (attempt === retries) {
        return { ok: false, code, message: e.message };
      }

      // Экспоненциальная пауза перед следующей попыткой
      await new Promise(res => setTimeout(res, baseDelay * 2 ** attempt));
    }
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

export async function cloudUpdateMyProgress(shareCode, name, streak, history, tgId, avatar) {
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
      const existing = idx >= 0 ? parts[idx] : null;
      const entry = { name, avatar: avatar || (existing?.avatar) || "👤", streak, history, lastCompleted: history[history.length-1] || null, ...(tgId?{tgId}:{}) };
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
    if (type === "challenge") {
      // runTransaction гарантирует атомарность: если двое вступают одновременно,
      // Firestore повторит транзакцию и оба участника попадут в список —
      // никто не затрёт данные другого (в отличие от простого getDoc + updateDoc).
      const ref = doc(db, "challenges", shareCode);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("challenge-not-found");
        const parts = snap.data().participants || [];
        const alreadyExists = participant.tgId
          ? parts.some(p => p.tgId ? p.tgId === participant.tgId : p.name === participant.name)
          : parts.some(p => p.name === participant.name);
        if (!alreadyExists) {
          tx.update(ref, { participants: [...parts, participant] });
        }
      });
    } else {
      // sharedGoals: участник — просто строка, arrayUnion атомарен сам по себе
      await updateDoc(doc(db, "sharedGoals", shareCode), { participants: arrayUnion(participant) });
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

// ─── FCM: Запрос разрешения и получение токена ───────────────────
// VAPID-ключ (публичный) берётся из Firebase Console →
//   Project Settings → Cloud Messaging → Web Push certificates → Key pair
export async function requestNotificationPermission() {
  if (!messaging) return { granted: false, reason: "unsupported" };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { granted: false, reason: "denied" };
    return { granted: true };
  } catch (e) {
    console.warn("requestNotificationPermission error:", e);
    return { granted: false, reason: "error" };
  }
}

export async function getFCMToken() {
  if (!messaging) return null;
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("VITE_FIREBASE_VAPID_KEY не задан — FCM-токен не получить");
    return null;
  }
  try {
    // Убеждаемся, что firebase-messaging-sw.js зарегистрирован
    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    return token ?? null;
  } catch (e) {
    console.warn("getFCMToken error:", e);
    return null;
  }
}

// Сохраняет FCM-токен и настройки уведомлений в Firestore
export async function saveNotificationPrefs(userKey, { fcmToken, enabled, reminderTime }) {
  if (!userKey) return false;
  try {
    await updateDoc(doc(db, "userData", userKey), {
      fcmToken:     fcmToken ?? null,
      notifEnabled: enabled,
      reminderTime: reminderTime,   // "HH:MM" в UTC — сервер читает это поле
      _notifUpdatedAt: Date.now(),
    });
    return true;
  } catch (e) {
    // Если документа ещё нет — создаём через setDoc
    try {
      await setDoc(doc(db, "userData", userKey), {
        fcmToken, notifEnabled: enabled, reminderTime, _notifUpdatedAt: Date.now(),
      }, { merge: true });
      return true;
    } catch (e2) {
      console.warn("saveNotificationPrefs error:", e2);
      return false;
    }
  }
}

// Загружает настройки уведомлений из Firestore
export async function loadNotificationPrefs(userKey) {
  if (!userKey) return null;
  try {
    const snap = await getDoc(doc(db, "userData", userKey));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      fcmToken:     d.fcmToken     ?? null,
      enabled:      d.notifEnabled ?? false,
      reminderTime: d.reminderTime ?? "09:00",
    };
  } catch (e) {
    console.warn("loadNotificationPrefs error:", e);
    return null;
  }
}

// Слушает foreground-уведомления (приложение открыто)
export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

// ─── FRIENDS: Публичный профиль ────────────────────────────────────
// Публикует/обновляет профиль пользователя, чтобы друзья могли найти его по никнейму.
// Ключ документа — lowercase nickname, чтобы поиск был за O(1).
export async function cloudPublishProfile(userKey, nickname, avatar, challenges = [], xp = 0, weeklyXp = 0) {
  if (!userKey || !nickname) return false;
  try {
    await setDoc(doc(db, "userProfiles", nickname.toLowerCase()), {
      userKey,
      nickname,
      avatar: avatar || "👤",
      xp: xp || 0,
      weeklyXp: weeklyXp || 0,
      topChallenges: challenges.slice(0, 3).map(c => ({
        emoji: c.emoji || "🏆",
        title: c.title,
        streak: c.myStreak || 0,
      })),
      updatedAt: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn("cloudPublishProfile error:", e);
    return false;
  }
}

// Ищет пользователя по точному никнейму (регистронезависимо)
export async function cloudFindByNickname(nickname) {
  if (!nickname) return null;
  try {
    const snap = await getDoc(doc(db, "userProfiles", nickname.toLowerCase().trim()));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("cloudFindByNickname error:", e);
    return null;
  }
}

// Возвращает список друзей из userData/{userKey}.friends
export async function cloudGetFriends(userKey) {
  if (!userKey) return [];
  try {
    const snap = await getDoc(doc(db, "userData", userKey));
    return snap.exists() ? (snap.data().friends || []) : [];
  } catch (e) {
    console.warn("cloudGetFriends error:", e);
    return [];
  }
}

// Добавляет друга (атомарно через merge)
export async function cloudAddFriend(userKey, friendData) {
  if (!userKey) return false;
  try {
    const snap = await getDoc(doc(db, "userData", userKey));
    const existing = snap.exists() ? (snap.data().friends || []) : [];
    if (existing.some(f => f.userKey === friendData.userKey)) return true; // уже есть
    await setDoc(doc(db, "userData", userKey), {
      friends: [...existing, { ...friendData, addedAt: Date.now() }],
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn("cloudAddFriend error:", e);
    return false;
  }
}

// Удаляет друга из списка
export async function cloudRemoveFriend(userKey, friendKey) {
  if (!userKey) return false;
  try {
    const snap = await getDoc(doc(db, "userData", userKey));
    const existing = snap.exists() ? (snap.data().friends || []) : [];
    await setDoc(doc(db, "userData", userKey), {
      friends: existing.filter(f => f.userKey !== friendKey),
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn("cloudRemoveFriend error:", e);
    return false;
  }
}

// Подписка на свежий профиль друга в реальном времени
export function cloudSubscribeFriendProfile(nickname, callback) {
  const ref = doc(db, "userProfiles", nickname.toLowerCase());
  return onSnapshot(ref,
    (snap) => { if (snap.exists()) callback(snap.data()); },
    (err)  => console.warn("cloudSubscribeFriendProfile error:", err)
  );
}
