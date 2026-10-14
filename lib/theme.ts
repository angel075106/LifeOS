/**
 * Theme preference shared by the pre-paint script (app/layout.tsx) and the client controller.
 * The preference is stored per device in localStorage; "system" follows the OS setting.
 */

export const THEME_STORAGE_KEY = "lifeos-theme";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

/** Browser UI tint (address bar, status bar) for each theme: the app canvas color. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#f6f6f4", dark: "#121214" };

export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/**
 * Runs synchronously in <head> before the body is parsed, so the first paint already uses
 * the right theme. Kept in ES5 with every step guarded: if storage or matchMedia is
 * unavailable it falls back to the system setting, then to light.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,p="system",t;try{var s=window.localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(s==="light"||s==="dark")p=s}catch(e){}if(p==="system"){try{t=window.matchMedia(${JSON.stringify(
  DARK_SCHEME_QUERY,
)}).matches?"dark":"light"}catch(e){t="light"}}else{t=p}d.setAttribute("data-theme",t);d.setAttribute("data-theme-preference",p);try{var m=document.createElement("meta");m.name="theme-color";m.content=t==="dark"?${JSON.stringify(
  THEME_COLORS.dark,
)}:${JSON.stringify(THEME_COLORS.light)};m.setAttribute("data-lifeos-theme-color","");document.head.appendChild(m)}catch(e){}})();`;
