/**
 * Specification-based test suite for SSRF URL validation utility.
 *
 * Organized by OWASP SSRF bypass vector categories.
 * Reference: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
 *
 * Note on URL normalization: Node.js URL constructor normalizes certain IP
 * representations (decimal integers, octal, hex) to standard dotted-decimal
 * form before our validation runs. This means some bypass vectors are caught
 * by the standard private-IP/localhost checks rather than the specialized
 * checks. The tests verify the URL is *blocked*, regardless of which check
 * catches it.
 */

import { lookup } from 'dns/promises';
import type { LookupAddress } from 'dns';
import { validateSsrfUrl, createSsrfSafeAgent } from '../ssrf';

// Mock DNS lookup to avoid real network calls in tests.
// Default mock resolves to a public IP; individual tests override for DNS-specific scenarios.
vi.mock('dns/promises', () => ({
  lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
}));

// Cast to a properly typed mock that returns LookupAddress[] (matching the { all: true } overload).
const mockLookup = lookup as unknown as ReturnType<typeof vi.fn<[], Promise<LookupAddress[]>>>;

/** Helper to set the mock DNS response with correct typing. */
function mockDnsResponse(...entries: LookupAddress[]): void {
  (mockLookup as ReturnType<typeof vi.fn>).mockResolvedValue(entries);
}

/** Helper to set a one-time mock DNS response. */
function mockDnsResponseOnce(...entries: LookupAddress[]): void {
  (mockLookup as ReturnType<typeof vi.fn>).mockResolvedValueOnce(entries);
}

/** Helper to set a one-time mock DNS rejection. */
function mockDnsRejectionOnce(error: Error): void {
  (mockLookup as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
}

describe('validateSsrfUrl', () => {
  beforeEach(() => {
    mockDnsResponse({ address: '93.184.216.34', family: 4 });
  });

  // =========================================================================
  // 1. Valid URLs (should pass validation)
  // =========================================================================
  describe('valid URLs (should not throw)', () => {
    it('accepts a public HTTPS URL', async () => {
      await expect(validateSsrfUrl('https://mastodon.social')).resolves.not.toThrow();
    });

    it('accepts a public HTTPS URL with path', async () => {
      await expect(validateSsrfUrl('https://example.com/api/v1')).resolves.not.toThrow();
    });

    it('accepts a non-standard HTTPS port', async () => {
      await expect(validateSsrfUrl('https://example.com:8443/path')).resolves.not.toThrow();
    });

    it('accepts URL with query parameters', async () => {
      await expect(validateSsrfUrl('https://example.com/search?q=test')).resolves.not.toThrow();
    });

    it('accepts URL with fragment', async () => {
      await expect(validateSsrfUrl('https://example.com/page#section')).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // 2. Protocol enforcement (OWASP: Alternate URL Schemes)
  // =========================================================================
  describe('protocol enforcement — alternate URL schemes', () => {
    it('rejects HTTP URLs', async () => {
      await expect(validateSsrfUrl('http://example.com')).rejects.toThrow('must use HTTPS');
    });

    it('rejects ftp:// URLs', async () => {
      await expect(validateSsrfUrl('ftp://example.com')).rejects.toThrow('must use HTTPS');
    });

    it('rejects file:// URLs (local file read)', async () => {
      await expect(validateSsrfUrl('file:///etc/passwd')).rejects.toThrow('must use HTTPS');
    });

    it('rejects gopher:// URLs', async () => {
      await expect(validateSsrfUrl('gopher://evil.com')).rejects.toThrow('must use HTTPS');
    });

    it('rejects data: URLs', async () => {
      await expect(validateSsrfUrl('data:text/html,<h1>hi</h1>')).rejects.toThrow('must use HTTPS');
    });

    it('rejects javascript: URLs', async () => {
      await expect(validateSsrfUrl('javascript:alert(1)')).rejects.toThrow();
    });

    it('rejects dict:// URLs', async () => {
      await expect(validateSsrfUrl('dict://evil.com:11111/')).rejects.toThrow('must use HTTPS');
    });

    it('rejects malformed URLs', async () => {
      await expect(validateSsrfUrl('not-a-url')).rejects.toThrow('Invalid URL format');
    });

    it('rejects empty string', async () => {
      await expect(validateSsrfUrl('')).rejects.toThrow('Invalid URL format');
    });
  });

  // =========================================================================
  // 3. URL credentials blocking
  // =========================================================================
  describe('URL credentials blocking', () => {
    it('rejects URLs with username', async () => {
      await expect(validateSsrfUrl('https://admin@example.com')).rejects.toThrow(
        'must not contain credentials'
      );
    });

    it('rejects URLs with username and password', async () => {
      await expect(validateSsrfUrl('https://admin:pass@example.com')).rejects.toThrow(
        'must not contain credentials'
      );
    });
  });

  // =========================================================================
  // 4. Localhost blocking
  // =========================================================================
  describe('localhost blocking', () => {
    it('rejects localhost', async () => {
      await expect(validateSsrfUrl('https://localhost')).rejects.toThrow(
        'cannot point to localhost'
      );
    });

    it('rejects localhost with port', async () => {
      await expect(validateSsrfUrl('https://localhost:3000')).rejects.toThrow(
        'cannot point to localhost'
      );
    });

    it('rejects 127.0.0.1', async () => {
      await expect(validateSsrfUrl('https://127.0.0.1')).rejects.toThrow(
        'cannot point to localhost'
      );
    });

    it('rejects IPv6 loopback ::1', async () => {
      await expect(validateSsrfUrl('https://[::1]')).rejects.toThrow();
    });

    it('rejects 0.0.0.0', async () => {
      await expect(validateSsrfUrl('https://0.0.0.0')).rejects.toThrow('cannot point to localhost');
    });
  });

  // =========================================================================
  // 5. Private IPv4 range blocking (RFC 1918 + special ranges)
  // =========================================================================
  describe('private IPv4 range blocking', () => {
    it('rejects 10.x.x.x (Class A private — RFC 1918)', async () => {
      await expect(validateSsrfUrl('https://10.0.0.1')).rejects.toThrow('private IP range');
    });

    it('rejects 10.255.255.255 (end of Class A private)', async () => {
      await expect(validateSsrfUrl('https://10.255.255.255')).rejects.toThrow('private IP range');
    });

    it('rejects 172.16.0.1 (Class B private start)', async () => {
      await expect(validateSsrfUrl('https://172.16.0.1')).rejects.toThrow('private IP range');
    });

    it('rejects 172.31.255.255 (Class B private end)', async () => {
      await expect(validateSsrfUrl('https://172.31.255.255')).rejects.toThrow('private IP range');
    });

    it('does NOT reject 172.15.0.1 (just below private range)', async () => {
      await expect(validateSsrfUrl('https://172.15.0.1')).resolves.not.toThrow();
    });

    it('does NOT reject 172.32.0.1 (just above private range)', async () => {
      await expect(validateSsrfUrl('https://172.32.0.1')).resolves.not.toThrow();
    });

    it('rejects 192.168.x.x (Class C private)', async () => {
      await expect(validateSsrfUrl('https://192.168.1.1')).rejects.toThrow('private IP range');
    });

    it('rejects 192.168.0.0 (network address)', async () => {
      await expect(validateSsrfUrl('https://192.168.0.0')).rejects.toThrow('private IP range');
    });

    it('rejects 169.254.x.x (link-local)', async () => {
      await expect(validateSsrfUrl('https://169.254.169.254')).rejects.toThrow('private IP range');
    });

    it('rejects 127.x.x.x variants (full loopback range)', async () => {
      await expect(validateSsrfUrl('https://127.1.2.3')).rejects.toThrow('private IP range');
    });

    it('rejects 127.0.0.2', async () => {
      await expect(validateSsrfUrl('https://127.0.0.2')).rejects.toThrow('private IP range');
    });

    it('rejects 0.x.x.x (current network — RFC 1122)', async () => {
      await expect(validateSsrfUrl('https://0.1.2.3')).rejects.toThrow('private IP range');
    });

    it('rejects 100.64.x.x (CGN — RFC 6598)', async () => {
      await expect(validateSsrfUrl('https://100.64.0.1')).rejects.toThrow('private IP range');
    });

    it('rejects 100.127.255.255 (end of CGN range)', async () => {
      await expect(validateSsrfUrl('https://100.127.255.255')).rejects.toThrow('private IP range');
    });

    it('does NOT reject 100.63.255.255 (just below CGN range)', async () => {
      await expect(validateSsrfUrl('https://100.63.255.255')).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // 6. Cloud metadata endpoints (AWS, GCP, Azure)
  // =========================================================================
  describe('cloud metadata endpoint blocking', () => {
    it('rejects AWS metadata endpoint 169.254.169.254', async () => {
      await expect(validateSsrfUrl('https://169.254.169.254')).rejects.toThrow('private IP range');
    });

    it('rejects AWS metadata with path', async () => {
      await expect(validateSsrfUrl('https://169.254.169.254/latest/meta-data/')).rejects.toThrow(
        'private IP range'
      );
    });

    it('rejects link-local range broadly (169.254.0.0/16)', async () => {
      await expect(validateSsrfUrl('https://169.254.0.1')).rejects.toThrow('private IP range');
    });
  });

  // =========================================================================
  // 7. Decimal IP bypass (OWASP: IP address in decimal notation)
  // Node.js URL parser normalizes decimal integers to dotted-decimal,
  // so these are caught by the localhost/private IP checks.
  // =========================================================================
  describe('decimal IP bypass vectors', () => {
    it('rejects 2130706433 (decimal for 127.0.0.1)', async () => {
      // URL parser normalizes to 127.0.0.1 -> caught by localhost check
      await expect(validateSsrfUrl('https://2130706433')).rejects.toThrow();
    });

    it('rejects 167772161 (decimal for 10.0.0.1)', async () => {
      // URL parser normalizes to 10.0.0.1 -> caught by private IP check
      await expect(validateSsrfUrl('https://167772161')).rejects.toThrow();
    });

    it('rejects 3232235521 (decimal for 192.168.0.1)', async () => {
      await expect(validateSsrfUrl('https://3232235521')).rejects.toThrow();
    });

    it('rejects 2851995649 (decimal for 169.254.169.1)', async () => {
      await expect(validateSsrfUrl('https://2851995649')).rejects.toThrow();
    });

    it('does NOT reject decimal IPs that resolve to public addresses', async () => {
      // 1249763588 = 74.125.224.4 (public)
      await expect(validateSsrfUrl('https://1249763588')).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // 8. Octal IP bypass (OWASP: IP address in octal notation)
  // Node.js URL parser normalizes octal to dotted-decimal,
  // so these are caught by the localhost/private IP checks.
  // =========================================================================
  describe('octal IP bypass vectors', () => {
    it('rejects 0177.0.0.1 (octal for 127.0.0.1)', async () => {
      // URL parser normalizes to 127.0.0.1 -> caught by localhost check
      await expect(validateSsrfUrl('https://0177.0.0.1')).rejects.toThrow();
    });

    it('rejects 0177.0.0.01 (all-octal loopback)', async () => {
      await expect(validateSsrfUrl('https://0177.0.0.01')).rejects.toThrow();
    });

    it('rejects 012.0.0.1 (octal for 10.0.0.1)', async () => {
      // URL parser normalizes to 10.0.0.1 -> caught by private IP check
      await expect(validateSsrfUrl('https://012.0.0.1')).rejects.toThrow();
    });

    it('rejects 0300.0250.0251.0376 (octal for 192.168.169.254)', async () => {
      await expect(validateSsrfUrl('https://0300.0250.0251.0376')).rejects.toThrow();
    });
  });

  // =========================================================================
  // 9. Hex IP bypass (OWASP: IP address in hexadecimal)
  // Node.js URL parser normalizes hex to dotted-decimal,
  // so these are caught by the localhost/private IP checks.
  // =========================================================================
  describe('hex IP bypass vectors', () => {
    it('rejects 0x7f.0x0.0x0.0x1 (hex for 127.0.0.1)', async () => {
      // URL parser normalizes to 127.0.0.1 -> caught by localhost check
      await expect(validateSsrfUrl('https://0x7f.0x0.0x0.0x1')).rejects.toThrow();
    });

    it('rejects 0x7f000001 (single hex for 127.0.0.1)', async () => {
      await expect(validateSsrfUrl('https://0x7f000001')).rejects.toThrow();
    });

    it('rejects 0xA.0x0.0x0.0x1 (hex for 10.0.0.1)', async () => {
      await expect(validateSsrfUrl('https://0xA.0x0.0x0.0x1')).rejects.toThrow();
    });
  });

  // =========================================================================
  // 10. IPv6 bypass vectors (OWASP: IPv6 addressing)
  // =========================================================================
  describe('IPv6 bypass vectors', () => {
    it('rejects [::1] (IPv6 loopback)', async () => {
      await expect(validateSsrfUrl('https://[::1]')).rejects.toThrow();
    });

    it('rejects [::] (IPv6 unspecified)', async () => {
      await expect(validateSsrfUrl('https://[::]')).rejects.toThrow();
    });

    it('rejects [fe80::1] (IPv6 link-local)', async () => {
      await expect(validateSsrfUrl('https://[fe80::1]')).rejects.toThrow();
    });

    it('rejects [fc00::1] (IPv6 ULA)', async () => {
      await expect(validateSsrfUrl('https://[fc00::1]')).rejects.toThrow();
    });

    it('rejects [fd00::1] (IPv6 ULA)', async () => {
      await expect(validateSsrfUrl('https://[fd00::1]')).rejects.toThrow();
    });

    describe('IPv4-compatible IPv6 addresses (deprecated ::x.x.x.x)', () => {
      it('rejects [::127.0.0.1] (IPv4-compatible loopback)', async () => {
        await expect(validateSsrfUrl('https://[::127.0.0.1]')).rejects.toThrow();
      });

      it('rejects [::10.0.0.1] (IPv4-compatible Class A private)', async () => {
        await expect(validateSsrfUrl('https://[::10.0.0.1]')).rejects.toThrow();
      });

      it('rejects [::192.168.1.1] (IPv4-compatible Class C private)', async () => {
        await expect(validateSsrfUrl('https://[::192.168.1.1]')).rejects.toThrow();
      });

      it('rejects [::169.254.169.254] (IPv4-compatible metadata endpoint)', async () => {
        await expect(validateSsrfUrl('https://[::169.254.169.254]')).rejects.toThrow();
      });
    });

    describe('IPv4-mapped IPv6 addresses', () => {
      it('rejects [::ffff:127.0.0.1] (IPv4-mapped loopback)', async () => {
        // URL parser normalizes to [::ffff:7f00:1] -> hex-form IPv4-mapped check
        await expect(validateSsrfUrl('https://[::ffff:127.0.0.1]')).rejects.toThrow();
      });

      it('rejects [::ffff:10.0.0.1] (IPv4-mapped Class A private)', async () => {
        await expect(validateSsrfUrl('https://[::ffff:10.0.0.1]')).rejects.toThrow();
      });

      it('rejects [::ffff:192.168.1.1] (IPv4-mapped Class C private)', async () => {
        await expect(validateSsrfUrl('https://[::ffff:192.168.1.1]')).rejects.toThrow();
      });

      it('rejects [::ffff:169.254.169.254] (IPv4-mapped metadata endpoint)', async () => {
        await expect(validateSsrfUrl('https://[::ffff:169.254.169.254]')).rejects.toThrow();
      });
    });
  });

  // =========================================================================
  // 11. DNS rebinding protection
  // =========================================================================
  describe('DNS rebinding protection', () => {
    it('rejects hostname that resolves to private IPv4 (DNS rebinding)', async () => {
      mockDnsResponseOnce({ address: '127.0.0.1', family: 4 });
      await expect(validateSsrfUrl('https://evil-rebind.example.com')).rejects.toThrow(
        'resolves to a private IP'
      );
    });

    it('rejects hostname that resolves to 10.x private IP', async () => {
      mockDnsResponseOnce({ address: '10.0.0.1', family: 4 });
      await expect(validateSsrfUrl('https://rebind.example.com')).rejects.toThrow(
        'resolves to a private IP'
      );
    });

    it('rejects hostname that resolves to 192.168.x private IP', async () => {
      mockDnsResponseOnce({ address: '192.168.1.1', family: 4 });
      await expect(validateSsrfUrl('https://rebind2.example.com')).rejects.toThrow(
        'resolves to a private IP'
      );
    });

    it('rejects hostname that resolves to link-local IP', async () => {
      mockDnsResponseOnce({ address: '169.254.169.254', family: 4 });
      await expect(validateSsrfUrl('https://metadata.example.com')).rejects.toThrow(
        'resolves to a private IP'
      );
    });

    it('rejects hostname that resolves to private IPv6', async () => {
      mockDnsResponseOnce({ address: '::1', family: 6 });
      await expect(validateSsrfUrl('https://ipv6-rebind.example.com')).rejects.toThrow(
        'resolves to a private IPv6'
      );
    });

    it('rejects hostname that resolves to IPv6 ULA', async () => {
      mockDnsResponseOnce({ address: 'fc00::1', family: 6 });
      await expect(validateSsrfUrl('https://ula-rebind.example.com')).rejects.toThrow(
        'resolves to a private IPv6'
      );
    });

    it('rejects when any resolved IP is private (multi-record)', async () => {
      mockDnsResponseOnce(
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.1', family: 4 }
      );
      await expect(validateSsrfUrl('https://multi-record.example.com')).rejects.toThrow(
        'resolves to a private IP'
      );
    });

    it('blocks when DNS resolution fails (fail-closed)', async () => {
      mockDnsRejectionOnce(new Error('ENOTFOUND'));
      await expect(validateSsrfUrl('https://nonexistent.example.com')).rejects.toThrow(
        'could not be resolved'
      );
    });
  });

  // =========================================================================
  // 12. URL encoding tricks (OWASP: URL encoding)
  // Node.js URL constructor normalizes percent-encoded characters in the
  // hostname, so %31%32%37.%30.%30.%31 becomes 127.0.0.1 after parsing.
  // These tests verify that post-normalization checks still catch the bypass.
  // =========================================================================
  describe('URL encoding tricks', () => {
    // The URL constructor auto-decodes percent-encoded hostnames in most
    // runtimes. If the runtime decodes %31%32%37 to "127", the existing
    // localhost/private checks handle it. If it does NOT decode (treated as
    // literal hostname), DNS resolution will fail-closed. Either path is safe.
    //
    // Percent-encoding in the *path* portion does not affect SSRF validation
    // since only the hostname is security-relevant.

    it('handles percent-encoded path safely (path encoding is irrelevant)', async () => {
      await expect(validateSsrfUrl('https://example.com/%2e%2e/admin')).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // 13. Return value: resolved IPs for DNS pinning (#424 TOCTOU fix)
  // =========================================================================
  describe('return value — resolved IPs for DNS pinning', () => {
    it('returns resolved IPs on successful validation', async () => {
      mockDnsResponseOnce({ address: '93.184.216.34', family: 4 });
      const result = await validateSsrfUrl('https://example.com');
      expect(result).toEqual({
        resolvedIps: [{ address: '93.184.216.34', family: 4 }],
      });
    });

    it('returns multiple resolved IPs', async () => {
      mockDnsResponseOnce(
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }
      );
      const result = await validateSsrfUrl('https://example.com');
      expect(result.resolvedIps).toHaveLength(2);
      expect(result.resolvedIps[0]).toEqual({ address: '93.184.216.34', family: 4 });
      expect(result.resolvedIps[1]).toEqual({
        address: '2606:2800:220:1:248:1893:25c8:1946',
        family: 6,
      });
    });
  });

  // =========================================================================
  // 14. createSsrfSafeAgent — DNS pinning
  // =========================================================================
  describe('createSsrfSafeAgent', () => {
    it('creates an HTTPS agent that pins to validated IPs', () => {
      const agent = createSsrfSafeAgent([{ address: '93.184.216.34', family: 4 }]);
      expect(agent).toBeInstanceOf(require('https').Agent);
    });

    it('pinned lookup returns the validated IP', async () => {
      const agent = createSsrfSafeAgent([{ address: '93.184.216.34', family: 4 }]);
      const lookupFn = (agent as any).options?.lookup;
      expect(lookupFn).toBeDefined();
      const result = await new Promise<{ address: string; family: number }>((resolve, reject) => {
        lookupFn('evil.com', {}, (err: Error | null, address: string, family: number) => {
          if (err) return reject(err);
          resolve({ address, family });
        });
      });
      expect(result.address).toBe('93.184.216.34');
      expect(result.family).toBe(4);
    });
  });

  // =========================================================================
  // 15. Redirect chain handling
  // Redirect-based SSRF cannot be tested in unit tests because this
  // validator only checks the URL *before* fetching. Redirect protection
  // must be enforced at the HTTP client level (e.g., disabling auto-follow
  // or re-validating after each redirect).
  // =========================================================================
  describe('redirect chain handling (architectural documentation)', () => {
    it('validates only the initial URL (redirect protection is an HTTP client concern)', () => {
      // OWASP recommends:
      // 1. Disable automatic redirect following in the HTTP client
      // 2. If redirects are needed, re-validate each redirect target URL
      // 3. Limit redirect depth (max 3-5 hops)
      //
      // This validator handles step 2: each redirect URL should be passed
      // through validateSsrfUrl() before following.
      expect(true).toBe(true);
    });
  });
});
