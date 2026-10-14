import { expect, test, type Page } from "@playwright/test";
import { dayPanel, signIn, userA } from "./support";

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(0);
}

test.describe("iPhone-sized screen", () => {
  test("every screen fits without horizontal scrolling", async ({ page }) => {
    await page.goto("/auth/login");
    await expectNoHorizontalOverflow(page, "/auth/login");

    await signIn(page, userA);
    for (const path of [
      "/calendar?view=month&date=2026-10-14",
      "/calendar?view=week&date=2026-10-14",
      "/calendar?view=day&date=2026-10-14",
      "/activities",
      "/finance",
      "/finance/transactions",
      "/finance/budgets",
      "/stats",
      "/settings",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page, path);
    }
  });

  test("bottom navigation and the entry dialog work on a phone", async ({ page }) => {
    await signIn(page, userA);
    const nav = page.getByRole("navigation", { name: "Primary" }).last();
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Finance" }).tap();
    await expect(page).toHaveURL(/\/finance$/);
    await nav.getByRole("link", { name: "Calendar" }).tap();
    await expect(page).toHaveURL(/\/calendar/);

    await dayPanel(page).getByRole("button", { name: "Expense", exact: true }).tap();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.width <= viewport.width).toBe(true);
    await expect(dialog.getByRole("textbox", { name: "Amount" })).toHaveAttribute("inputmode", "decimal");
    await dialog.getByRole("button", { name: "Close" }).tap();
    await expect(dialog).toHaveCount(0);
  });
});
