/**
 * 🎭 **ELITE TESTING MOCKS LIBRARY - ZERO VIOLATIONS**
 *
 * **Purpose**: Comprehensive mocking strategy for external dependencies
 * **Architecture**: Realistic mock implementations that behave like real services
 * **Security**: Safe mock data that doesn't expose real credentials
 * **Performance**: Fast mock responses for optimal test execution
 * **Standards**: Elite engineering with ZERO type violations
 *
 * **Engineering Standards**:
 * - Test-Driven Development (TDD): Mocks written before implementation
 * - Behavior-Driven Development (BDD): Mocks reflect real service behavior
 * - Security by Design: No real credentials or sensitive data
 * - Scalability: Configurable mocks for different test scenarios
 *
 * @author Elite Engineering Team
 * @version 3.0.0 - Zero Violations Standard
 * @lastModified 2024-12-28
 */

// 🛡️ **ELITE TYPE SAFETY - COMPREHENSIVE INTERFACES**

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface HeliaNode {
  add: jest.MockedFunction<(data: unknown) => Promise<{ cid: string; size: number; path: string }>>;
  get: jest.MockedFunction<(cid: string) => Promise<Array<{ path: string; content: Uint8Array }>>>;
  pin: {
    add: jest.MockedFunction<(cid: string) => Promise<undefined>>;
    rm: jest.MockedFunction<(cid: string) => Promise<undefined>>;
    ls: jest.MockedFunction<() => Promise<unknown[]>>;
  };
  stop: jest.MockedFunction<() => Promise<undefined>>;
}

// 🌐 **IPFS/Helia Mocks**
export const createHeliaHttpMock = (): {
  create: jest.MockedFunction<() => Promise<HeliaNode>>;
} => ({
  create: jest.fn().mockResolvedValue({
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
  }),
});

export const createUnixfsMock = (): { unixfs: jest.MockedFunction<() => unknown> } => ({
  unixfs: jest.fn().mockReturnValue({
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
  }),
});

// 📦 **Arweave Mocks**
export const createArweaveMock = (): jest.MockedFunction<() => unknown> => {
  const mockArweave = {
    createTransaction: jest.fn().mockResolvedValue({
      id: 'arweave-test-transaction-id-123',
      data: 'test-data',
      reward: '100000000',
      target: '',
      quantity: '0',
      last_tx: 'previous-tx-id',
      tags: [],
    }),
    transactions: {
      sign: jest.fn().mockResolvedValue(undefined),
      post: jest.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: 'SUCCESS',
      }),
      get: jest.fn().mockResolvedValue({
        data: 'test-transaction-data',
      }),
    },
    wallets: {
      generate: jest.fn().mockResolvedValue({
        kty: 'RSA',
        n: 'mock-wallet-key',
      }),
      jwkToAddress: jest.fn().mockResolvedValue('arweave-address-123'),
      getBalance: jest.fn().mockResolvedValue('1000000000'),
    },
    ar: {
      winstonToAr: jest.fn().mockReturnValue('1.0'),
      arToWinston: jest.fn().mockReturnValue('1000000000'),
    },
  };

  return jest.fn().mockReturnValue(mockArweave);
};

// 🗄️ **Supabase Client Mocks**
export const createSupabaseMock = (): unknown => {
  const mockResponse = {
    data: null,
    error: null,
    status: 200,
    statusText: 'OK',
    count: null,
  };

  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    rangeGt: jest.fn().mockReturnThis(),
    rangeGte: jest.fn().mockReturnThis(),
    rangeLt: jest.fn().mockReturnThis(),
    rangeLte: jest.fn().mockReturnThis(),
    rangeAdjacent: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(mockResponse),
    maybeSingle: jest.fn().mockResolvedValue(mockResponse),
    csv: jest.fn().mockResolvedValue('id,name\n1,test'),
    then: jest.fn().mockResolvedValue(mockResponse),
  };

  const mockSupabase = {
    from: jest.fn().mockReturnValue(mockQuery),

    auth: {
      signUp: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            created_at: new Date().toISOString(),
          },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_at: Date.now() + 3600000,
          },
        },
        error: null,
      }),

      signInWithPassword: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            created_at: new Date().toISOString(),
          },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_at: Date.now() + 3600000,
          },
        },
        error: null,
      }),

      signOut: jest.fn().mockResolvedValue({
        error: null,
      }),

      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_at: Date.now() + 3600000,
          },
        },
        error: null,
      }),

      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      }),

      onAuthStateChange: jest.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      }),
    },

    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: {
            path: 'test-file.txt',
            fullPath: 'bucket/test-file.txt',
          },
          error: null,
        }),
        download: jest.fn().mockResolvedValue({
          data: new Blob(['test content']),
          error: null,
        }),
        remove: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: {
            publicUrl: 'https://example.com/test-file.txt',
          },
        }),
      }),
    },

    realtime: {
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      }),
    },
  };

  return mockSupabase;
};

// 🔗 **NOSTR Tools Mocks**
export const createNostrMock = (): unknown => ({
  generateSecretKey: jest.fn().mockReturnValue(new Uint8Array(32).fill(1)),
  getPublicKey: jest.fn().mockReturnValue('b'.repeat(64)),

  finalizeEvent: jest.fn().mockImplementation(
    (event: NostrEvent, _privateKey: Uint8Array): NostrEvent => ({
      ...event,
      pubkey: 'b'.repeat(64),
      sig: 'c'.repeat(128),
      id: 'd'.repeat(64),
    })
  ),

  verifyEvent: jest.fn().mockReturnValue(true),

  validateEvent: jest.fn().mockReturnValue(true),

  nip19: {
    encode: jest
      .fn()
      .mockImplementation((prefix: string, _data: unknown): string => `${prefix}1test123456789`),
    decode: jest.fn().mockImplementation((_bech32: string): { type: string; data: string } => ({
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
});

// 🚀 **NOSTR Tools Pure Module Mocks**
// For dynamic imports used in Login/Signup components
export const createNostrPureMock = (): unknown => ({
  generateSecretKey: jest.fn().mockReturnValue(new Uint8Array(32).fill(1)),
  getPublicKey: jest.fn().mockReturnValue('b'.repeat(64)),
  finalizeEvent: jest.fn().mockImplementation(
    (event: NostrEvent, _privateKey: Uint8Array): NostrEvent => ({
      ...event,
      pubkey: 'b'.repeat(64),
      sig: 'c'.repeat(128),
      id: 'd'.repeat(64),
    })
  ),
  verifyEvent: jest.fn().mockReturnValue(true),
});

// 🤖 **AI Service Mocks**
export const createOpenAIMock = (): unknown => ({
  completions: {
    create: jest.fn().mockResolvedValue({
      id: 'chatcmpl-test123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test AI response for content analysis.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 25,
        total_tokens: 75,
      },
    }),
  },
});

export const createAnthropicMock = (): unknown => ({
  messages: {
    create: jest.fn().mockResolvedValue({
      id: 'msg_test123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'This is a test Claude response for content enhancement.',
        },
      ],
      model: 'claude-3-opus-20240229',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 40,
        output_tokens: 30,
      },
    }),
  },
});

// ⚡ **Lightning Network Mocks**
export const createLightningMock = (): unknown => ({
  createInvoice: jest.fn().mockResolvedValue({
    payment_hash: 'test-payment-hash-123',
    payment_request: 'lnbc10u1p3xnhl2pp5...',
    check_id: 'test-check-id',
    lnurl: 'lnurl1test123456789',
  }),

  checkInvoice: jest.fn().mockResolvedValue({
    paid: true,
    payment_hash: 'test-payment-hash-123',
    amount: 1000,
    settled_at: new Date().toISOString(),
  }),

  getWalletInfo: jest.fn().mockResolvedValue({
    id: 'test-wallet-id',
    name: 'Test Wallet',
    balance: 50000,
    currency: 'sats',
  }),
});

// 🎨 **TipTap Editor Mocks**
export const createTipTapMock = (): unknown => ({
  useEditor: jest.fn().mockReturnValue({
    commands: {
      setContent: jest.fn(),
      getHTML: jest.fn().mockReturnValue('<p>Test content</p>'),
      focus: jest.fn(),
      blur: jest.fn(),
    },
    isActive: jest.fn().mockReturnValue(false),
    can: jest.fn().mockReturnValue({
      run: jest.fn().mockReturnValue(true),
    }),
    state: {
      doc: { content: [] },
    },
    view: {
      dom: document.createElement('div'),
    },
    destroy: jest.fn(),
  }),

  Editor: jest.fn().mockImplementation(() => ({
    commands: {
      setContent: jest.fn(),
      getHTML: jest.fn().mockReturnValue('<p>Test content</p>'),
    },
    destroy: jest.fn(),
  })),
});

// 📊 **Web Vitals Mocks**
export const createWebVitalsMock = (): unknown => ({
  getCLS: jest.fn().mockImplementation((callback: (metric: unknown) => void): void => {
    callback({ name: 'CLS', value: 0.05, rating: 'good' });
  }),

  getFID: jest.fn().mockImplementation((callback: (metric: unknown) => void): void => {
    callback({ name: 'FID', value: 50, rating: 'good' });
  }),

  getFCP: jest.fn().mockImplementation((callback: (metric: unknown) => void): void => {
    callback({ name: 'FCP', value: 1200, rating: 'good' });
  }),

  getLCP: jest.fn().mockImplementation((callback: (metric: unknown) => void): void => {
    callback({ name: 'LCP', value: 1800, rating: 'good' });
  }),

  getTTFB: jest.fn().mockImplementation((callback: (metric: unknown) => void): void => {
    callback({ name: 'TTFB', value: 300, rating: 'good' });
  }),
});

// 🔧 **Module Mocks Setup**
export function setupAllMocks(): void {
  // 🌐 IPFS/Helia Mocks
  jest.mock('@helia/unixfs', () => createUnixfsMock());
  jest.mock('@helia/http', () => ({ createHeliaHttp: createHeliaHttpMock().create }));
  jest.mock('helia', () => ({
    createHelia: jest.fn().mockResolvedValue({
      pins: {
        add: jest.fn(),
        rm: jest.fn(),
        ls: jest.fn().mockReturnValue([]),
      },
      stop: jest.fn(),
    }),
  }));

  // 🗄️ Supabase Mocks
  jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn().mockImplementation(() => createSupabaseMock()),
  }));

  // 🔗 NOSTR Tools Mocks
  jest.mock('nostr-tools', () => createNostrMock());
  jest.mock('nostr-tools/pure', () => createNostrPureMock());
  jest.mock('nostr-tools/pool', () => ({
    SimplePool: jest.fn().mockImplementation(() => ({
      subscribeMany: jest.fn().mockReturnValue({ close: jest.fn() }),
      publish: jest.fn().mockResolvedValue(['ok']),
      close: jest.fn(),
      ensureRelay: jest.fn().mockResolvedValue(undefined),
    })),
  }));
  jest.mock('nostr-tools/nip04', () => ({
    encrypt: jest.fn().mockResolvedValue('encrypted-content?iv=base64iv'),
    decrypt: jest.fn().mockResolvedValue('decrypted-content'),
  }));
  jest.mock('nostr-tools/nip19', () => ({
    nip19: {
      encode: jest.fn().mockImplementation((prefix: string) => `${prefix}1test123456789`),
      decode: jest.fn().mockImplementation(() => ({ type: 'npub', data: 'decoded-data' })),
    },
  }));

  // 🏪 Arweave Mock
  jest.mock('arweave', () => createArweaveMock());

  // ⚡ Lightning Mocks
  jest.mock('../lib/lightning', () => createLightningMock());

  // 🤖 AI Service Mocks
  jest.mock('openai', () => ({
    OpenAI: jest.fn().mockImplementation(() => createOpenAIMock()),
  }));

  jest.mock('@anthropic-ai/sdk', () => ({
    Anthropic: jest.fn().mockImplementation(() => createAnthropicMock()),
  }));

  // 🎨 Editor Mocks
  jest.mock('@tiptap/react', () => createTipTapMock());

  // 📊 Performance Mocks
  jest.mock('web-vitals', () => createWebVitalsMock());

  // 🧪 Setup custom matchers
  setupCustomMatchers();
}

// 🧪 **Test-specific Custom Matchers**
declare global {
  interface JestMatchers<R> {
    toBeBetween(floor: number, ceiling: number): R;
    toBeValidCid(): R;
    toBeValidNostrEvent(): R;
    toBeValidLightningInvoice(): R;
  }
}

export function setupCustomMatchers(): void {
  expect.extend({
    toBeBetween(received: number, floor: number, ceiling: number): jest.CustomMatcherResult {
      const pass = received >= floor && received <= ceiling;
      return {
        message: (): string => `expected ${received} to be between ${floor} and ${ceiling}`,
        pass,
      };
    },

    toBeValidCid(received: string): jest.CustomMatcherResult {
      const pass = /^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(received);
      return {
        message: (): string => `expected ${received} to be a valid IPFS CID`,
        pass,
      };
    },

    toBeValidNostrEvent(received: NostrEvent): jest.CustomMatcherResult {
      const pass =
        received &&
        typeof received.id === 'string' &&
        typeof received.pubkey === 'string' &&
        typeof received.created_at === 'number' &&
        typeof received.kind === 'number' &&
        Array.isArray(received.tags) &&
        typeof received.content === 'string' &&
        typeof received.sig === 'string';

      return {
        message: (): string => `expected ${JSON.stringify(received)} to be a valid NOSTR event`,
        pass,
      };
    },

    toBeValidLightningInvoice(received: string): jest.CustomMatcherResult {
      const pass = /^ln(bc|tb)[a-z0-9]+$/i.test(received);
      return {
        message: (): string => `expected ${received} to be a valid Lightning invoice`,
        pass,
      };
    },
  });
}

// 🚀 Auto-setup for tests
setupAllMocks();
setupCustomMatchers();
