import { isAdmin, isAuthenticated, isCreator } from '../auth';

describe('Authentication Middleware Utilities', () => {
  const validJWTPayload = {
    nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    signature_verified: true,
    role: 'creator' as const,
  };

  describe('isAdmin', () => {
    it('should return true for admin users', () => {
      expect(isAdmin({ ...validJWTPayload, role: 'admin' })).toBe(true);
    });

    it('should return false for non-admin users', () => {
      expect(isAdmin({ ...validJWTPayload, role: 'creator' })).toBe(false);
      expect(isAdmin({ ...validJWTPayload, role: 'supporter' })).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
    });
  });

  describe('isCreator', () => {
    it('should return true for creators and admins', () => {
      expect(isCreator({ ...validJWTPayload, role: 'creator' })).toBe(true);
      expect(isCreator({ ...validJWTPayload, role: 'admin' })).toBe(true);
    });

    it('should return false for supporters', () => {
      expect(isCreator({ ...validJWTPayload, role: 'supporter' })).toBe(false);
      expect(isCreator(undefined)).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for verified users', () => {
      expect(isAuthenticated({ ...validJWTPayload, signature_verified: true })).toBe(true);
    });

    it('should return false for unverified or missing users', () => {
      expect(isAuthenticated({ ...validJWTPayload, signature_verified: false })).toBe(false);
      expect(isAuthenticated(undefined)).toBe(false);
    });
  });
});
