/**
 * Postgres for the local Supabase emulator: PGlite with the same Supabase shim used by the
 * database tests, plus every LifeOS migration. Migrations are applied once and recorded, so a
 * persistent data directory survives restarts and picks up new migrations.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(import.meta.dirname, "..", "..");

const EMULATOR_SQL = `
  create schema if not exists local_emulator;
  create table if not exists local_emulator.migrations (name text primary key, applied_at timestamptz default now());
  create table if not exists local_emulator.credentials (
    user_id uuid primary key references auth.users (id) on delete cascade,
    password_hash text not null
  );
  create table if not exists local_emulator.refresh_tokens (
    token text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    session_id uuid not null,
    revoked boolean not null default false,
    created_at timestamptz not null default now()
  );
  create unique index if not exists users_email_key on auth.users (lower(email));
`;

export async function openDatabase(dataDir?: string): Promise<PGlite> {
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.waitReady;

  const { rows } = await db.query<{ ready: boolean }>("select to_regclass('auth.users') is not null as ready");
  if (!rows[0]?.ready) {
    await db.exec(readFileSync(path.join(root, "tests", "db", "supabase-shim.sql"), "utf8"));
  }
  await db.exec(EMULATOR_SQL);

  const migrationsDir = path.join(root, "supabase", "migrations");
  const applied = new Set(
    (await db.query<{ name: string }>("select name from local_emulator.migrations")).rows.map((row) => row.name),
  );
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
    await db.query("insert into local_emulator.migrations (name) values ($1)", [file]);
    console.log(`[local-supabase] applied ${file}`);
  }

  // PostgREST on Supabase serializes timestamps in UTC.
  await db.exec("set timezone to 'UTC'");
  return db;
}
