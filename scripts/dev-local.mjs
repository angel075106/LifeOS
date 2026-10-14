/**
 * Runs LifeOS fully locally: the Supabase emulator (scripts/local-supabase) plus the Next.js
 * server, wired together through environment variables. Real Supabase settings in
 * .env.local are left untouched (process environment variables take precedence).
 *
 *   npm run dev:local              data persists in .local-supabase/
 *   npm run dev:local -- --memory  fresh in-memory database (used by browser tests)
 *   npm run dev:local -- --prod    production build + `next start` instead of `next dev`
 *
 * Both processes are started with the current Node binary and no shell, which avoids
 * quoting problems with paths such as C:\Program Files\nodejs on Windows.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");

const memory = process.argv.includes("--memory");
const production = process.argv.includes("--prod");
const emulatorPort = process.env.LOCAL_SUPABASE_PORT ?? "54321";

const env = {
  ...process.env,
  LOCAL_SUPABASE_PORT: emulatorPort,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${emulatorPort}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-emulator-publishable-key",
};

const children = [];

function shutdown(code) {
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exit(code);
}

/** Starts a long-running process; if it exits, everything shuts down. */
function run(args) {
  const child = spawn(process.execPath, args, { stdio: "inherit", env });
  children.push(child);
  child.on("exit", (code) => shutdown(code ?? 0));
  return child;
}

run(["scripts/local-supabase/server.mts", ...(memory ? [] : ["--data", ".local-supabase"])]);

if (production) {
  // The build is a one-off step, so it must not trigger the shutdown handler in run().
  const build = spawn(process.execPath, [nextCli, "build"], { stdio: "inherit", env });
  children.push(build);
  build.on("exit", (code) => (code === 0 ? run([nextCli, "start"]) : shutdown(code ?? 1)));
} else {
  run([nextCli, "dev"]);
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => shutdown(0));
