/**
 * Validates post-authentication redirect targets so links like
 * /auth/confirm?next=https://evil.example cannot send users off-site.
 *
 * Accepts same-origin paths ("/calendar?view=week") and absolute URLs on the app's own
 * origin. Everything else falls back to `fallback`.
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  appOrigin: string,
  fallback = "/calendar",
): string {
  if (!candidate) return fallback;
  const value = candidate.trim();
  if (value === "" || value.length > 2048) return fallback;

  // Reject protocol-relative and backslash tricks before URL parsing normalizes them.
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  // Reject control characters (e.g. "/\t/evil.example").
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, appOrigin);
  } catch {
    return fallback;
  }
  if (url.origin !== new URL(appOrigin).origin) return fallback;
  if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;

  const path = `${url.pathname}${url.search}${url.hash}`;
  // Never bounce back into the auth callback routes themselves.
  if (url.pathname.startsWith("/auth/confirm") || url.pathname.startsWith("/auth/callback")) return fallback;
  return path.startsWith("/") ? path : fallback;
}
