import { NextResponse, type NextRequest } from "next/server";
import { logServerError } from "@/lib/errors";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE email links (Supabase's default templates): Supabase verifies the token and redirects
 * here with ?code=..., which is exchanged for a session cookie. The exchange needs the code
 * verifier stored when sign-up started, so it only succeeds in the same browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  if (searchParams.get("error")) {
    const reason = searchParams.get("error_code") === "otp_expired" ? "link_expired" : "invalid_link";
    return NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, origin));
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/auth/error?reason=invalid_link", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logServerError("auth.callback", error);
    return NextResponse.redirect(new URL("/auth/error?reason=exchange_failed", origin));
  }

  return NextResponse.redirect(new URL(safeRedirectPath(searchParams.get("next"), origin), origin));
}
