import { createSignatureMessage, NostrAuthService, validateNostrPubkey } from '../nostr-auth';

describe('NOSTR Authentication Service', () => {
  let authService: NostrAuthService;

  beforeEach(() => {
    authService = new NostrAuthService('test-secret-key');
  });

  describe('Challenge Generation', () => {
    it('should generate a unique challenge for authentication', async () => {
      const challenge = await authService.generateChallenge();

      expect(challenge).toBeDefined();
      expect(challenge.challenge).toHaveLength(64); // 32 bytes hex
      expect(challenge.timestamp).toBeCloseTo(Date.now(), -2);
      expect(challenge.expires_at).toBeGreaterThan(challenge.timestamp);
    });

    it('should generate different challenges on subsequent calls', async () => {
      const challenge1 = await authService.generateChallenge();
      const challenge2 = await authService.generateChallenge();

      expect(challenge1.challenge).not.toBe(challenge2.challenge);
    });
  });

  describe('JWT Generation', () => {
    it('should generate a valid JWT token for authenticated users', async () => {
      const testPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const token = await authService.generateJWT(testPubkey, 'creator');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('JWT Verification', () => {
    it('should verify a valid JWT token', async () => {
      const testPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const token = await authService.generateJWT(testPubkey, 'creator');

      const result = await authService.verifyJWT(token);

      expect(result.valid).toBe(true);
      expect(result.payload?.nostr_pubkey).toBe(testPubkey);
      expect(result.payload?.role).toBe('creator');
    });

    it('should reject an invalid JWT token', async () => {
      const result = await authService.verifyJWT('invalid.token.here');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Service Statistics', () => {
    it('should provide service statistics', () => {
      const stats = authService.getStats();

      expect(stats).toBeDefined();
      expect(stats.activeChallenges).toBe(0);
      expect(stats.jwtExpiresIn).toBeDefined();
      expect(stats.challengeTTL).toBeDefined();
    });
  });
});

describe('NOSTR Utility Functions', () => {
  describe('validateNostrPubkey', () => {
    it('should validate correct NOSTR public keys', () => {
      const validKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(validateNostrPubkey(validKey)).toBe(true);
    });

    it('should reject invalid NOSTR public keys', () => {
      expect(validateNostrPubkey('invalid-key')).toBe(false);
      expect(validateNostrPubkey('123')).toBe(false); // too short
    });
  });

  describe('createSignatureMessage', () => {
    it('should create consistent signature message', () => {
      const message = createSignatureMessage('test-challenge', 1234567890);

      expect(message).toBe('Sovren Authentication\nChallenge: test-challenge\nTimestamp: 1234567890');
    });
  });
});
