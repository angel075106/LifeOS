import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { logServerError } from "@/lib/errors";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: ReadonlySet<string> = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/**
 * Email links that use the token-hash template, e.g.
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/calendar
 * Works even when the link is opened on a different device than the one that signed up.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || !type || !OTP_TYPES.has(type)) {
    return NextResponse.redirect(new URL("/auth/error?reason=invalid_link", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
  if (error) {
    logServerError("auth.confirm", error);
    return NextResponse.redirect(new URL("/auth/error?reason=link_expired", origin));
  }

  const destination =
    type === "recovery" ? "/auth/update-password" : safeRedirectPath(searchParams.get("next"), origin);
  return NextResponse.redirect(new URL(destination, origin));
}
