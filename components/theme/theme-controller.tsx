"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import {
  DARK_SCHEME_QUERY,
  parseThemePreference,
  resolveTheme,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

let currentPreference: ThemePreference | null = null;
const listeners = new Set<() => void>();

function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Storage blocked (privacy settings): the choice lasts for this page only.
    return "system";
  }
}

function getPreference(): ThemePreference {
  currentPreference ??= readStoredPreference();
  return currentPreference;
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_SCHEME_QUERY).matches;
  } catch {
    return false;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function subscribeSystem(listener: () => void) {
  const media = window.matchMedia(DARK_SCHEME_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** Puts the resolved theme on <html> and tints the browser UI to match. */
function applyTheme(preference: ThemePreference): ResolvedTheme {
  const theme = resolveTheme(preference, systemPrefersDark());
  const root = document.documentElement;
  if (root.getAttribute("data-theme") !== theme) {
    // Swap every color in one frame instead of animating each element's transition.
    root.setAttribute("data-theme-switching", "");
    root.setAttribute("data-theme", theme);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => root.removeAttribute("data-theme-switching")),
    );
  }
  root.setAttribute("data-theme-preference", preference);

  let meta = document.head.querySelector<HTMLMetaElement>("meta[data-lifeos-theme-color]");
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.setAttribute("data-lifeos-theme-color", "");
    document.head.appendChild(meta);
  }
  if (meta.content !== THEME_COLORS[theme]) meta.content = THEME_COLORS[theme];
  return theme;
}

export function setThemePreference(preference: ThemePreference): void {
  currentPreference = preference;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not persisted; still applied for this page.
  }
  applyTheme(preference);
  notify();
}

/** The saved preference ("system" until hydrated) and the theme currently shown. */
export function useTheme(): {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
} {
  const preference = useSyncExternalStore(subscribe, getPreference, () => "system" as const);
  const systemDark = useSyncExternalStore(subscribeSystem, systemPrefersDark, () => false);
  return { preference, resolvedTheme: resolveTheme(preference, systemDark), setPreference: setThemePreference };
}

/**
 * Keeps <html data-theme> in sync after the pre-paint script: follows OS changes while the
 * preference is "system", and changes made in other tabs. Renders nothing.
 */
export function ThemeSync() {
  // React's development remount resets <html> attributes; restore them before paint.
  useLayoutEffect(() => {
    applyTheme(getPreference());
  }, []);

  useEffect(() => {
    const media = window.matchMedia(DARK_SCHEME_QUERY);
    const onSystemChange = () => {
      if (getPreference() === "system") applyTheme("system");
      notify();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
      currentPreference = event.key === null ? "system" : parseThemePreference(event.newValue);
      applyTheme(currentPreference);
      notify();
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
