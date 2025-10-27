/**
 * 🎭 **Helia UnixFS Mock**
 *
 * Jest-compatible mock for @helia/unixfs package
 * Following TDD/BDD best practices with realistic responses
 */

const createUnixfsMock = () => ({
  addFile: jest.fn().mockResolvedValue({
    cid: 'QmTestFileHash123456789',
    size: 2048,
    blocks: 1,
  }),
  addDirectory: jest.fn().mockResolvedValue({
    cid: 'QmTestDirHash123456789',
    size: 4096,
    blocks: 3,
  }),
  cat: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  ls: jest.fn().mockResolvedValue([
    {
      name: 'test-file.txt',
      cid: 'QmTestFileHash123456789',
      size: 1024,
      type: 'file',
    },
  ]),
});

module.exports = {
  unixfs: jest.fn().mockReturnValue(createUnixfsMock()),
  __esModule: true,
  default: createUnixfsMock,
};
