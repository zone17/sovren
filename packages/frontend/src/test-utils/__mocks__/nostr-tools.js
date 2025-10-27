/**
 * 🎭 **NOSTR Tools Mock**
 *
 * Jest-compatible mock for nostr-tools package
 * Following TDD/BDD best practices with realistic NOSTR functionality
 */

module.exports = {
  generatePrivateKey: jest.fn().mockReturnValue('a'.repeat(64)),
  getPublicKey: jest.fn().mockReturnValue('b'.repeat(64)),

  signEvent: jest.fn().mockImplementation((event, privateKey) => ({
    ...event,
    sig: 'c'.repeat(128),
  })),

  finalizeEvent: jest.fn().mockImplementation((event, privateKey) => ({
    ...event,
    id: 'd'.repeat(64),
    sig: 'c'.repeat(128),
  })),

  verifySignature: jest.fn().mockReturnValue(true),
  validateEvent: jest.fn().mockReturnValue(true),
  getEventHash: jest.fn().mockReturnValue('d'.repeat(64)),

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

  relayInit: jest.fn().mockReturnValue({
    url: 'wss://test-relay.com',
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
    sub: jest.fn().mockReturnValue({
      on: jest.fn(),
      unsub: jest.fn(),
    }),
    publish: jest.fn().mockResolvedValue(undefined),
    auth: jest.fn().mockResolvedValue(undefined),
  }),

  SimplePool: jest.fn().mockImplementation(() => ({
    sub: jest.fn().mockReturnValue({
      on: jest.fn(),
      unsub: jest.fn(),
    }),
    publish: jest.fn().mockResolvedValue(['ok']),
    close: jest.fn(),
    seenOn: jest.fn().mockReturnValue([]),
  })),

  __esModule: true,
};
