import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTestDb } from "./harness";

const script = readFileSync(
  path.resolve(import.meta.dirname, "..", "..", "supabase", "tests", "rls_verification.sql"),
  "utf8",
);

describe("supabase/tests/rls_verification.sql", () => {
  it("passes against the LifeOS migrations and leaves no data behind", async () => {
    const db = await createTestDb();
    await db.exec(script);
    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from auth.users where email like 'rls-check-%'",
    );
    expect(rows[0].count).toBe(0);
  });

  it("detects a leaking policy", async () => {
    const db = await createTestDb();
    // Simulate a mistake: a policy that lets every signed-in user read every activity.
    await db.exec(`create policy "oops_everyone_reads" on public.activities for select to authenticated using (true)`);
    await expect(db.exec(script)).rejects.toThrow(/FAIL: user B can read user A's activities/);
  });

  it("detects a missing ownership check on insert", async () => {
    const db = await createTestDb();
    await db.exec(`create policy "oops_anyone_inserts" on public.activities for insert to authenticated with check (true)`);
    await expect(db.exec(script)).rejects.toThrow(/FAIL: user B inserted a row owned by user A/);
  });
});

describe("supabase/tests/rls_verification.sql (ownership foreign key)", () => {
  it("detects a missing composite ownership foreign key", async () => {
    const db = await createTestDb();
    await db.exec("alter table public.activities drop constraint activities_category_fk");
    await expect(db.exec(script)).rejects.toThrow(/FAIL: user B attached an activity to user A's category/);
  });
});
