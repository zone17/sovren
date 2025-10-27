/**
 * 🎭 **Helia Core Mock**
 *
 * Jest-compatible mock for helia package
 * Following TDD/BDD best practices with realistic responses
 */

module.exports = {
  createHelia: jest.fn().mockResolvedValue({
    pins: {
      add: jest.fn().mockResolvedValue(undefined),
      rm: jest.fn().mockResolvedValue(undefined),
      ls: jest.fn().mockReturnValue([]),
    },
    stop: jest.fn().mockResolvedValue(undefined),
    libp2p: {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    },
    blockstore: {
      put: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      has: jest.fn().mockResolvedValue(true),
    },
    datastore: {
      put: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      has: jest.fn().mockResolvedValue(true),
    },
  }),
  __esModule: true,
};
