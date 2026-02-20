/**
 * Helia Core Mock
 *
 * Vitest mock for helia package
 */

module.exports = {
  createHelia: vi.fn().mockResolvedValue({
    pins: {
      add: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn().mockResolvedValue(undefined),
      ls: vi.fn().mockReturnValue([]),
    },
    stop: vi.fn().mockResolvedValue(undefined),
    libp2p: {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },
    blockstore: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      has: vi.fn().mockResolvedValue(true),
    },
    datastore: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      has: vi.fn().mockResolvedValue(true),
    },
  }),
  __esModule: true,
};
