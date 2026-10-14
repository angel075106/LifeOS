import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "@/lib/env";
import type { Database } from "./database.types";

/** Signed-in users visiting these are sent to the app instead. */
const GUEST_ONLY_PATHS = new Set(["/auth/login", "/auth/sign-up"]);

function isAuthPath(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

/** Copies cookies written during this request (e.g. a refreshed session) onto `target`. */
function withSessionCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

function loginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/auth/login";
  url.search = "";
  if (next !== "/" && next !== "/calendar") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

/**
 * Runs before every non-static request: refreshes the Supabase session cookie and keeps
 * signed-out visitors away from private pages and APIs. This is the first gate only; pages,
 * Server Actions and Route Handlers verify the user again, and RLS protects the data itself.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const config = getPublicSupabaseConfig();

  // Fail closed: without configuration nothing private can be served.
  if (!config) {
    if (isAuthPath(pathname)) return NextResponse.next({ request });
    if (isApi) return NextResponse.json({ error: "Service not configured" }, { status: 503 });
    return loginRedirect(request);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): getClaims() refreshes an
  // expired session, and skipping it can randomly sign users out.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (isAuthPath(pathname)) {
    if (signedIn && GUEST_ONLY_PATHS.has(pathname)) {
      return withSessionCookies(NextResponse.redirect(new URL("/calendar", request.url)), response);
    }
    return response;
  }

  if (!signedIn) {
    if (isApi) {
      return withSessionCookies(NextResponse.json({ error: "Not authenticated" }, { status: 401 }), response);
    }
    return withSessionCookies(loginRedirect(request), response);
  }

  return response;
}
