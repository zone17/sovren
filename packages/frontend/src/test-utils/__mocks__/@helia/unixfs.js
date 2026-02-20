/**
 * Helia UnixFS Mock
 *
 * Vitest mock for @helia/unixfs package
 */

const createUnixfsMock = () => ({
  addFile: vi.fn().mockResolvedValue({
    cid: 'QmTestFileHash123456789',
    size: 2048,
    blocks: 1,
  }),
  addDirectory: vi.fn().mockResolvedValue({
    cid: 'QmTestDirHash123456789',
    size: 4096,
    blocks: 3,
  }),
  cat: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  ls: vi.fn().mockResolvedValue([
    {
      name: 'test-file.txt',
      cid: 'QmTestFileHash123456789',
      size: 1024,
      type: 'file',
    },
  ]),
});

module.exports = {
  unixfs: vi.fn().mockReturnValue(createUnixfsMock()),
  __esModule: true,
  default: createUnixfsMock,
};
