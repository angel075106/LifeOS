import { expect, test } from "@playwright/test";
import { signIn, userA } from "./support";

/*
 * LifeOS opened the way a phone on the same network opens it: through this computer's network
 * address, over plain HTTP, so the page is neither localhost nor a secure context (see the
 * "lan" project in playwright.config.ts). In development, Next.js blocks its hot-reload
 * connection for hosts it does not allow; the page then never starts its JavaScript and
 * "Sign in" only reloads the page (fixed by allowedDevOrigins in next.config.ts).
 */
test.describe("opened from another device on the network", () => {
  test("signing in works", async ({ page }) => {
    await page.goto("/auth/login");
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
    expect(new URL(page.url()).hostname).not.toBe("localhost");

    await signIn(page, userA);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("a sign-in service this device cannot reach is explained, not silently ignored", async ({ page }) => {
    // The browser tests use the local emulator on 127.0.0.1, which a real phone could never
    // reach. The request is aborted here to show what such a device sees.
    await page.route(/\/auth\/v1\/token/, (route) => route.abort("connectionrefused"));
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "Email" }).fill(userA.email);
    await page.getByRole("textbox", { name: "Password" }).fill(userA.password);
    await page.getByRole("button", { name: "Sign in" }).tap();

    await expect(page.getByRole("alert").filter({ hasText: /local test database/i })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
