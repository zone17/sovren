/**
 * 🎭 **Helia HTTP Mock**
 *
 * Jest-compatible mock for @helia/http package
 * Following TDD/BDD best practices with realistic responses
 */

const createHeliaHttpMock = () => ({
  add: jest.fn().mockResolvedValue({
    cid: 'QmTestCidHash123456789',
    size: 1024,
    path: '/test/path',
  }),
  get: jest.fn().mockResolvedValue([
    {
      path: '/test/path',
      content: new Uint8Array([1, 2, 3, 4, 5]),
    },
  ]),
  pin: {
    add: jest.fn().mockResolvedValue(undefined),
    rm: jest.fn().mockResolvedValue(undefined),
    ls: jest.fn().mockResolvedValue([]),
  },
  stop: jest.fn().mockResolvedValue(undefined),
});

module.exports = {
  createHeliaHttp: jest.fn().mockResolvedValue(createHeliaHttpMock()),
  __esModule: true,
  default: createHeliaHttpMock,
};
