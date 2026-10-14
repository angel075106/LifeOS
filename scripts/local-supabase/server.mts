/**
 * Local Supabase emulator for LifeOS development and browser tests.
 *
 *   npm run supabase:local            (in-memory database)
 *   npm run supabase:local -- --data .local-supabase   (persist between restarts)
 *
 * It runs the real LifeOS migrations on PGlite and serves the small subset of the Auth and
 * PostgREST HTTP APIs that the app uses. It is NOT Supabase: there is no Realtime, email,
 * storage or dashboard, and only the API features LifeOS needs are implemented. Use it for
 * local development and automated tests; deploy against a real Supabase project.
 * It only listens on 127.0.0.1.
 */
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AuthHttpError, createAuth, createJwtTools } from "./auth.mts";
import { openDatabase } from "./db.mts";
import { createRest, loadCatalog } from "./postgrest.mts";

const args = process.argv.slice(2);
const dataIndex = args.indexOf("--data");
const dataDir = dataIndex >= 0 ? args[dataIndex + 1] : process.env.LOCAL_SUPABASE_DATA;
const port = Number(process.env.LOCAL_SUPABASE_PORT ?? 54321);
const baseUrl = `http://127.0.0.1:${port}`;

const db = await openDatabase(dataDir);
const jwt = createJwtTools(process.env.LOCAL_SUPABASE_JWT_SECRET ?? randomBytes(32).toString("hex"), `${baseUrl}/auth/v1`);
const auth = createAuth(db, jwt);
const rest = createRest(db, loadCatalog(db));

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, range, x-client-info, x-supabase-api-version",
  "Access-Control-Expose-Headers": "content-range",
};

function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    ...CORS_HEADERS,
    ...(body === undefined ? {} : { "Content-Type": "application/json; charset=utf-8" }),
    ...headers,
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function bearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// Requests are serialized: PGlite is a single connection and role switches are per session.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", baseUrl);
  const method = req.method ?? "GET";
  if (method === "OPTIONS") return send(res, 204);
  const body = await readBody(req);

  if (url.pathname.startsWith("/auth/v1/")) {
    try {
      const action = url.pathname.slice("/auth/v1/".length);
      if (action === "signup" && method === "POST") return send(res, 200, await auth.signUp(body as object));
      if (action === "token" && method === "POST") {
        const grant = url.searchParams.get("grant_type");
        if (grant === "password") return send(res, 200, await auth.signInWithPassword(body as object));
        if (grant === "refresh_token") return send(res, 200, await auth.refresh(body as object));
      }
      if (action === "user" && method === "GET") return send(res, 200, (await auth.currentUser(bearer(req))).user);
      if (action === "user" && method === "PUT") return send(res, 200, await auth.updatePassword(bearer(req), body as object));
      if (action === "logout" && method === "POST") {
        await auth.signOut(bearer(req), url.searchParams.get("scope"));
        return send(res, 204);
      }
      if (action === "recover" && method === "POST") return send(res, 200, {});
      return send(res, 404, { code: 404, error_code: "not_found", msg: "Not implemented by the local emulator" });
    } catch (error) {
      if (error instanceof AuthHttpError) {
        return send(res, error.status, { code: error.status, error_code: error.errorCode, msg: error.message });
      }
      throw error;
    }
  }

  if (url.pathname.startsWith("/rest/v1/")) {
    const token = bearer(req);
    const claims = token ? auth.verify(token) : null;
    // Without a session, supabase-js sends the publishable key as the bearer token.
    const isApiKey = token !== null && token === req.headers.apikey;
    if (token && !claims && !isApiKey && token.split(".").length === 3) {
      // A user JWT that fails verification (expired or forged).
      return send(res, 401, { code: "PGRST301", message: "JWT expired or invalid", details: null, hint: null });
    }
    const response = await rest({
      method,
      path: url.pathname,
      searchParams: url.searchParams,
      headers: { accept: req.headers.accept, prefer: req.headers.prefer as string | undefined },
      body,
      role: claims ? "authenticated" : "anon",
      claims,
    });
    return send(res, response.status, response.body, response.headers);
  }

  // No Realtime server: the app reports "Auto-refresh" mode and polls instead.
  return send(res, 404, { message: "Not available in the local emulator" });
}

const server = createServer((req, res) => {
  serialized(() => route(req, res)).catch((error: unknown) => {
    console.error("[local-supabase] request failed", (error as Error).message);
    if (!res.headersSent) send(res, 500, { message: "Internal emulator error" });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[local-supabase] ready on ${baseUrl} (${dataDir ? `data: ${dataDir}` : "in-memory"})`);
  console.log("[local-supabase] set NEXT_PUBLIC_SUPABASE_URL to this address and any non-placeholder publishable key.");
});
