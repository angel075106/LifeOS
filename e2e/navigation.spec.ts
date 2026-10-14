import { expect, test, type Page } from "@playwright/test";
import { signIn, userA } from "./support";

/** Collects uncaught exceptions and React hydration errors (WebSocket noise is ignored). */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|did not match|minified react error/i.test(message.text())) {
      errors.push(`console: ${message.text().slice(0, 300)}`);
    }
  });
  return errors;
}

const SCREENS = [
  { link: "Activities", path: "/activities", heading: "Activities" },
  { link: "Finance", path: "/finance", heading: "Finance" },
  { link: "Stats", path: "/stats", heading: "Statistics" },
  { link: "Settings", path: "/settings", heading: "Settings" },
] as const;

test.describe("navigation", () => {
  test("the sidebar reaches every screen and stays there", async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, userA);
    const sidebar = page.getByRole("navigation", { name: "Primary" }).first();

    for (const screen of SCREENS) {
      await sidebar.getByRole("link", { name: screen.link }).click();
      await expect(page).toHaveURL(new RegExp(`${screen.path}$`));
      await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
      await expect(sidebar.getByRole("link", { name: screen.link })).toHaveAttribute("aria-current", "page");
    }
    await sidebar.getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.getByRole("grid")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("every screen renders on a direct load without hydration errors", async ({ page }) => {
    const errors = trackErrors(page);
    await signIn(page, userA);
    for (const screen of [...SCREENS, { path: "/finance/transactions", heading: "Transactions" }, { path: "/finance/budgets", heading: "Budgets" }]) {
      await page.goto(screen.path);
      await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
      // Still on the requested page after hydration and data loading settle.
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(`${screen.path}$`));
    }
    expect(errors).toEqual([]);
  });
});
