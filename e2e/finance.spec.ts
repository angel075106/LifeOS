import { expect, test, type Page } from "@playwright/test";
import { cleanup, dayPanel, openCalendarOn, runTag, signIn, userA } from "./support";

const DATE = "2026-10-05";

async function addTransaction(
  page: Page,
  type: "Income" | "Expense",
  fields: { amount: string; category: string; description: string },
) {
  await dayPanel(page).getByRole("button", { name: type, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `New ${type.toLowerCase()}` })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Amount" }).fill(fields.amount);
  await dialog.getByRole("combobox", { name: "Category" }).selectOption({ label: fields.category });
  await dialog.getByRole("textbox", { name: "Description or merchant" }).fill(fields.description);
  await dialog.getByRole("button", { name: `Save ${type.toLowerCase()}` }).click();
  await expect(page.getByRole("status").filter({ hasText: `${type} saved` })).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

test.describe("finance", () => {
  let tag: string;

  test.beforeEach(async ({ page }) => {
    tag = runTag();
    await signIn(page, userA);
  });

  test.afterEach(async () => {
    await cleanup(userA, tag);
  });

  test("records income with a comma decimal and shows it on the calendar date", async ({ page }) => {
    await openCalendarOn(page, DATE);
    await addTransaction(page, "Income", { amount: "1 250,50", category: "Salary", description: `${tag} October salary` });

    const panel = dayPanel(page);
    const row = panel.getByRole("button", { name: new RegExp(`Edit income: ${tag} October salary`) });
    await expect(row).toBeVisible();
    await expect(row.getByLabel("income €1,250.50")).toBeVisible();
    await expect(panel.getByLabel("income €1,250.50").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Monday, 5 October 2026.*income €1,250\.50/ })).toBeVisible();

    await page.reload();
    await expect(dayPanel(page).getByRole("button", { name: new RegExp(`Edit income: ${tag} October salary`) })).toBeVisible();
  });

  test("creates an expense, deletes it after confirmation, and totals update", async ({ page }) => {
    await openCalendarOn(page, DATE);
    await addTransaction(page, "Expense", { amount: "12.34", category: "Groceries", description: `${tag} Corner shop` });

    const panel = dayPanel(page);
    const row = panel.getByRole("button", { name: new RegExp(`Edit expense: ${tag} Corner shop`) });
    await expect(row).toBeVisible();
    await expect(row.getByLabel("expense €12.34")).toBeVisible();

    await row.click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("€12.34");
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Transaction deleted" })).toBeVisible();

    await expect(panel.getByRole("button", { name: new RegExp(`Edit expense: ${tag} Corner shop`) })).toHaveCount(0);
    await page.reload();
    await expect(dayPanel(page).getByRole("button", { name: new RegExp(`Edit expense: ${tag} Corner shop`) })).toHaveCount(0);
  });

  test("rejects invalid amounts before saving", async ({ page }) => {
    await openCalendarOn(page, DATE);
    await dayPanel(page).getByRole("button", { name: "Expense", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Amount" }).fill("12.345");
    await dialog.getByRole("button", { name: "Save expense" }).click();
    await expect(dialog.getByText("Use at most 2 decimal places")).toBeVisible();
    await dialog.getByRole("textbox", { name: "Amount" }).fill("-4");
    await dialog.getByRole("button", { name: "Save expense" }).click();
    await expect(dialog.getByText("Enter the amount without a sign")).toBeVisible();
  });

  test("finance overview keeps totals per currency", async ({ page }) => {
    await openCalendarOn(page, DATE);
    await addTransaction(page, "Income", { amount: "100", category: "Freelance", description: `${tag} invoice` });
    await dayPanel(page).getByRole("button", { name: "Expense", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Amount" }).fill("50");
    await dialog.getByRole("combobox", { name: "Currency" }).selectOption("BGN");
    await dialog.getByRole("combobox", { name: "Category" }).selectOption({ label: "Dining" });
    await dialog.getByRole("textbox", { name: "Description or merchant" }).fill(`${tag} dinner`);
    await dialog.getByRole("button", { name: "Save expense" }).click();
    await expect(dialog).toHaveCount(0);

    await page.goto("/finance?month=2026-10");
    await expect(page.getByRole("definition").filter({ hasText: /€/ }).first()).toBeVisible();
    // Separate EUR and BGN rows - never one mixed total.
    await expect(page.getByLabel("EUR totals")).toBeVisible();
    await expect(page.getByLabel("BGN totals")).toBeVisible();
  });
});
