/**
 * Tests for SSRF URL validation utility
 * M-1: Blocks private IPs, localhost, non-HTTPS
 */

import { validateSsrfUrl } from '../ssrf';

describe('validateSsrfUrl', () => {
  describe('valid URLs (should not throw)', () => {
    it('accepts a public HTTPS URL', () => {
      expect(() => validateSsrfUrl('https://mastodon.social')).not.toThrow();
    });

    it('accepts a public HTTPS URL with path', () => {
      expect(() => validateSsrfUrl('https://example.com/api/v1')).not.toThrow();
    });

    it('accepts a non-standard HTTPS port', () => {
      expect(() => validateSsrfUrl('https://example.com:8443/path')).not.toThrow();
    });
  });

  describe('protocol enforcement', () => {
    it('rejects HTTP URLs', () => {
      expect(() => validateSsrfUrl('http://example.com')).toThrow('must use HTTPS');
    });

    it('rejects ftp URLs', () => {
      expect(() => validateSsrfUrl('ftp://example.com')).toThrow('must use HTTPS');
    });

    it('rejects file URLs', () => {
      expect(() => validateSsrfUrl('file:///etc/passwd')).toThrow('must use HTTPS');
    });

    it('rejects malformed URLs', () => {
      expect(() => validateSsrfUrl('not-a-url')).toThrow('Invalid URL format');
    });
  });

  describe('localhost blocking (M-1)', () => {
    it('rejects localhost', () => {
      expect(() => validateSsrfUrl('https://localhost')).toThrow('cannot point to localhost');
    });

    it('rejects 127.0.0.1', () => {
      expect(() => validateSsrfUrl('https://127.0.0.1')).toThrow('cannot point to localhost');
    });

    it('rejects IPv6 loopback ::1', () => {
      expect(() => validateSsrfUrl('https://[::1]')).toThrow();
    });

    it('rejects 0.0.0.0', () => {
      expect(() => validateSsrfUrl('https://0.0.0.0')).toThrow('cannot point to localhost');
    });
  });

  describe('private IP range blocking (M-1)', () => {
    it('rejects 10.x.x.x (Class A private)', () => {
      expect(() => validateSsrfUrl('https://10.0.0.1')).toThrow('private IP range');
    });

    it('rejects 172.16.x.x (Class B private start)', () => {
      expect(() => validateSsrfUrl('https://172.16.0.1')).toThrow('private IP range');
    });

    it('rejects 172.31.x.x (Class B private end)', () => {
      expect(() => validateSsrfUrl('https://172.31.255.255')).toThrow('private IP range');
    });

    it('does NOT reject 172.15.x.x (just outside private range)', () => {
      expect(() => validateSsrfUrl('https://172.15.0.1')).not.toThrow();
    });

    it('does NOT reject 172.32.x.x (just outside private range)', () => {
      expect(() => validateSsrfUrl('https://172.32.0.1')).not.toThrow();
    });

    it('rejects 192.168.x.x (Class C private)', () => {
      expect(() => validateSsrfUrl('https://192.168.1.1')).toThrow('private IP range');
    });

    it('rejects 169.254.x.x (link-local)', () => {
      expect(() => validateSsrfUrl('https://169.254.169.254')).toThrow('private IP range');
    });

    it('rejects 127.x.x.x (loopback range)', () => {
      expect(() => validateSsrfUrl('https://127.1.2.3')).toThrow('private IP range');
    });
  });

  describe('IPv6 link-local blocking (M-1)', () => {
    it('rejects IPv6 link-local fe80::', () => {
      expect(() => validateSsrfUrl('https://[fe80::1]')).toThrow();
    });
  });
});
