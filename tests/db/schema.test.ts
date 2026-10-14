import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createAuthUser, createTestDb, pgErrorCode, type Db } from "./harness";

const ALICE = "0a11ce00-0000-4000-8000-000000000001";
const BOB = "0b0b0000-0000-4000-8000-000000000002";

let db: Db;

async function categoryId(table: "activity_categories" | "finance_categories", userId: string, name: string) {
  const { rows } = await db.query<{ id: string }>(
    `select id from public.${table} where user_id = $1 and name = $2`,
    [userId, name],
  );
  if (!rows[0]) throw new Error(`No ${table} row ${name} for ${userId}`);
  return rows[0].id;
}

async function insertActivity(userId: string, categoryIdValue: string, title = "Morning run") {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.activities (user_id, category_id, title, start_at, end_at)
     values ($1, $2, $3, '2026-10-14T06:00:00Z', '2026-10-14T07:00:00Z') returning id`,
    [userId, categoryIdValue, title],
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await createTestDb();
  await createAuthUser(db, ALICE, "alice@example.test", { timezone: "Europe/Sofia" });
  await createAuthUser(db, BOB, "bob@example.test", { timezone: "x'; drop table public.profiles; --" });
});

describe("new user bootstrap", () => {
  it("creates a profile with defaults and the sign-up time zone", async () => {
    const { rows } = await db.query(
      "select currency, timezone, default_calendar_view, week_starts_on from public.profiles where id = $1",
      [ALICE],
    );
    expect(rows).toEqual([
      { currency: "EUR", timezone: "Europe/Sofia", default_calendar_view: "month", week_starts_on: 1 },
    ]);
  });

  it("falls back to UTC when sign-up metadata carries a malformed time zone", async () => {
    const { rows } = await db.query<{ timezone: string }>("select timezone from public.profiles where id = $1", [BOB]);
    expect(rows[0].timezone).toBe("UTC");
  });

  it("seeds the default activity categories", async () => {
    const { rows } = await db.query<{ name: string }>(
      "select name from public.activity_categories where user_id = $1 order by sort_order",
      [ALICE],
    );
    expect(rows.map((row) => row.name)).toEqual([
      "Training",
      "Running",
      "Work",
      "Study",
      "Coding",
      "Personal",
      "Sleep",
    ]);
  });

  it("seeds income and expense finance categories", async () => {
    const { rows } = await db.query<{ kind: string; count: number }>(
      "select kind, count(*)::int as count from public.finance_categories where user_id = $1 group by kind order by kind",
      [ALICE],
    );
    expect(rows).toEqual([
      { kind: "expense", count: 10 },
      { kind: "income", count: 4 },
    ]);
  });

  it("bootstrap_current_user is idempotent and never resurrects deleted defaults", async () => {
    await asUser(db, BOB, async () => {
      await db.query("delete from public.activity_categories where name = 'Sleep'");
      await db.query("select public.bootstrap_current_user()");
      await db.query("select public.bootstrap_current_user()");
      const { rows } = await db.query<{ count: number }>("select count(*)::int as count from public.activity_categories");
      expect(rows[0].count).toBe(6);
    });
  });

  it("bootstrap_current_user is not callable anonymously", async () => {
    const code = await asAnon(db, () => pgErrorCode(db.query("select public.bootstrap_current_user()")));
    expect(code).toBe("42501");
  });
});

describe("row level security and ownership", () => {
  let aliceActivity: string;
  let bobActivity: string;

  beforeAll(async () => {
    aliceActivity = await insertActivity(ALICE, await categoryId("activity_categories", ALICE, "Running"), "Alice run");
    bobActivity = await insertActivity(BOB, await categoryId("activity_categories", BOB, "Work"), "Bob work");
  });

  it("users only see their own rows", async () => {
    const titles = await asUser(db, ALICE, async () => {
      const { rows } = await db.query<{ title: string }>("select title from public.activities");
      return rows.map((row) => row.title);
    });
    expect(titles).toEqual(["Alice run"]);
  });

  it("cannot read another user's record by guessing its id", async () => {
    const rows = await asUser(db, ALICE, async () =>
      (await db.query("select * from public.activities where id = $1", [bobActivity])).rows,
    );
    expect(rows).toEqual([]);
  });

  it("cannot update or delete another user's records", async () => {
    await asUser(db, ALICE, async () => {
      const updated = await db.query("update public.activities set title = 'pwned' where id = $1 returning id", [
        bobActivity,
      ]);
      const deleted = await db.query("delete from public.activities where id = $1 returning id", [bobActivity]);
      expect(updated.rows).toEqual([]);
      expect(deleted.rows).toEqual([]);
    });
    const { rows } = await db.query<{ title: string }>("select title from public.activities where id = $1", [
      bobActivity,
    ]);
    expect(rows[0].title).toBe("Bob work");
  });

  it("cannot insert rows owned by another user", async () => {
    const bobCategory = await categoryId("activity_categories", BOB, "Work");
    const code = await asUser(db, ALICE, () =>
      pgErrorCode(
        db.query(
          `insert into public.activities (user_id, category_id, title, start_at, end_at)
           values ($1, $2, 'forged', now(), now() + interval '1 hour')`,
          [BOB, bobCategory],
        ),
      ),
    );
    expect(code).toBe("42501");
  });

  it("cannot move a row to another user", async () => {
    const code = await asUser(db, ALICE, () =>
      pgErrorCode(db.query("update public.activities set user_id = $1 where id = $2", [BOB, aliceActivity])),
    );
    // user_id is not in the column-level UPDATE grant.
    expect(code).toBe("42501");
  });

  it("cannot reference another user's category, even with a known id", async () => {
    const bobCategory = await categoryId("activity_categories", BOB, "Work");
    const insertCode = await asUser(db, ALICE, () =>
      pgErrorCode(
        db.query(
          `insert into public.activities (user_id, category_id, title, start_at, end_at)
           values ($1, $2, 'sneaky', now(), now() + interval '1 hour')`,
          [ALICE, bobCategory],
        ),
      ),
    );
    const updateCode = await asUser(db, ALICE, () =>
      pgErrorCode(db.query("update public.activities set category_id = $1 where id = $2", [bobCategory, aliceActivity])),
    );
    expect(insertCode).toBe("23503");
    expect(updateCode).toBe("23503");
  });

  it("cannot read or change another user's profile, or its own id", async () => {
    await asUser(db, ALICE, async () => {
      expect((await db.query("select id from public.profiles")).rows).toEqual([{ id: ALICE }]);
      const updated = await db.query("update public.profiles set currency = 'BGN' where id = $1 returning id", [BOB]);
      expect(updated.rows).toEqual([]);
      expect(await pgErrorCode(db.query("update public.profiles set id = $1 where id = $2", [BOB, ALICE]))).toBe(
        "42501",
      );
    });
  });

  it("gives the anon role no access to any LifeOS table", async () => {
    for (const table of [
      "profiles",
      "activity_categories",
      "activities",
      "finance_categories",
      "transactions",
      "budgets",
    ]) {
      const code = await asAnon(db, () => pgErrorCode(db.query(`select 1 from public.${table} limit 1`)));
      expect(code, table).toBe("42501");
    }
  });

  it("isolates transactions and budgets the same way", async () => {
    const aliceExpense = await categoryId("finance_categories", ALICE, "Groceries");
    await asUser(db, ALICE, async () => {
      await db.query(
        `insert into public.transactions (user_id, type, amount_minor, currency, occurred_on, category_id)
         values ($1, 'expense', 1250, 'EUR', '2026-10-14', $2)`,
        [ALICE, aliceExpense],
      );
      await db.query(
        `insert into public.budgets (user_id, category_id, month, currency, amount_minor)
         values ($1, $2, '2026-10-01', 'EUR', 40000)`,
        [ALICE, aliceExpense],
      );
    });
    await asUser(db, BOB, async () => {
      expect((await db.query("select * from public.transactions")).rows).toEqual([]);
      expect((await db.query("select * from public.budgets")).rows).toEqual([]);
      expect((await db.query("delete from public.transactions returning id")).rows).toEqual([]);
    });
  });
});

describe("integrity constraints", () => {
  it("rejects non-positive and oversized amounts", async () => {
    const expense = await categoryId("finance_categories", ALICE, "Dining");
    for (const amount of [0, -100, 10_000_000_000]) {
      const code = await asUser(db, ALICE, () =>
        pgErrorCode(
          db.query(
            `insert into public.transactions (user_id, type, amount_minor, currency, occurred_on, category_id)
             values ($1, 'expense', $2, 'EUR', '2026-10-14', $3)`,
            [ALICE, amount, expense],
          ),
        ),
      );
      expect(code, String(amount)).toBe("23514");
    }
  });

  it("rejects unsupported currencies", async () => {
    const expense = await categoryId("finance_categories", ALICE, "Dining");
    const code = await asUser(db, ALICE, () =>
      pgErrorCode(
        db.query(
          `insert into public.transactions (user_id, type, amount_minor, currency, occurred_on, category_id)
           values ($1, 'expense', 100, 'USD', '2026-10-14', $2)`,
          [ALICE, expense],
        ),
      ),
    );
    expect(code).toBe("23514");
  });

  it("requires the category kind to match the transaction type", async () => {
    const income = await categoryId("finance_categories", ALICE, "Salary");
    const code = await asUser(db, ALICE, () =>
      pgErrorCode(
        db.query(
          `insert into public.transactions (user_id, type, amount_minor, currency, occurred_on, category_id)
           values ($1, 'expense', 100, 'EUR', '2026-10-14', $2)`,
          [ALICE, income],
        ),
      ),
    );
    expect(code).toBe("23503");
  });

  it("rejects activities that end before they start or last longer than 24 hours", async () => {
    const category = await categoryId("activity_categories", ALICE, "Work");
    const insert = (start: string, end: string) =>
      asUser(db, ALICE, () =>
        pgErrorCode(
          db.query(
            `insert into public.activities (user_id, category_id, title, start_at, end_at)
             values ($1, $2, 'bad', $3, $4)`,
            [ALICE, category, start, end],
          ),
        ),
      );
    expect(await insert("2026-10-14T10:00:00Z", "2026-10-14T10:00:00Z")).toBe("23514");
    expect(await insert("2026-10-14T10:00:00Z", "2026-10-14T09:00:00Z")).toBe("23514");
    expect(await insert("2026-10-14T10:00:00Z", "2026-10-15T10:00:01Z")).toBe("23514");
  });

  it("accepts an activity of exactly 24 hours", async () => {
    const category = await categoryId("activity_categories", ALICE, "Work");
    await asUser(db, ALICE, () =>
      db.query(
        `insert into public.activities (user_id, category_id, title, start_at, end_at)
         values ($1, $2, 'Long shift', '2026-10-10T00:00:00Z', '2026-10-11T00:00:00Z')`,
        [ALICE, category],
      ),
    );
  });

  it("only allows budgets on expense categories, for the first day of a month", async () => {
    const income = await categoryId("finance_categories", ALICE, "Salary");
    const expense = await categoryId("finance_categories", ALICE, "Housing");
    const insert = (category: string, month: string) =>
      asUser(db, ALICE, () =>
        pgErrorCode(
          db.query(
            `insert into public.budgets (user_id, category_id, month, currency, amount_minor)
             values ($1, $2, $3, 'EUR', 1000)`,
            [ALICE, category, month],
          ),
        ),
      );
    expect(await insert(income, "2026-10-01")).toBe("23503");
    expect(await insert(expense, "2026-10-15")).toBe("23514");
  });

  it("keeps category names unique per user, ignoring case", async () => {
    const code = await asUser(db, ALICE, () =>
      pgErrorCode(
        db.query("insert into public.activity_categories (user_id, name, color) values ($1, 'running', '#ffffff')", [
          ALICE,
        ]),
      ),
    );
    expect(code).toBe("23505");
    // Another user may use the same name.
    await asUser(db, BOB, () =>
      db.query("insert into public.activity_categories (user_id, name, color) values ($1, 'Running club', '#ffffff')", [
        BOB,
      ]),
    );
  });

  it("maintains created_at and updated_at on the server", async () => {
    const category = await categoryId("activity_categories", ALICE, "Study");
    const { rows } = await asUser(db, ALICE, () =>
      db.query<{ id: string; created_at: Date }>(
        `insert into public.activities (user_id, category_id, title, start_at, end_at, created_at)
         values ($1, $2, 'Backdated?', '2026-10-01T08:00:00Z', '2026-10-01T09:00:00Z', '2000-01-01')
         returning id, created_at`,
        [ALICE, category],
      ),
    );
    expect(rows[0].created_at.getUTCFullYear()).toBeGreaterThan(2000);
    // created_at is not part of the UPDATE grant, so it cannot be rewritten later either.
    const code = await asUser(db, ALICE, () =>
      pgErrorCode(db.query("update public.activities set created_at = '2000-01-01' where id = $1", [rows[0].id])),
    );
    expect(code).toBe("42501");
  });
});

describe("rpc functions", () => {
  it("refuses to delete a category that is still in use without a replacement", async () => {
    const running = await categoryId("activity_categories", ALICE, "Running");
    const code = await asUser(db, ALICE, () =>
      pgErrorCode(db.query("select public.delete_activity_category($1)", [running])),
    );
    // ON DELETE RESTRICT reports restrict_violation.
    expect(code).toBe("23001");
  });

  it("moves activities to the replacement and deletes the category atomically", async () => {
    const running = await categoryId("activity_categories", ALICE, "Running");
    const training = await categoryId("activity_categories", ALICE, "Training");
    await asUser(db, ALICE, async () => {
      await db.query("select public.delete_activity_category($1, $2)", [running, training]);
      const { rows } = await db.query<{ category_id: string }>(
        "select category_id from public.activities where title = 'Alice run'",
      );
      expect(rows).toEqual([{ category_id: training }]);
      expect((await db.query("select 1 from public.activity_categories where id = $1", [running])).rows).toEqual([]);
    });
  });

  it("cannot delete or borrow another user's category through the RPC", async () => {
    const bobWork = await categoryId("activity_categories", BOB, "Work");
    const aliceWork = await categoryId("activity_categories", ALICE, "Work");
    const aliceCoding = await categoryId("activity_categories", ALICE, "Coding");
    expect(
      await asUser(db, ALICE, () => pgErrorCode(db.query("select public.delete_activity_category($1)", [bobWork]))),
    ).toBe("P0002");
    expect(
      await asUser(db, ALICE, () =>
        pgErrorCode(db.query("select public.delete_activity_category($1, $2)", [aliceCoding, bobWork])),
      ),
    ).toBe("P0002");
    // Nothing changed for Bob.
    expect((await db.query("select 1 from public.activity_categories where id = $1", [bobWork])).rows).toHaveLength(1);
    expect(aliceWork).not.toBe(bobWork);
  });

  it("requires a finance replacement of the same kind", async () => {
    const dining = await categoryId("finance_categories", ALICE, "Dining");
    const salary = await categoryId("finance_categories", ALICE, "Salary");
    const code = await asUser(db, ALICE, () =>
      pgErrorCode(db.query("select public.delete_finance_category($1, $2)", [dining, salary])),
    );
    expect(code).toBe("22023");
  });

  it("upsert_budget creates and then updates a single budget row", async () => {
    const groceries = await categoryId("finance_categories", ALICE, "Groceries");
    await asUser(db, ALICE, async () => {
      await db.query("select public.upsert_budget($1, '2026-11-01', 'EUR', 30000)", [groceries]);
      await db.query("select public.upsert_budget($1, '2026-11-01', 'EUR', 35000)", [groceries]);
      const { rows } = await db.query<{ amount_minor: string }>(
        "select amount_minor::text from public.budgets where category_id = $1 and month = '2026-11-01'",
        [groceries],
      );
      expect(rows).toEqual([{ amount_minor: "35000" }]);
    });
  });

  it("copy_budgets copies into a new month and keeps existing target budgets", async () => {
    const groceries = await categoryId("finance_categories", ALICE, "Groceries");
    await asUser(db, ALICE, async () => {
      await db.query("select public.upsert_budget($1, '2026-12-01', 'EUR', 99900)", [groceries]);
      const { rows } = await db.query<{ copied: number }>(
        "select public.copy_budgets('2026-10-01', '2026-12-01') as copied",
      );
      // October's Groceries budget already exists in December, so nothing is overwritten.
      expect(rows[0].copied).toBe(0);
      const dec = await db.query<{ amount_minor: string }>(
        "select amount_minor::text from public.budgets where month = '2026-12-01'",
      );
      expect(dec.rows).toEqual([{ amount_minor: "99900" }]);
      const jan = await db.query<{ copied: number }>("select public.copy_budgets('2026-10-01', '2027-01-01') as copied");
      expect(jan.rows[0].copied).toBe(1);
    });
  });
});

describe("realtime broadcast", () => {
  it("publishes a data-free notification on the owner's private topic", async () => {
    await db.exec("delete from realtime.messages");
    const category = await categoryId("activity_categories", ALICE, "Personal");
    await insertActivity(ALICE, category, "Secret title");
    const { rows } = await db.query<{ topic: string; event: string; payload: unknown; private: boolean }>(
      "select topic, event, payload, private from realtime.messages",
    );
    expect(rows).toEqual([
      { topic: `user:${ALICE}`, event: "db_change", payload: { table: "activities", op: "insert" }, private: true },
    ]);
  });

  it("authorizes joining only the user's own private topic", async () => {
    // Supabase Realtime authorizes a channel join by evaluating the realtime.messages
    // SELECT policy with realtime.topic() set to the requested topic.
    await db.exec("delete from realtime.messages");
    await db.query("select realtime.send('{}'::jsonb, 'db_change', $1, true)", [`user:${ALICE}`]);

    const canJoin = async (userId: string, topic: string) =>
      asUser(db, userId, async () => {
        await db.query("select set_config('realtime.topic', $1, false)", [topic]);
        const { rows } = await db.query("select 1 from realtime.messages");
        await db.query("select set_config('realtime.topic', '', false)");
        return rows.length > 0;
      });

    expect(await canJoin(ALICE, `user:${ALICE}`)).toBe(true);
    expect(await canJoin(ALICE, `user:${BOB}`)).toBe(false);
    expect(await canJoin(BOB, `user:${ALICE}`)).toBe(false);
  });

  it("never fails a write when Realtime is unavailable", async () => {
    await db.exec("alter function realtime.send(jsonb, text, text, boolean) rename to send_disabled");
    try {
      const category = await categoryId("activity_categories", ALICE, "Personal");
      await expect(insertActivity(ALICE, category, "Still saved")).resolves.toBeTypeOf("string");
    } finally {
      await db.exec("alter function realtime.send_disabled(jsonb, text, text, boolean) rename to send");
    }
  });
});
