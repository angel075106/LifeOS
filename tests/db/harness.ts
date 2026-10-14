import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(import.meta.dirname, "..", "..");
const migrationsDir = path.join(root, "supabase", "migrations");

export type Db = PGlite;

/** Boots an in-memory Postgres, applies the Supabase shim and every LifeOS migration. */
export async function createTestDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(import.meta.dirname, "supabase-shim.sql"), "utf8"));
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

/** Inserts an auth user the way Supabase Auth would, firing the signup trigger. */
export async function createAuthUser(
  db: Db,
  id: string,
  email: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    email,
    JSON.stringify(metadata),
  ]);
}

/**
 * Runs `fn` as the Data API would for a signed-in user: role `authenticated` with the
 * user's JWT claims. Always restores the superuser session afterwards.
 */
export async function asUser<T>(db: Db, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.exec("select set_config('request.jwt.claims', '', false)");
  }
}

/** Runs `fn` as an unauthenticated API caller (role `anon`, no claims). */
export async function asAnon<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  await db.exec("set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

/** Resolves to the SQLSTATE code of the rejection, or fails if the promise resolves. */
export async function pgErrorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : `no-code: ${(error as Error).message}`;
  }
  throw new Error("Expected the query to fail, but it succeeded");
}
