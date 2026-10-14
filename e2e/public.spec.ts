import { expect, test } from "@playwright/test";

test.describe("signed-out visitors", () => {
  test("private pages redirect to sign-in and keep a safe return path", async ({ page }) => {
    await page.goto("/finance/transactions");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Ffinance%2Ftransactions$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("the root sends visitors through the calendar to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test("private APIs refuse anonymous requests", async ({ request }) => {
    for (const path of ["/api/export/transactions", "/api/export/activities"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(401);
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
  });

  test("wrong credentials show an error and do not sign in", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "Email" }).fill("nobody@lifeos.test");
    await page.getByRole("textbox", { name: "Password" }).fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    // (Next.js' route announcer is also role="alert", so match the form error by text.)
    await expect(page.getByRole("alert").filter({ hasText: /invalid login credentials/i })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("an unreachable sign-in service shows an error instead of doing nothing", async ({ page }) => {
    // The request is aborted in the browser, so nothing reaches any auth server.
    let attempts = 0;
    await page.route(/\/auth\/v1\/token/, (route) => {
      attempts += 1;
      return route.abort("connectionrefused");
    });
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "Email" }).fill("nobody@lifeos.test");
    await page.getByRole("textbox", { name: "Password" }).fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert").filter({ hasText: /can't reach the authentication service/i })).toBeVisible();
    expect(attempts).toBe(1);
    // Handled by the app: no plain form submission (which would reload to "/auth/login?").
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
    await expect(page.getByRole("textbox", { name: "Password" })).toHaveValue("definitely-wrong");
  });

  test("auth error page never echoes text from the URL", async ({ page }) => {
    await page.goto("/auth/error?reason=Your%20account%20is%20locked.%20Call%20555-0100");
    await expect(page.getByText("Call 555-0100")).toHaveCount(0);
    await expect(page.getByText(/something went wrong while signing you in/i)).toBeVisible();
  });
});

test.describe("PWA and security headers", () => {
  test("serves a valid web app manifest", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    expect(manifest.short_name).toBe("LifeOS");
    expect(manifest.start_url).toBe("/calendar");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const image = await request.get(icon.src);
      expect(image.ok(), icon.src).toBe(true);
      expect(image.headers()["content-type"]).toContain("image/png");
    }
  });

  test("service worker and offline page are public and the worker is never cached", async ({ request }) => {
    const worker = await request.get("/sw.js");
    expect(worker.ok()).toBe(true);
    expect(worker.headers()["cache-control"]).toContain("no-store");
    expect(await worker.text()).not.toContain("caches.put");
    const offline = await request.get("/offline.html");
    expect(offline.ok()).toBe(true);
    expect(await offline.text()).toContain("LifeOS is offline");
  });

  test("sends security headers", async ({ request }) => {
    const response = await request.get("/auth/login");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
