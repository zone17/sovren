/**
 * Helia HTTP Mock
 *
 * Vitest mock for @helia/http package
 */

const createHeliaHttpMock = () => ({
  add: vi.fn().mockResolvedValue({
    cid: 'QmTestCidHash123456789',
    size: 1024,
    path: '/test/path',
  }),
  get: vi.fn().mockResolvedValue([
    {
      path: '/test/path',
      content: new Uint8Array([1, 2, 3, 4, 5]),
    },
  ]),
  pin: {
    add: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    ls: vi.fn().mockResolvedValue([]),
  },
  stop: vi.fn().mockResolvedValue(undefined),
});

module.exports = {
  createHeliaHttp: vi.fn().mockResolvedValue(createHeliaHttpMock()),
  __esModule: true,
  default: createHeliaHttpMock,
};
