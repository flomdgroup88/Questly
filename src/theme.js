// ─── SHARED THEME ─────────────────────────────────────────────────
// Single source of truth for all colours.
// Import this wherever T is needed — never redefine it locally.
//
// T is a mutable singleton. Call applyTheme(isDark) to switch themes —
// the next React render cycle will pick up the new values automatically.

const DARK = {
  bg0: "#07071C", bg1: "#0D0D28", bg2: "#13133A", bg3: "#1A1A4A",
  brd: "#252565", brdDim: "#1A1A48",
  gold: "#F5A623", goldL: "#FFD080", goldDim: "#8A5C0E",
  purp: "#8B5CF6", purpL: "#C4A5FF", purpDim: "#4C2A99",
  teal: "#06D6A0", tealDim: "#0A6648",
  rose: "#F43F5E", sky: "#38BDF8",
  dream: "#FF6B9D",
  text: "#EEEEFF", sub: "#8888BB", dim: "#3A3A6A",
  cs: "dark",
};

const LIGHT = {
  // ── Пергаментный манускрипт ──────────────────────────────────────
  // Фон — тёплый пергамент, как страницы древней книги квестов
  bg0: "#FDF8EF",      // кремовый пергамент — основной фон
  bg1: "#F5EDDA",      // слегка поджаренный пергамент — хедеры, навбары
  bg2: "#EAE0C8",      // состаренная бумага — карточки, поля
  bg3: "#DDD0AC",      // потемневший велень — чипы, бейджи
  brd: "#C4A86C",      // золотая окантовка — основная граница
  brdDim: "#D8C898",   // светло-золотая граница
  // Золото — тёплый насыщенный янтарь
  gold: "#BF7D0A",     // глубокий янтарь — XP, акценты
  goldL: "#E09412",    // яркое золото
  goldDim: "#FFF0CC",  // бледно-золотой фон
  // Пурпур — королевский, как чернила аристократа
  purp: "#7C3AED",     // яркий королевский пурпур — главный акцент
  purpL: "#5B21B6",    // глубокий пурпур — текст на светлом
  purpDim: "#EDE9FE",  // бледно-лавандовый фон
  // Прочие акценты — геральдические, насыщенные
  teal: "#047857",     // лесной изумруд
  tealDim: "#D1FAE5",  // бледно-мятный фон
  rose: "#DC2626",     // геральдический алый
  sky: "#1D4ED8",      // королевский синий
  dream: "#9D174D",    // глубокая малина — мечта
  // Текстовая иерархия — как чернила на пергаменте
  text: "#2C1A0A",     // глубокая тёмно-коричневая тушь — основной текст
  sub: "#7A5530",      // средне-коричневая тушь — вторичный текст
  dim: "#BFA070",      // выцветшие чернила — плейсхолдер, неактивное
  cs: "light",
};

// Mutable singleton — all components read from this object during render
export const T = { ...DARK };

const LS_THEME = "questly_theme";

export function applyTheme(isDark) {
  const colors = isDark ? DARK : LIGHT;
  Object.assign(T, colors);
  try { localStorage.setItem(LS_THEME, isDark ? "dark" : "light"); } catch {}
}

export function loadThemeIsDark() {
  try { return localStorage.getItem(LS_THEME) !== "light"; } catch { return true; }
}
