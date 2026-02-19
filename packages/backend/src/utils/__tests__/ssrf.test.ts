/**
 * Tests for SSRF URL validation utility
 * M-1: Blocks private IPs, localhost, non-HTTPS
 */

import { validateSsrfUrl } from '../ssrf';

// Mock DNS lookup to avoid real network calls in tests
jest.mock('dns/promises', () => ({
  lookup: jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
}));

describe('validateSsrfUrl', () => {
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
  });

  describe('protocol enforcement', () => {
    it('rejects HTTP URLs', async () => {
      await expect(validateSsrfUrl('http://example.com')).rejects.toThrow('must use HTTPS');
    });

    it('rejects ftp URLs', async () => {
      await expect(validateSsrfUrl('ftp://example.com')).rejects.toThrow('must use HTTPS');
    });

    it('rejects file URLs', async () => {
      await expect(validateSsrfUrl('file:///etc/passwd')).rejects.toThrow('must use HTTPS');
    });

    it('rejects malformed URLs', async () => {
      await expect(validateSsrfUrl('not-a-url')).rejects.toThrow('Invalid URL format');
    });
  });

  describe('localhost blocking (M-1)', () => {
    it('rejects localhost', async () => {
      await expect(validateSsrfUrl('https://localhost')).rejects.toThrow(
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

  describe('private IP range blocking (M-1)', () => {
    it('rejects 10.x.x.x (Class A private)', async () => {
      await expect(validateSsrfUrl('https://10.0.0.1')).rejects.toThrow('private IP range');
    });

    it('rejects 172.16.x.x (Class B private start)', async () => {
      await expect(validateSsrfUrl('https://172.16.0.1')).rejects.toThrow('private IP range');
    });

    it('rejects 172.31.x.x (Class B private end)', async () => {
      await expect(validateSsrfUrl('https://172.31.255.255')).rejects.toThrow('private IP range');
    });

    it('does NOT reject 172.15.x.x (just outside private range)', async () => {
      await expect(validateSsrfUrl('https://172.15.0.1')).resolves.not.toThrow();
    });

    it('does NOT reject 172.32.x.x (just outside private range)', async () => {
      await expect(validateSsrfUrl('https://172.32.0.1')).resolves.not.toThrow();
    });

    it('rejects 192.168.x.x (Class C private)', async () => {
      await expect(validateSsrfUrl('https://192.168.1.1')).rejects.toThrow('private IP range');
    });

    it('rejects 169.254.x.x (link-local)', async () => {
      await expect(validateSsrfUrl('https://169.254.169.254')).rejects.toThrow('private IP range');
    });

    it('rejects 127.x.x.x (loopback range)', async () => {
      await expect(validateSsrfUrl('https://127.1.2.3')).rejects.toThrow('private IP range');
    });
  });

  describe('IPv6 link-local blocking (M-1)', () => {
    it('rejects IPv6 link-local fe80::', async () => {
      await expect(validateSsrfUrl('https://[fe80::1]')).rejects.toThrow();
    });
  });
});
