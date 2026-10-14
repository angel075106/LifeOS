import { expect, test } from "@playwright/test";
import { signIn, userA } from "./support";

test.describe("signing in", () => {
  test("signs in and lands on the calendar", async ({ page }) => {
    await signIn(page, userA);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByText(userA.email)).toBeVisible();
  });

  test("returns to the requested page after sign-in", async ({ page }) => {
    await signIn(page, userA, "/finance/budgets");
    await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible();
  });

  test("ignores an off-site return address (no open redirect)", async ({ page }) => {
    await page.goto(`/auth/login?next=${encodeURIComponent("https://evil.example/phish")}`);
    await page.getByRole("textbox", { name: "Email" }).fill(userA.email);
    await page.getByRole("textbox", { name: "Password" }).fill(userA.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/calendar/);
    expect(new URL(page.url()).hostname).not.toContain("evil");
  });

  test("signing out ends the session", async ({ page }) => {
    await signIn(page, userA);
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
