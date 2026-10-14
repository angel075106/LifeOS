import type { NetworkInterfaceInfo } from "node:os";

/*
 * Development-server origins (used by next.config.ts, so keep this file free of "@/" imports).
 *
 * Next.js blocks its dev-only resources (hot reload, dev chunks) for every host except
 * localhost. When LifeOS is opened from a phone through this computer's network address, the
 * blocked hot-reload connection leaves the page without JavaScript, so forms fall back to a
 * plain page reload and "Sign in" appears to do nothing.
 */

/** RFC 1918 private IPv4 ranges (home and office networks). */
export function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** "http://Phone.local:3000/" -> "phone.local": allowedDevOrigins entries are bare hostnames. */
function toHostname(entry: string): string {
  return entry
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");
}

/**
 * Hosts that may use the dev server besides localhost: this computer's own private network
 * addresses, plus the comma-separated hostnames in `extra` (e.g. LIFEOS_DEV_ORIGINS for a
 * "my-pc.local" name or a tunnel). Other devices' addresses and public sites stay blocked.
 */
export function devAllowedOrigins(
  interfaces: Partial<Record<string, NetworkInterfaceInfo[]>>,
  extra = "",
): string[] {
  const own = Object.values(interfaces)
    .flatMap((list) => list ?? [])
    .filter((info) => info.family === "IPv4" && !info.internal && isPrivateIPv4(info.address))
    .map((info) => info.address);
  const listed = extra.split(",").map(toHostname).filter(Boolean);
  return [...new Set([...own, ...listed])];
}
