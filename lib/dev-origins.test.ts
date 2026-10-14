import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it } from "vitest";
import { devAllowedOrigins, isPrivateIPv4 } from "./dev-origins";

function iface(address: string, family: "IPv4" | "IPv6", internal = false): NetworkInterfaceInfo {
  const base = { address, netmask: "255.255.255.0", mac: "00:00:00:00:00:00", internal, cidr: null };
  return family === "IPv4" ? { ...base, family } : { ...base, family, scopeid: 0 };
}

describe("isPrivateIPv4", () => {
  it("accepts home and office network addresses", () => {
    for (const address of ["192.168.1.18", "10.0.0.5", "172.16.0.1", "172.31.255.254"]) {
      expect(isPrivateIPv4(address), address).toBe(true);
    }
  });

  it("rejects public, loopback, link-local and malformed addresses", () => {
    for (const address of ["8.8.8.8", "172.32.0.1", "172.15.0.1", "127.0.0.1", "169.254.1.1", "192.169.1.1", "192.168.1", "192.168.1.256", "a.b.c.d", ""]) {
      expect(isPrivateIPv4(address), address).toBe(false);
    }
  });
});

describe("devAllowedOrigins", () => {
  const interfaces = {
    "Wi-Fi": [iface("192.168.1.18", "IPv4"), iface("fe80::1", "IPv6")],
    Ethernet: [iface("10.0.0.7", "IPv4")],
    "Loopback Pseudo-Interface 1": [iface("127.0.0.1", "IPv4", true), iface("::1", "IPv6", true)],
    Public: [iface("203.0.113.9", "IPv4")],
    Missing: undefined,
  };

  it("allows only this computer's private IPv4 addresses", () => {
    expect(devAllowedOrigins(interfaces)).toEqual(["192.168.1.18", "10.0.0.7"]);
  });

  it("adds extra hostnames, normalized to what Next.js matches", () => {
    expect(devAllowedOrigins({}, " my-pc.local, http://Phone.Test:3000/path ,, 192.168.1.18")).toEqual([
      "my-pc.local",
      "phone.test",
      "192.168.1.18",
    ]);
  });

  it("does not list an address twice", () => {
    expect(devAllowedOrigins(interfaces, "192.168.1.18")).toEqual(["192.168.1.18", "10.0.0.7"]);
  });
});
