import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";
import { devAllowedOrigins } from "./lib/dev-origins";

const isDev = process.env.NODE_ENV === "development";

/** Origins the browser may contact: this app plus the configured Supabase project. */
function supabaseOrigins(): string[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    const { origin, protocol, host } = new URL(url ?? "");
    const ws = `${protocol === "https:" ? "wss:" : "ws:"}//${host}`;
    return [origin, ws];
  } catch {
    // Not configured yet: allow hosted Supabase projects so a later .env.local works.
    return ["https://*.supabase.co", "wss://*.supabase.co"];
  }
}

/*
 * Content Security Policy without nonces (see Next.js CSP guide). Nonces would force every
 * page to render dynamically; 'unsafe-inline' scripts are still limited to this origin and
 * the policy blocks framing, plugins, foreign form targets and unexpected network origins.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigins().join(" ")}${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The dev server would otherwise print every Server Action call with its arguments
  // (titles, amounts, notes). Keep personal data out of terminal logs.
  logging: { serverFunctions: false },
  // The dev-tools badge would sit on top of the phone tab bar; errors are still surfaced.
  devIndicators: false,
  // Dev only: lets a phone on the same network use the dev server through this computer's
  // network address. Without it, Next.js blocks hot reload for that host, the page never
  // starts its JavaScript, and forms such as "Sign in" just reload the page.
  allowedDevOrigins: isDev ? devAllowedOrigins(networkInterfaces(), process.env.LIFEOS_DEV_ORIGINS) : undefined,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        // CSV exports and other API responses contain private data: never cache them.
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
  async redirects() {
    return [
      // The calendar is the home screen; the proxy sends signed-out visitors to sign in.
      { source: "/", destination: "/calendar", permanent: false },
      // Old starter route (it may still be configured as an email redirect URL).
      { source: "/protected", destination: "/calendar", permanent: false },
    ];
  },
};

export default nextConfig;
