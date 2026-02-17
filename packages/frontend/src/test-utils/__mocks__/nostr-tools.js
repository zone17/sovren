/**
 * 🎭 **NOSTR Tools Mock**
 *
 * Jest-compatible mock for nostr-tools package
 * Following TDD/BDD best practices with realistic NOSTR functionality
 */

module.exports = {
  generateSecretKey: jest.fn().mockReturnValue(new Uint8Array(32).fill(1)),
  getPublicKey: jest.fn().mockReturnValue('b'.repeat(64)),

  finalizeEvent: jest.fn().mockImplementation((event, privateKey) => ({
    ...event,
    id: 'd'.repeat(64),
    pubkey: 'b'.repeat(64),
    sig: 'c'.repeat(128),
  })),

  verifyEvent: jest.fn().mockReturnValue(true),
  validateEvent: jest.fn().mockReturnValue(true),

  nip19: {
    encode: jest.fn().mockImplementation((prefix, data) => `${prefix}1test123456789`),
    decode: jest.fn().mockImplementation((bech32) => ({
      type: 'npub',
      data: 'decoded-data',
    })),
  },

  kinds: {
    Metadata: 0,
    Text: 1,
    RecommendRelay: 2,
    Contacts: 3,
    EncryptedDirectMessage: 4,
    EventDeletion: 5,
  },

  SimplePool: jest.fn().mockImplementation(() => ({
    subscribeMany: jest.fn().mockReturnValue({
      close: jest.fn(),
    }),
    publish: jest.fn().mockResolvedValue(['ok']),
    close: jest.fn(),
    ensureRelay: jest.fn().mockResolvedValue(undefined),
  })),

  __esModule: true,
};
