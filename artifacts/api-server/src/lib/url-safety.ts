/**
 * SSRF protection helpers for server-side URL fetches.
 *
 * Resolves a hostname via DNS and rejects addresses that point at private,
 * loopback, link-local, or otherwise reserved network ranges. This is a
 * pre-flight check — callers should still set short timeouts and follow
 * redirects manually so each hop can be re-validated.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_V4 = [
  // 10.0.0.0/8
  { mask: [255, 0, 0, 0], net: [10, 0, 0, 0] },
  // 172.16.0.0/12
  { mask: [255, 240, 0, 0], net: [172, 16, 0, 0] },
  // 192.168.0.0/16
  { mask: [255, 255, 0, 0], net: [192, 168, 0, 0] },
  // 127.0.0.0/8 (loopback)
  { mask: [255, 0, 0, 0], net: [127, 0, 0, 0] },
  // 169.254.0.0/16 (link-local incl. cloud metadata)
  { mask: [255, 255, 0, 0], net: [169, 254, 0, 0] },
  // 0.0.0.0/8
  { mask: [255, 0, 0, 0], net: [0, 0, 0, 0] },
  // 100.64.0.0/10 (CGNAT)
  { mask: [255, 192, 0, 0], net: [100, 64, 0, 0] },
];

function v4Bytes(addr: string): number[] | null {
  const parts = addr.split(".");
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out.push(n);
  }
  return out;
}

function isPrivateV4(addr: string): boolean {
  const bytes = v4Bytes(addr);
  if (!bytes) return false;
  for (const { mask, net } of PRIVATE_V4) {
    let match = true;
    for (let i = 0; i < 4; i++) {
      if ((bytes[i] & mask[i]) !== net[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function isPrivateV6(addr: string): boolean {
  const lower = addr.toLowerCase();
  // Loopback
  if (lower === "::1") return true;
  // Unspecified
  if (lower === "::") return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  // Unique local fc00::/7 — first byte 1111110x
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  return false;
}

export function isPrivateAddress(addr: string): boolean {
  const fam = isIP(addr);
  if (fam === 4) return isPrivateV4(addr);
  if (fam === 6) return isPrivateV6(addr);
  return false;
}

export class UrlSafetyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Validate a URL is safe to fetch from a server: must be http/https and must
 * not resolve to a private/loopback/link-local address.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlSafetyError(400, "Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlSafetyError(400, "URL must use http or https");
  }
  // Reject userinfo (curl-style http://user:pass@host) — easy way to confuse
  // proxies and not relevant for a public feed.
  if (url.username || url.password) {
    throw new UrlSafetyError(400, "URL must not contain credentials");
  }

  const hostname = url.hostname;
  if (!hostname) {
    throw new UrlSafetyError(400, "URL is missing a hostname");
  }

  // If the host is already an IP literal, validate directly.
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new UrlSafetyError(400, "URL points at a private network address");
    }
    return url;
  }

  // Otherwise resolve all addresses and reject if any are private — this
  // blocks rebinding/dual-A-record tricks against the simpler check.
  let addrs: { address: string; family: number }[] = [];
  try {
    addrs = await dnsLookup(hostname, { all: true });
  } catch {
    throw new UrlSafetyError(400, `Could not resolve host "${hostname}"`);
  }
  if (addrs.length === 0) {
    throw new UrlSafetyError(400, `Could not resolve host "${hostname}"`);
  }
  for (const a of addrs) {
    if (isPrivateAddress(a.address)) {
      throw new UrlSafetyError(
        400,
        "URL resolves to a private network address",
      );
    }
  }
  return url;
}
