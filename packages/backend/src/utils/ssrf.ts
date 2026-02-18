/**
 * SSRF (Server-Side Request Forgery) URL Validation
 * M-1: Blocks requests to private IPs, localhost, and non-HTTPS protocols.
 *
 * Pattern extracted from MastodonAdapter.validateInstanceUrl() for shared use
 * across any service that makes outbound requests to user-supplied URLs.
 */

/**
 * Validates that a URL is safe for server-side outbound requests.
 * Throws if the URL targets localhost, a private IP range, or non-HTTPS.
 *
 * @throws {Error} with a safe message (no URL in production error responses)
 */
export function validateSsrfUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('URL must use HTTPS');
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

  // Block private IPv4 ranges
  const octets = hostname.split('.');
  if (octets.length === 4) {
    const [a, b] = octets.map(Number);
    if (
      a === 10 ||                               // 10.0.0.0/8
      a === 127 ||                              // 127.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||      // 172.16.0.0/12
      (a === 192 && b === 168) ||               // 192.168.0.0/16
      (a === 169 && b === 254)                  // 169.254.0.0/16 link-local
    ) {
      throw new Error('URL cannot point to a private IP range');
    }
  }

  // Block IPv6 loopback and link-local
  if (hostname.startsWith('[')) {
    const ipv6 = hostname.slice(1, -1).toLowerCase();
    if (ipv6 === '::1' || ipv6.startsWith('fe80')) {
      throw new Error('URL cannot point to IPv6 loopback or link-local address');
    }
  }
}
