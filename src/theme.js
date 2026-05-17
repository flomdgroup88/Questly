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
  text: "#EEEEFF", sub: "#8888BB", dim: "#3A3A6A",
  cs: "dark",
};

const LIGHT = {
  // Фон — тёплый фиолетово-белый с глубиной
  bg0: "#FBFAFF",      // почти белый с едва уловимым фиолетом — основной фон страницы
  bg1: "#F1EBFF",      // мягкий фиолет — хедеры, навбары, фон карточек
  bg2: "#E6DEFF",      // средний фиолет — внутренние карточки, поля
  bg3: "#D9CFFA",      // насыщенный фиолет — чипы, бейджи, внутренние элементы
  brd: "#BCAAE8",      // яркая лавандовая граница — хорошо видна!
  brdDim: "#CEC3F2",   // мягкая лавандовая граница
  // Золото — тёплый насыщенный янтарь
  gold: "#C9820E",     // богатый тёплый янтарь — XP, акценты
  goldL: "#E89B0E",    // яркий золотисто-янтарный
  goldDim: "#FEF3C7",  // бледно-золотой фон
  // Пурпур — насыщенный ярко-королевский
  purp: "#7C3AED",     // яркий королевский пурпур — главный акцент
  purpL: "#5B21B6",    // глубокий насыщенный пурпур — текст на светлом
  purpDim: "#EDE4FF",  // бледно-пурпурный фон
  // Прочие акценты — без мутности, как в тёмной теме
  teal: "#059669",     // яркий изумрудный
  tealDim: "#CCFBF1",  // бледно-бирюзовый фон
  rose: "#E11D48",     // яркая малиново-красная
  sky: "#0284C7",      // яркий лазурный
  // Текстовая иерархия
  text: "#1A0848",     // очень тёмный пурпурно-синий — богатый, не просто чёрный
  sub: "#6845B4",      // средний насыщенный пурпур — вторичный текст с характером
  dim: "#B8A8DC",      // приглушённый лаванд — плейсхолдер, неактивные элементы
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
