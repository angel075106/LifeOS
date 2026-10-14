import { expect, test } from "@playwright/test";
import {
  apiToken,
  cleanup,
  dayPanel,
  openCalendarOn,
  rest,
  runTag,
  signIn,
  supabaseKey,
  supabaseUrl,
  userA,
  userB,
} from "./support";

/**
 * Users must never read or change each other's data - not through the UI, and not by calling
 * the public Data API directly with someone else's record ids. These checks run against the
 * real RLS policies (emulator: the same migrations on Postgres; remote: your Supabase project).
 */
test.describe("data isolation between users", () => {
  let tag: string;
  let activityId: string;
  let transactionId: string;
  let tokenA: string;
  let tokenB: string;

  test.beforeEach(async () => {
    tag = runTag();
    tokenA = await apiToken(userA);
    tokenB = await apiToken(userB);

    const categories = await rest(tokenA, "activity_categories?select=id&limit=1");
    const financeCategories = await rest(tokenA, "finance_categories?select=id&kind=eq.expense&limit=1");
    const activityCategoryId = (categories.body as Array<{ id: string }>)[0].id;
    const expenseCategoryId = (financeCategories.body as Array<{ id: string }>)[0].id;
    const { sub } = JSON.parse(Buffer.from(tokenA.split(".")[1], "base64url").toString()) as { sub: string };

    const activity = await rest(tokenA, "activities", {
      method: "POST",
      body: JSON.stringify({
        user_id: sub,
        category_id: activityCategoryId,
        title: `${tag} private plans`,
        start_at: "2026-10-07T07:00:00Z",
        end_at: "2026-10-07T08:00:00Z",
      }),
    });
    expect(activity.status).toBe(201);
    activityId = (activity.body as Array<{ id: string }>)[0].id;

    const transaction = await rest(tokenA, "transactions", {
      method: "POST",
      body: JSON.stringify({
        user_id: sub,
        type: "expense",
        amount_minor: 4200,
        currency: "EUR",
        occurred_on: "2026-10-07",
        category_id: expenseCategoryId,
        description: `${tag} private purchase`,
      }),
    });
    expect(transaction.status).toBe(201);
    transactionId = (transaction.body as Array<{ id: string }>)[0].id;
  });

  test.afterEach(async () => {
    await cleanup(userA, tag);
  });

  test("another user cannot read records by id", async () => {
    expect((await rest(tokenB, `activities?id=eq.${activityId}`)).body).toEqual([]);
    expect((await rest(tokenB, `transactions?id=eq.${transactionId}`)).body).toEqual([]);
    const list = (await rest(tokenB, "activities?select=title")).body as Array<{ title: string }>;
    expect(list.some((row) => row.title.includes(tag))).toBe(false);
  });

  test("another user cannot update or delete records by id", async () => {
    const update = await rest(tokenB, `activities?id=eq.${activityId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "hijacked" }),
    });
    expect(update.body).toEqual([]);
    const remove = await rest(tokenB, `transactions?id=eq.${transactionId}`, { method: "DELETE" });
    expect(remove.body).toEqual([]);

    // Still intact for the owner.
    const own = (await rest(tokenA, `activities?id=eq.${activityId}`)).body as Array<{ title: string }>;
    expect(own[0].title).toBe(`${tag} private plans`);
    expect((await rest(tokenA, `transactions?id=eq.${transactionId}`)).body).toHaveLength(1);
  });

  test("another user cannot create rows owned by someone else", async () => {
    const { sub: ownerA } = JSON.parse(Buffer.from(tokenA.split(".")[1], "base64url").toString()) as { sub: string };
    const categories = (await rest(tokenB, "activity_categories?select=id&limit=1")).body as Array<{ id: string }>;
    const forged = await rest(tokenB, "activities", {
      method: "POST",
      body: JSON.stringify({
        user_id: ownerA,
        category_id: categories[0].id,
        title: `${tag} forged`,
        start_at: "2026-10-07T09:00:00Z",
        end_at: "2026-10-07T10:00:00Z",
      }),
    });
    expect([401, 403]).toContain(forged.status);
  });

  test("anonymous API callers get nothing", async () => {
    const response = await fetch(`${supabaseUrl}/rest/v1/activities?select=*`, { headers: { apikey: supabaseKey } });
    const body = (await response.json()) as unknown;
    // Either refused outright (no grants) or an empty result - never another user's rows.
    expect(Array.isArray(body) ? body : []).toEqual([]);
  });

  test("the other user's calendar and export do not show the records", async ({ page }) => {
    await signIn(page, userB);
    await openCalendarOn(page, "2026-10-07");
    await expect(dayPanel(page).getByText(`${tag} private plans`)).toHaveCount(0);
    await expect(dayPanel(page).getByText(`${tag} private purchase`)).toHaveCount(0);

    const csv = await page.request.get("/api/export/transactions?from=2026-10-01&to=2026-10-31");
    expect(csv.ok()).toBe(true);
    expect(await csv.text()).not.toContain(tag);
  });
});
