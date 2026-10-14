import { expect, test, type Page } from "@playwright/test";
import { signIn, userA } from "./support";

const DARK_CANVAS = "rgb(18, 18, 20)"; // #121214
const LIGHT_CANVAS = "rgb(246, 246, 244)"; // #f6f6f4

type ThemeWindow = Window & { __themeBeforeBody?: string | null };

/** Records <html data-theme> at the moment <body> is created, i.e. before any content can paint. */
async function recordThemeBeforeBody(page: Page) {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      (window as ThemeWindow).__themeBeforeBody = document.documentElement.getAttribute("data-theme");
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

const html = (page: Page) => page.locator("html");
const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("theme", () => {
  test("a chosen theme is saved and applied before the page paints on the next load", async ({ page }) => {
    await recordThemeBeforeBody(page);
    await page.emulateMedia({ colorScheme: "light" });
    await signIn(page, userA, "/settings");

    const themes = page.getByRole("group", { name: "Theme" });
    await expect(themes.getByRole("radio", { name: "System" })).toBeChecked();
    await themes.getByText("Dark", { exact: true }).click();
    await expect(themes.getByRole("radio", { name: "Dark" })).toBeChecked();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    expect(await bodyBackground(page)).toBe(DARK_CANVAS);
    expect(await page.evaluate(() => window.localStorage.getItem("lifeos-theme"))).toBe("dark");

    // The OS is still light: the saved choice must win, already before <body> exists.
    await page.reload();
    expect(await page.evaluate(() => (window as ThemeWindow).__themeBeforeBody)).toBe("dark");
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('meta[name="theme-color"][data-lifeos-theme-color]')).toHaveAttribute("content", "#121214");
    await expect(page.getByRole("group", { name: "Theme" }).getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  test("the theme selector works with the keyboard", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await signIn(page, userA, "/settings");
    const themes = page.getByRole("group", { name: "Theme" });

    await themes.getByRole("radio", { name: "System" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(themes.getByRole("radio", { name: "Dark" })).toBeChecked();
    await expect(themes.getByRole("radio", { name: "Dark" })).toBeFocused();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");

    await page.keyboard.press("ArrowLeft");
    await expect(themes.getByRole("radio", { name: "Light" })).toBeChecked();
    await expect(html(page)).toHaveAttribute("data-theme", "light");
    expect(await bodyBackground(page)).toBe(LIGHT_CANVAS);
  });

  test("System follows the operating system setting, also while the app is open", async ({ page }) => {
    await recordThemeBeforeBody(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await signIn(page, userA);
    expect(await page.evaluate(() => (window as ThemeWindow).__themeBeforeBody)).toBe("dark");
    await expect(html(page)).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveAttribute("data-theme", "light");
    expect(await bodyBackground(page)).toBe(LIGHT_CANVAS);
  });

  test("the sidebar theme menu switches and remembers the theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await signIn(page, userA);
    const sidebar = page.getByRole("complementary");

    await sidebar.getByRole("button", { name: "Theme: System" }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    await expect(sidebar.getByRole("button", { name: "Theme: Dark" })).toBeVisible();

    await page.goto("/finance");
    await expect(page.getByRole("heading", { level: 1, name: "Finance" })).toBeVisible();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");

    await sidebar.getByRole("button", { name: "Theme: Dark" }).click();
    await page.getByRole("menuitemradio", { name: "System" }).click();
    await expect(html(page)).toHaveAttribute("data-theme", "light");
  });
});
