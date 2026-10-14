import { isRemote, supabaseKey, supabaseUrl, userA, userB } from "./support";

/**
 * Local mode: creates the two test accounts in the emulator (sign-up auto-confirms there).
 * Remote mode: the accounts must already exist; only the configuration is checked.
 */
export default async function globalSetup(): Promise<void> {
  if (isRemote) {
    const missing = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "E2E_USER_EMAIL",
      "E2E_USER_PASSWORD",
      "E2E_USER2_EMAIL",
      "E2E_USER2_PASSWORD",
    ].filter((name) => !process.env[name]);
    if (missing.length > 0) throw new Error(`Remote E2E run is missing: ${missing.join(", ")}`);
    return;
  }

  for (const user of [userA, userB]) {
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify({ ...user, data: { timezone: "Europe/Sofia" } }),
    });
    // 422 = already registered (e.g. a reused dev server): that's fine.
    if (!response.ok && response.status !== 422) {
      throw new Error(`Could not create test user ${user.email}: HTTP ${response.status}`);
    }
  }
}
