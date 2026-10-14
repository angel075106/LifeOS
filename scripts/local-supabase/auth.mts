/**
 * Subset of Supabase Auth (GoTrue) used by LifeOS: email/password sign-up and sign-in,
 * refresh, current user, password update and sign-out. Tokens are HS256 JWTs, so
 * supabase-js validates them through GET /auth/v1/user (exactly as with a symmetric-key
 * Supabase project). Email confirmation is treated as disabled.
 */
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";

const ACCESS_TOKEN_SECONDS = 3600;

export type JwtClaims = {
  sub: string;
  email: string;
  role: "authenticated";
  aud: "authenticated";
  exp: number;
  iat: number;
  session_id: string;
  [key: string]: unknown;
};

export class AuthHttpError extends Error {
  readonly status: number;
  readonly errorCode: string;
  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export function createJwtTools(secret: string, issuer: string) {
  function sign(payload: object): string {
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = base64url(JSON.stringify(payload));
    const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
    return `${header}.${body}.${signature}`;
  }

  function verify(token: string): JwtClaims | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2], "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as JwtClaims;
      if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
      if (claims.role !== "authenticated" || typeof claims.sub !== "string") return null;
      return claims;
    } catch {
      return null;
    }
  }

  return { sign, verify, issuer };
}

type UserRow = { id: string; email: string; raw_user_meta_data: Record<string, unknown>; created_at: string };

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function checkPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

function userJson(user: UserRow) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: user.created_at,
    confirmed_at: user.created_at,
    phone: "",
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: user.raw_user_meta_data ?? {},
    identities: [],
    created_at: user.created_at,
    updated_at: user.created_at,
    is_anonymous: false,
  };
}

export function createAuth(db: PGlite, jwt: ReturnType<typeof createJwtTools>) {
  async function findUserByEmail(email: string) {
    const { rows } = await db.query<UserRow & { password_hash: string | null }>(
      `select u.id, u.email, u.raw_user_meta_data, u.created_at::text as created_at, c.password_hash
         from auth.users u left join local_emulator.credentials c on c.user_id = u.id
        where lower(u.email) = lower($1)`,
      [email],
    );
    return rows[0] ?? null;
  }

  async function findUserById(id: string) {
    const { rows } = await db.query<UserRow>(
      "select id, email, raw_user_meta_data, created_at::text as created_at from auth.users where id = $1",
      [id],
    );
    return rows[0] ?? null;
  }

  async function issueSession(user: UserRow, sessionId: string = randomUUID()) {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = jwt.sign({
      iss: jwt.issuer,
      sub: user.id,
      aud: "authenticated",
      exp: now + ACCESS_TOKEN_SECONDS,
      iat: now,
      email: user.email,
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: user.raw_user_meta_data ?? {},
      role: "authenticated",
      aal: "aal1",
      amr: [{ method: "password", timestamp: now }],
      session_id: sessionId,
      is_anonymous: false,
    });
    const refreshToken = randomBytes(24).toString("base64url");
    await db.query("insert into local_emulator.refresh_tokens (token, user_id, session_id) values ($1, $2, $3)", [
      refreshToken,
      user.id,
      sessionId,
    ]);
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_SECONDS,
      expires_at: now + ACCESS_TOKEN_SECONDS,
      refresh_token: refreshToken,
      user: userJson(user),
    };
  }

  async function signUp(body: { email?: unknown; password?: unknown; data?: unknown }) {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AuthHttpError(400, "validation_failed", "Unable to validate email address: invalid format");
    if (password.length < 8) throw new AuthHttpError(422, "weak_password", "Password should be at least 8 characters.");
    if (await findUserByEmail(email)) throw new AuthHttpError(422, "user_already_exists", "User already registered");
    const id = randomUUID();
    const metadata = body.data && typeof body.data === "object" ? body.data : {};
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      email,
      JSON.stringify(metadata),
    ]);
    await db.query("insert into local_emulator.credentials (user_id, password_hash) values ($1, $2)", [
      id,
      hashPassword(password),
    ]);
    const user = await findUserById(id);
    if (!user) throw new AuthHttpError(500, "unexpected_failure", "User creation failed");
    return issueSession(user);
  }

  async function signInWithPassword(body: { email?: unknown; password?: unknown }) {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = await findUserByEmail(email);
    if (!user || !user.password_hash || !checkPassword(password, user.password_hash)) {
      throw new AuthHttpError(400, "invalid_credentials", "Invalid login credentials");
    }
    return issueSession(user);
  }

  async function refresh(body: { refresh_token?: unknown }) {
    const token = typeof body.refresh_token === "string" ? body.refresh_token : "";
    const { rows } = await db.query<{ user_id: string; session_id: string }>(
      "update local_emulator.refresh_tokens set revoked = true where token = $1 and not revoked returning user_id, session_id",
      [token],
    );
    const row = rows[0];
    const user = row ? await findUserById(row.user_id) : null;
    if (!row || !user) throw new AuthHttpError(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
    return issueSession(user, row.session_id);
  }

  async function currentUser(token: string | null) {
    const claims = token ? jwt.verify(token) : null;
    const user = claims ? await findUserById(claims.sub) : null;
    if (!claims || !user) throw new AuthHttpError(401, "bad_jwt", "invalid JWT: unable to parse or verify signature");
    return { claims, user: userJson(user) };
  }

  async function updatePassword(token: string | null, body: { password?: unknown }) {
    const { claims } = await currentUser(token);
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) throw new AuthHttpError(422, "weak_password", "Password should be at least 8 characters.");
    await db.query("update local_emulator.credentials set password_hash = $2 where user_id = $1", [
      claims.sub,
      hashPassword(password),
    ]);
    const user = await findUserById(claims.sub);
    if (!user) throw new AuthHttpError(404, "user_not_found", "User not found");
    return userJson(user);
  }

  async function signOut(token: string | null, scope: string | null) {
    const claims = token ? jwt.verify(token) : null;
    if (!claims) return;
    if (scope === "global") {
      await db.query("update local_emulator.refresh_tokens set revoked = true where user_id = $1", [claims.sub]);
    } else {
      await db.query("update local_emulator.refresh_tokens set revoked = true where session_id = $1", [
        claims.session_id,
      ]);
    }
  }

  return { signUp, signInWithPassword, refresh, currentUser, updatePassword, signOut, verify: jwt.verify };
}
