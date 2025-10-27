/**
 * Arweave Mock for Testing
 *
 * Provides a complete mock implementation of the Arweave client
 * for testing purposes without requiring actual blockchain connections.
 *
 * @fileoverview Mock implementation matching Arweave API surface
 * @version 2024.12
 */

// Mock Arweave client with all required methods
const mockArweave = {
  // Core API methods
  api: {
    get: jest.fn().mockResolvedValue({ data: 'mock-response' }),
    post: jest.fn().mockResolvedValue({ data: 'mock-response' }),
  },

  // Wallet operations
  wallets: {
    generate: jest.fn().mockResolvedValue({
      kty: 'RSA',
      n: 'mock-key-n',
      e: 'AQAB',
      d: 'mock-key-d',
      p: 'mock-key-p',
      q: 'mock-key-q',
      dp: 'mock-key-dp',
      dq: 'mock-key-dq',
      qi: 'mock-key-qi',
    }),
    jwkToAddress: jest.fn().mockResolvedValue('mock-wallet-address'),
    getBalance: jest.fn().mockResolvedValue('1000000000'), // 1 AR in winston
    getLastTransactionID: jest.fn().mockResolvedValue('mock-transaction-id'),
  },

  // Transaction operations
  transactions: {
    get: jest.fn().mockResolvedValue({
      id: 'mock-transaction-id',
      data: 'mock-data',
      tags: [],
    }),
    sign: jest.fn().mockResolvedValue(undefined),
    post: jest.fn().mockResolvedValue({ status: 200, statusText: 'OK' }),
    getData: jest.fn().mockResolvedValue(Buffer.from('mock-data')),
    getUploader: jest.fn().mockReturnValue({
      uploadChunk: jest.fn().mockResolvedValue(true),
      isComplete: true,
    }),
  },

  // Block operations
  blocks: {
    getCurrent: jest.fn().mockResolvedValue({
      height: 123456,
      indep_hash: 'mock-block-hash',
    }),
    get: jest.fn().mockResolvedValue({
      height: 123456,
      indep_hash: 'mock-block-hash',
    }),
  },

  // Network operations
  network: {
    getInfo: jest.fn().mockResolvedValue({
      network: 'arweave.N.1',
      version: 5,
      release: 58,
      height: 123456,
      current: 'mock-current-hash',
      blocks: 123456,
      peers: 25,
      queue_length: 0,
      node_state_latency: 1,
    }),
    getPeers: jest.fn().mockResolvedValue(['peer1', 'peer2', 'peer3']),
  },

  // Chunk operations
  chunks: {
    getChunkData: jest.fn().mockResolvedValue({
      chunk: 'mock-chunk-data',
      data_path: 'mock-data-path',
      tx_path: 'mock-tx-path',
    }),
  },

  // Utility methods
  utils: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    concatBuffers: jest.fn().mockImplementation((buffers) => Buffer.concat(buffers)),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    b64UrlToBuffer: jest.fn().mockImplementation((str) => Buffer.from(str, 'base64url')),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    bufferTob64Url: jest.fn().mockImplementation((buffer) => buffer.toString('base64url')),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    stringToBuffer: jest.fn().mockImplementation((str) => Buffer.from(str)),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    bufferToString: jest.fn().mockImplementation((buffer) => buffer.toString()),
  },

  // Create transaction helper
  createTransaction: jest.fn().mockResolvedValue({
    id: 'mock-new-transaction-id',
    data: '',
    target: '',
    quantity: '0',
    reward: '1000000',
    last_tx: 'mock-last-tx',
    tags: [],
    addTag: jest.fn(),
    get: jest.fn(),
  }),

  // AR unit conversion
  ar: {
    winstonToAr: jest.fn().mockImplementation((winston) => (winston / 1000000000000).toString()),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    arToWinston: jest.fn().mockImplementation((ar) => (parseFloat(ar) * 1000000000000).toString()),
  },

  // Configuration
  config: {
    api: {
      host: 'arweave.net',
      port: 443,
      protocol: 'https',
    },
  },
};

// Default export as constructor function (how Arweave is typically imported)
const Arweave = jest.fn().mockImplementation(() => mockArweave);

// Named exports for specific use cases
Arweave.init = jest.fn().mockReturnValue(mockArweave);
Arweave.crypto = {
  hash: jest.fn().mockResolvedValue(Buffer.from('mock-hash')),
  verify: jest.fn().mockResolvedValue(true),
  sign: jest.fn().mockResolvedValue(Buffer.from('mock-signature')),
};

// Attach methods to constructor for static access
Object.assign(Arweave, mockArweave);

module.exports = Arweave;
