/**
 * SSRF (Server-Side Request Forgery) URL Validation
 * M-1: Blocks requests to private IPs, localhost, and non-HTTPS protocols.
 *
 * Fix #259: Added DNS rebinding protection, IPv6 mapped addresses,
 * octal/hex IP detection, URL credential blocking, and CGN range.
 */

import { lookup } from 'dns/promises';

/**
 * Check if an IP string uses octal (0177.x) or hex (0x7f) notation.
 * These bypass simple decimal checks.
 */
function isOctalOrHexIp(hostname: string): boolean {
  const parts = hostname.split('.');
  return parts.some((p) => /^0x[0-9a-fA-F]+$/.test(p) || (/^0\d+$/.test(p) && p !== '0'));
}

/**
 * Check if a decimal IPv4 address is in a private/reserved range.
 */
function isPrivateIPv4(ip: string): boolean {
  const octets = ip.split('.');
  if (octets.length !== 4) return false;
  const nums = octets.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return false;

  const [a, b] = nums;
  return (
    a === 0 || // 0.0.0.0/8 (current network)
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8 (loopback)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 169 && b === 254) || // 169.254.0.0/16 (link-local)
    (a === 100 && b >= 64 && b <= 127) // 100.64.0.0/10 (CGN)
  );
}

/**
 * Check if an IPv6 address is private/reserved.
 * Handles loopback, ULA, link-local, and IPv4-mapped addresses.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
  if (normalized.startsWith('fe80')) return true; // Link-local

  // IPv4-mapped: ::ffff:x.x.x.x
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  return false;
}

/**
 * Check if hostname is a decimal integer IP (e.g., 2130706433 = 127.0.0.1).
 * Browsers and some HTTP clients resolve these to IPv4 addresses.
 */
function isDecimalIntegerIp(hostname: string): boolean {
  if (!/^\d+$/.test(hostname)) return false;
  const num = Number(hostname);
  if (!Number.isInteger(num) || num < 0 || num > 0xffffffff) return false;
  const a = (num >>> 24) & 0xff;
  const b = (num >>> 16) & 0xff;
  const c = (num >>> 8) & 0xff;
  const d = num & 0xff;
  return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
}

/**
 * Validates that a URL is safe for server-side outbound requests.
 * Performs DNS resolution to catch rebinding attacks.
 *
 * @throws {Error} with a safe message (no URL in production error responses)
 */
export async function validateSsrfUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('URL must use HTTPS');
  }

  // Block URL credentials (user:pass@host)
  if (parsed.username || parsed.password) {
    throw new Error('URL must not contain credentials');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    throw new Error('URL cannot point to localhost');
  }

  // Block octal/hex IP notation (e.g. 0x7f000001, 0177.0.0.1)
  if (isOctalOrHexIp(hostname)) {
    throw new Error('URL cannot use octal or hex IP notation');
  }

  // Block decimal integer IP notation (e.g. 2130706433 = 127.0.0.1)
  if (isDecimalIntegerIp(hostname)) {
    throw new Error('URL cannot use decimal integer IP notation');
  }

  // Block private IPv4 ranges (string-based check)
  if (isPrivateIPv4(hostname)) {
    throw new Error('URL cannot point to a private IP range');
  }

  // Block private IPv6 (bracketed or bare)
  if (hostname.startsWith('[') || hostname.includes(':')) {
    if (isPrivateIPv6(hostname)) {
      throw new Error('URL cannot point to a private IPv6 address');
    }
  }

  // DNS resolution check: resolve hostname and verify all IPs are public
  try {
    const results = await lookup(hostname, { all: true });
    for (const result of results) {
      if (result.family === 4 && isPrivateIPv4(result.address)) {
        throw new Error('URL resolves to a private IP address');
      }
      if (result.family === 6 && isPrivateIPv6(result.address)) {
        throw new Error('URL resolves to a private IPv6 address');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('URL ')) {
      throw err; // Re-throw our own errors
    }
    // DNS resolution failure — block the request (fail-closed)
    throw new Error('URL hostname could not be resolved');
  }
}
