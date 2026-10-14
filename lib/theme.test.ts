import { describe, expect, it } from "vitest";
import {
  parseThemePreference,
  resolveTheme,
  THEME_COLORS,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "./theme";

type FakeMeta = { name: string; content: string; attributes: Map<string, string> };

/** Runs the pre-paint script against minimal window/document stand-ins. */
function runInitScript({
  stored,
  prefersDark,
  storageThrows = false,
  matchMediaThrows = false,
}: {
  stored: string | null;
  prefersDark: boolean;
  storageThrows?: boolean;
  matchMediaThrows?: boolean;
}) {
  const rootAttributes = new Map<string, string>();
  const appended: FakeMeta[] = [];
  const fakeDocument = {
    documentElement: { setAttribute: (name: string, value: string) => rootAttributes.set(name, value) },
    createElement: (): FakeMeta & { setAttribute: (name: string, value: string) => void } => {
      const attributes = new Map<string, string>();
      return { name: "", content: "", attributes, setAttribute: (name, value) => attributes.set(name, value) };
    },
    head: { appendChild: (element: FakeMeta) => appended.push(element) },
  };
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => {
        if (storageThrows) throw new Error("storage blocked");
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    },
    matchMedia: () => {
      if (matchMediaThrows) throw new Error("unsupported");
      return { matches: prefersDark };
    },
  };
  new Function("window", "document", THEME_INIT_SCRIPT)(fakeWindow, fakeDocument);
  return {
    theme: rootAttributes.get("data-theme"),
    preference: rootAttributes.get("data-theme-preference"),
    meta: appended[0],
  };
}

describe("parseThemePreference", () => {
  it("keeps explicit choices and treats everything else as system", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    for (const value of ["system", null, undefined, "", "Dark", "neon", 1]) {
      expect(parseThemePreference(value)).toBe("system");
    }
  });
});

describe("resolveTheme", () => {
  it("follows the OS only when the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("theme init script", () => {
  it("follows the OS setting when nothing is stored", () => {
    expect(runInitScript({ stored: null, prefersDark: true })).toMatchObject({ theme: "dark", preference: "system" });
    expect(runInitScript({ stored: null, prefersDark: false })).toMatchObject({ theme: "light", preference: "system" });
  });

  it("applies a stored choice regardless of the OS setting", () => {
    expect(runInitScript({ stored: "light", prefersDark: true })).toMatchObject({ theme: "light", preference: "light" });
    expect(runInitScript({ stored: "dark", prefersDark: false })).toMatchObject({ theme: "dark", preference: "dark" });
  });

  it("ignores unknown stored values", () => {
    expect(runInitScript({ stored: "neon", prefersDark: true })).toMatchObject({ theme: "dark", preference: "system" });
  });

  it("falls back safely when storage or matchMedia are unavailable", () => {
    expect(runInitScript({ stored: "light", prefersDark: true, storageThrows: true })).toMatchObject({
      theme: "dark",
      preference: "system",
    });
    expect(runInitScript({ stored: null, prefersDark: true, matchMediaThrows: true })).toMatchObject({
      theme: "light",
      preference: "system",
    });
  });

  it("tints the browser UI to match the applied theme", () => {
    const { meta } = runInitScript({ stored: "dark", prefersDark: false });
    expect(meta.name).toBe("theme-color");
    expect(meta.content).toBe(THEME_COLORS.dark);
    expect(meta.attributes.has("data-lifeos-theme-color")).toBe(true);
    expect(runInitScript({ stored: null, prefersDark: false }).meta.content).toBe(THEME_COLORS.light);
  });
});
