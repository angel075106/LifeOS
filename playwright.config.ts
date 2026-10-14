import { defineConfig, devices } from "@playwright/test";

/*
 * Browser tests.
 *   npm run test:e2e
 *     Starts the local Supabase emulator + Next.js dev server (fresh in-memory database)
 *     and runs every spec. Set E2E_PROD=1 to test a production build instead.
 *   E2E_BASE_URL=https://... npm run test:e2e
 *     Runs against an already running app backed by a REAL Supabase project. Requires
 *     E2E_USER_EMAIL/E2E_USER_PASSWORD and E2E_USER2_EMAIL/E2E_USER2_PASSWORD (dedicated test
 *     accounts) plus NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 *
 * On Windows the installed Microsoft Edge is used, so no browser download is needed. Set
 * PW_CHANNEL= (empty) to use Playwright's bundled Chromium (npx playwright install chromium).
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: fine for the local emulator mode.
}

const remote = Boolean(process.env.E2E_BASE_URL);
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const channel =
  process.env.PW_CHANNEL === undefined ? (process.platform === "win32" ? "msedge" : undefined) : process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    channel,
    locale: "en-GB",
    timezoneId: "Europe/Sofia",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /mobile\.spec\.ts/,
      use: { viewport: { width: 1366, height: 900 } },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      // iPhone 13 viewport, touch and user agent, rendered with Chromium/Edge.
      use: { ...devices["iPhone 13"], browserName: "chromium", channel },
    },
  ],
  webServer: remote
    ? undefined
    : {
        command: `node scripts/dev-local.mjs --memory${process.env.E2E_PROD ? " --prod" : ""}`,
        url: `${baseURL}/auth/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        env: { PORT: String(port), LOCAL_SUPABASE_PORT: process.env.LOCAL_SUPABASE_PORT ?? "54331" },
      },
});
