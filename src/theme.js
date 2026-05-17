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
  bg0: "#FFFFFF", bg1: "#F0F0FA", bg2: "#E4E4F4", bg3: "#D8D8EE",
  brd: "#BEBEDD", brdDim: "#D0D0E8",
  gold: "#C47A0A", goldL: "#9A5E00", goldDim: "#FADA8A",
  purp: "#7C3AED", purpL: "#5B21B6", purpDim: "#EDE9FE",
  teal: "#059669", tealDim: "#A7F3D0",
  rose: "#E11D48", sky: "#0284C7",
  text: "#0F0F2A", sub: "#5050A0", dim: "#B0B0D0",
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
