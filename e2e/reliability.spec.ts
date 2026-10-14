import { expect, test } from "@playwright/test";
import { apiToken, cleanup, dayPanel, openCalendarOn, rest, runTag, signIn, userA } from "./support";

test.describe("reliability and keyboard access", () => {
  let tag: string;

  test.beforeEach(async ({ page }) => {
    tag = runTag();
    await signIn(page, userA);
  });

  test.afterEach(async () => {
    await cleanup(userA, tag);
  });

  test("a rapid double click on Save creates exactly one record", async ({ page }) => {
    await openCalendarOn(page, "2026-10-08");
    await dayPanel(page).getByRole("button", { name: "Expense", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Amount" }).fill("7.50");
    await dialog.getByRole("textbox", { name: "Description or merchant" }).fill(`${tag} coffee`);
    await dialog.getByRole("button", { name: "Save expense" }).dblclick();
    await expect(dialog).toHaveCount(0);

    const token = await apiToken(userA);
    const rows = (await rest(token, `transactions?select=id&description=like.*${tag}*`)).body as unknown[];
    expect(rows).toHaveLength(1);
    await expect(dayPanel(page).getByRole("button", { name: new RegExp(`${tag} coffee`) })).toHaveCount(1);
  });

  test("the month grid supports arrow-key navigation", async ({ page }) => {
    await openCalendarOn(page, "2026-10-14");
    const selected = page.getByRole("gridcell").getByRole("button", { name: /14 October 2026/ });
    await selected.focus();

    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/date=2026-10-15/);
    await expect(page.getByRole("button", { name: /15 October 2026.*selected/ })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/date=2026-10-22/);

    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(/date=2026-11-22/);
    await expect(page.getByRole("heading", { level: 1, name: "November 2026" })).toBeVisible();
    await expect(page.getByRole("button", { name: /22 November 2026.*selected/ })).toBeFocused();
  });
});
