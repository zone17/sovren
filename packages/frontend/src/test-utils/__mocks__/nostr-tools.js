/**
 * NOSTR Tools Mock
 *
 * Vitest mock for nostr-tools package
 */

module.exports = {
  generateSecretKey: vi.fn().mockReturnValue(new Uint8Array(32).fill(1)),
  getPublicKey: vi.fn().mockReturnValue('b'.repeat(64)),

  finalizeEvent: vi.fn().mockImplementation((event, privateKey) => ({
    ...event,
    id: 'd'.repeat(64),
    pubkey: 'b'.repeat(64),
    sig: 'c'.repeat(128),
  })),

  verifyEvent: vi.fn().mockReturnValue(true),
  validateEvent: vi.fn().mockReturnValue(true),

  nip19: {
    encode: vi.fn().mockImplementation((prefix, data) => `${prefix}1test123456789`),
    decode: vi.fn().mockImplementation((bech32) => ({
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

  SimplePool: vi.fn().mockImplementation(() => ({
    subscribeMany: vi.fn().mockReturnValue({
      close: vi.fn(),
    }),
    publish: vi.fn().mockResolvedValue(['ok']),
    close: vi.fn(),
    ensureRelay: vi.fn().mockResolvedValue(undefined),
  })),

  __esModule: true,
};
