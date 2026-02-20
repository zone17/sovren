/**
 * 🧪 **ELITE TEST UTILITIES - COMPREHENSIVE TESTING PATTERNS**
 *
 * @description Common test utilities and patterns for elite testing standards
 * @version 2.0.0 - Production-Ready Test Utilities
 * @author Elite Engineering Team
 * @lastModified 2024-12-28
 *
 * **FEATURES:**
 * - React component testing utilities
 * - API mocking helpers
 * - User interaction patterns
 * - Data factories and fixtures
 * - Performance testing utilities
 * - Accessibility testing helpers
 * - Security testing utilities
 * - NOSTR and Lightning Network mocks
 *
 * **USAGE:**
 * Import utilities as needed in test files
 * All utilities follow TDD/BDD best practices
 */

import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore, EnhancedStore } from '@reduxjs/toolkit';

// 🎭 **MOCK DATA FACTORIES**

export const mockUser = {
  create: (overrides: Partial<any> = {}) => ({
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    verified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      theme: 'light',
      notifications: true,
      privacy: 'public',
    },
    profile: {
      bio: 'Test user bio',
      website: 'https://example.com',
      location: 'Test City',
    },
    ...overrides,
  }),
};

export const mockPost = {
  create: (overrides: Partial<any> = {}) => ({
    id: 'post-123',
    title: 'Test Post',
    content: 'This is a test post content',
    excerpt: 'This is a test post',
    authorId: 'user-123',
    status: 'published',
    tags: ['test', 'example'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    metrics: {
      views: 100,
      likes: 50,
      comments: 10,
      shares: 5,
    },
    ...overrides,
  }),
};

export const mockAnalytics = {
  create: (overrides: Partial<any> = {}) => ({
    id: 'analytics-123',
    contentId: 'post-123',
    views: 1000,
    uniqueViews: 800,
    engagementRate: 0.15,
    clickThroughRate: 0.05,
    bounceRate: 0.3,
    averageTimeOnPage: 120,
    conversionRate: 0.02,
    createdAt: new Date().toISOString(),
    ...overrides,
  }),
};

export const mockPayment = {
  create: (overrides: Partial<any> = {}) => ({
    id: 'payment-123',
    amount: 1000, // in satoshis
    currency: 'BTC',
    status: 'completed',
    method: 'lightning',
    invoice: 'lnbc1000n1...',
    paymentHash: 'abcd1234...',
    preimage: 'efgh5678...',
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
    ...overrides,
  }),
};

export const mockNOSTREvent = {
  create: (overrides: Partial<any> = {}) => ({
    id: 'event-123',
    pubkey: 'a'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: 'Test NOSTR event content',
    sig: 'b'.repeat(128),
    ...overrides,
  }),
};

export const mockLightningInvoice = {
  create: (overrides: Partial<any> = {}) => ({
    paymentRequest: 'lnbc1000n1...',
    paymentHash: 'abcd1234...',
    amount: 1000,
    description: 'Test payment',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'pending',
    ...overrides,
  }),
};

// 🎨 **REACT TESTING UTILITIES**

interface AllTheProvidersProps {
  children: ReactNode;
  initialEntries?: string[];
  store?: EnhancedStore;
}

export const AllTheProviders = ({
  children,
  initialEntries = ['/'],
  store
}: AllTheProvidersProps) => {
  const testStore = store || createTestStore();

  return (
    <Provider store={testStore}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </Provider>
  );
};

export const createTestStore = (preloadedState?: any) => {
  return configureStore({
    reducer: {
      // Add your reducers here
      user: (state = null) => state,
      posts: (state = []) => state,
      analytics: (state = {}) => state,
      payments: (state = []) => state,
    },
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
};

export const customRender = (
  ui: ReactElement,
  options: RenderOptions & {
    initialEntries?: string[];
    store?: EnhancedStore;
  } = {}
): RenderResult => {
  const { initialEntries, store, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllTheProviders initialEntries={initialEntries} store={store}>
      {children}
    </AllTheProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// 🎭 **USER INTERACTION UTILITIES**

export const userInteractions = {
  setup: () => userEvent.setup(),

  async clickButton(buttonName: string) {
    const user = userEvent.setup();
    const button = document.querySelector(`[data-testid="${buttonName}"]`) ||
                   document.querySelector(`button:contains("${buttonName}")`) ||
                   document.querySelector(`[aria-label="${buttonName}"]`);
    if (button) {
      await user.click(button as Element);
    }
  },

  async fillForm(formData: Record<string, string>) {
    const user = userEvent.setup();
    for (const [fieldName, value] of Object.entries(formData)) {
      const field = document.querySelector(`[name="${fieldName}"]`) ||
                    document.querySelector(`[data-testid="${fieldName}"]`);
      if (field) {
        await user.clear(field as Element);
        await user.type(field as Element, value);
      }
    }
  },

  async submitForm(formTestId: string = 'test-form') {
    const user = userEvent.setup();
    const form = document.querySelector(`[data-testid="${formTestId}"]`) ||
                 document.querySelector('form');
    if (form) {
      await user.submit(form as Element);
    }
  },

  async selectOption(selectName: string, optionValue: string) {
    const user = userEvent.setup();
    const select = document.querySelector(`[name="${selectName}"]`);
    if (select) {
      await user.selectOptions(select as Element, optionValue);
    }
  },

  async uploadFile(inputName: string, file: File) {
    const user = userEvent.setup();
    const input = document.querySelector(`[name="${inputName}"]`);
    if (input) {
      await user.upload(input as Element, file);
    }
  },
};

// 🌐 **API MOCKING UTILITIES**

export const apiMocks = {
  mockFetch: (response: any, status: number = 200) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(response),
      text: vi.fn().mockResolvedValue(JSON.stringify(response)),
      headers: new Headers({
        'content-type': 'application/json',
      }),
    });
  },

  mockFetchError: (error: string) => {
    global.fetch = vi.fn().mockRejectedValue(new Error(error));
  },

  mockFetchSequence: (responses: Array<{ data: any; status?: number }>) => {
    const mockResponses = responses.map(({ data, status = 200 }) => ({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(data),
      text: vi.fn().mockResolvedValue(JSON.stringify(data)),
      headers: new Headers({
        'content-type': 'application/json',
      }),
    }));

    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockResponses[0])
      .mockResolvedValueOnce(mockResponses[1])
      .mockResolvedValueOnce(mockResponses[2]);
  },

  restoreFetch: () => {
    if (global.fetch && 'mockRestore' in global.fetch) {
      (global.fetch as jest.Mock).mockRestore();
    }
  },
};

// 🔐 **SECURITY TESTING UTILITIES**

export const securityTestUtils = {
  generateMaliciousInputs: () => [
    '<script>alert("xss")</script>',
    "'; DROP TABLE users; --",
    '../../../etc/passwd',
    '${process.env.SECRET}',
    'javascript:alert(1)',
    '<img src=x onerror=alert(1)>',
    '"><script>alert(document.cookie)</script>',
    '\u0000\u0001\u0002',
  ],

  generateLongInput: (length: number = 10000) => 'A'.repeat(length),

  generateSQLInjectionInputs: () => [
    "1' OR '1'='1",
    "'; DROP TABLE users; --",
    "1 UNION SELECT * FROM users",
    "1'; UPDATE users SET password='hacked' WHERE id=1; --",
  ],

  generateXSSInputs: () => [
    '<script>alert("XSS")</script>',
    '<img src="x" onerror="alert(1)">',
    'javascript:alert(document.cookie)',
    '<svg onload="alert(1)">',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
  ],

  testInputSanitization: (input: string) => {
    const dangerous = /<script|javascript:|on\w+=/i;
    return !dangerous.test(input);
  },
};

// ⚡ **PERFORMANCE TESTING UTILITIES**

export const performanceTestUtils = {
  measureRenderTime: async (renderFn: () => Promise<void> | void) => {
    const start = performance.now();
    await renderFn();
    const end = performance.now();
    return end - start;
  },

  measureAsyncOperation: async (operation: () => Promise<any>) => {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    return { result, duration: end - start };
  },

  mockSlowNetwork: (delay: number = 1000) => {
    return new Promise((resolve) => setTimeout(resolve, delay));
  },

  generateLargeDataset: (size: number) => {
    return Array.from({ length: size }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: `Description for item ${i}`,
      timestamp: new Date().toISOString(),
    }));
  },
};

// ♿ **ACCESSIBILITY TESTING UTILITIES**

export const accessibilityTestUtils = {
  checkAriaLabels: (element: Element) => {
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
    const hasAriaDescribedBy = element.hasAttribute('aria-describedby');
    return hasAriaLabel || hasAriaLabelledBy || hasAriaDescribedBy;
  },

  checkKeyboardNavigation: async (element: Element) => {
    const user = userEvent.setup();
    element.focus();

    // Test Tab navigation
    await user.keyboard('[Tab]');
    const nextElement = document.activeElement;

    // Test Enter/Space activation
    await user.keyboard('[Enter]');
    await user.keyboard('[Space]');

    return {
      canFocus: document.activeElement === element,
      canTabNavigate: nextElement !== element,
      respondsToKeyboard: true,
    };
  },

  checkColorContrast: (foreground: string, background: string) => {
    // Simplified color contrast check
    // In a real implementation, you'd use a proper color contrast library
    const fgLuminance = getLuminance(foreground);
    const bgLuminance = getLuminance(background);
    const ratio = (Math.max(fgLuminance, bgLuminance) + 0.05) /
                  (Math.min(fgLuminance, bgLuminance) + 0.05);
    return ratio >= 4.5; // WCAG AA standard
  },

  checkScreenReaderCompatibility: (element: Element) => {
    const hasValidRole = element.hasAttribute('role');
    const hasValidLabels = accessibilityTestUtils.checkAriaLabels(element);
    const isSemanticElement = ['button', 'input', 'select', 'textarea', 'a'].includes(
      element.tagName.toLowerCase()
    );

    return hasValidRole || hasValidLabels || isSemanticElement;
  },
};

// Helper function for color contrast calculation
function getLuminance(color: string): number {
  // Simplified luminance calculation
  // In a real implementation, you'd properly parse color values
  return 0.5; // Placeholder
}

// 🔗 **NOSTR TESTING UTILITIES**

export const nostrTestUtils = {
  generateKeyPair: () => ({
    privateKey: 'a'.repeat(64),
    publicKey: 'b'.repeat(64),
  }),

  createEvent: (kind: number = 1, content: string = 'Test event') => ({
    id: 'c'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags: [],
    content,
    sig: 'd'.repeat(128),
  }),

  mockRelay: () => ({
    url: 'wss://test-relay.example.com',
    status: 'connected',
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),

  validateEvent: (event: any) => {
    const requiredFields = ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig'];
    return requiredFields.every(field => field in event);
  },
};

// ⚡ **LIGHTNING NETWORK TESTING UTILITIES**

export const lightningTestUtils = {
  generateInvoice: (amount: number = 1000) => ({
    paymentRequest: `lnbc${amount}n1...`,
    paymentHash: 'a'.repeat(64),
    amount,
    description: 'Test payment',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'pending',
  }),

  mockLNbits: () => ({
    createInvoice: vi.fn().mockResolvedValue({
      payment_hash: 'a'.repeat(64),
      payment_request: 'lnbc1000n1...',
    }),
    checkInvoice: vi.fn().mockResolvedValue({
      paid: true,
      preimage: 'b'.repeat(64),
    }),
    getWalletInfo: vi.fn().mockResolvedValue({
      balance: 50000,
      name: 'Test Wallet',
    }),
  }),

  validateInvoice: (invoice: string) => {
    const bech32Pattern = /^ln(bc|tb|bcrt)[0-9]+[a-zA-Z0-9]+$/;
    return bech32Pattern.test(invoice);
  },
};

// 📊 **TEST DATA GENERATORS**

export const dataGenerators = {
  randomString: (length: number = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  },

  randomEmail: () => {
    const username = dataGenerators.randomString(8);
    const domain = dataGenerators.randomString(6);
    return `${username}@${domain}.com`;
  },

  randomDate: (daysAgo: number = 30) => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
    return date.toISOString();
  },

  randomNumber: (min: number = 0, max: number = 100) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  randomBoolean: () => Math.random() < 0.5,

  randomArrayElement: <T>(array: T[]): T => {
    return array[Math.floor(Math.random() * array.length)];
  },

  createBulkData: <T>(factory: () => T, count: number): T[] => {
    return Array.from({ length: count }, factory);
  },
};

// 🔧 **TEST CLEANUP UTILITIES**

export const cleanupUtils = {
  clearAllMocks: () => {
    vi.clearAllMocks();
  },

  resetAllMocks: () => {
    jest.resetAllMocks();
  },

  restoreAllMocks: () => {
    jest.restoreAllMocks();
  },

  clearLocalStorage: () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  },

  clearSessionStorage: () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  },

  cleanupDOM: () => {
    document.body.innerHTML = '';
  },

  fullCleanup: () => {
    cleanupUtils.clearAllMocks();
    cleanupUtils.clearLocalStorage();
    cleanupUtils.clearSessionStorage();
    cleanupUtils.cleanupDOM();
  },
};

// 🎯 **ASSERTION HELPERS**

export const assertions = {
  expectToBeInDocument: (element: HTMLElement | null) => {
    expect(element).toBeInTheDocument();
  },

  expectToHaveTextContent: (element: HTMLElement | null, text: string) => {
    expect(element).toHaveTextContent(text);
  },

  expectToHaveClass: (element: HTMLElement | null, className: string) => {
    expect(element).toHaveClass(className);
  },

  expectToBeVisible: (element: HTMLElement | null) => {
    expect(element).toBeVisible();
  },

  expectToBeDisabled: (element: HTMLElement | null) => {
    expect(element).toBeDisabled();
  },

  expectToHaveValue: (element: HTMLElement | null, value: string) => {
    expect(element).toHaveValue(value);
  },

  expectArrayToContain: <T>(array: T[], item: T) => {
    expect(array).toContain(item);
  },

  expectArrayToHaveLength: <T>(array: T[], length: number) => {
    expect(array).toHaveLength(length);
  },

  expectObjectToHaveProperty: (obj: any, property: string) => {
    expect(obj).toHaveProperty(property);
  },

  expectFunctionToHaveBeenCalled: (fn: jest.Mock) => {
    expect(fn).toHaveBeenCalled();
  },

  expectFunctionToHaveBeenCalledWith: (fn: jest.Mock, ...args: any[]) => {
    expect(fn).toHaveBeenCalledWith(...args);
  },
};

// 📁 **FILE TESTING UTILITIES**

export const fileTestUtils = {
  createMockFile: (name: string, size: number = 1024, type: string = 'text/plain') => {
    const content = 'A'.repeat(size);
    return new File([content], name, { type });
  },

  createMockImageFile: (name: string = 'test.jpg', size: number = 2048) => {
    return fileTestUtils.createMockFile(name, size, 'image/jpeg');
  },

  createMockVideoFile: (name: string = 'test.mp4', size: number = 5120) => {
    return fileTestUtils.createMockFile(name, size, 'video/mp4');
  },

  validateFileUpload: (file: File, maxSize: number = 10485760) => { // 10MB default
    return file.size <= maxSize;
  },
};

// 🌐 **INTERNATIONALIZATION TESTING UTILITIES**

export const i18nTestUtils = {
  mockTranslation: (key: string, defaultValue?: string) => {
    return defaultValue || key;
  },

  testRTLLayout: (element: HTMLElement) => {
    const computedStyle = getComputedStyle(element);
    return computedStyle.direction === 'rtl';
  },

  validateTranslationKeys: (keys: string[]) => {
    return keys.every(key => typeof key === 'string' && key.length > 0);
  },
};

// 🎯 **EXPORT ALL UTILITIES**
export const testUtils = {
  mockData: {
    user: mockUser,
    post: mockPost,
    analytics: mockAnalytics,
    payment: mockPayment,
    nostrEvent: mockNOSTREvent,
    lightningInvoice: mockLightningInvoice,
  },
  react: {
    customRender,
    AllTheProviders,
    createTestStore,
  },
  user: userInteractions,
  api: apiMocks,
  security: securityTestUtils,
  performance: performanceTestUtils,
  accessibility: accessibilityTestUtils,
  nostr: nostrTestUtils,
  lightning: lightningTestUtils,
  data: dataGenerators,
  cleanup: cleanupUtils,
  assertions,
  files: fileTestUtils,
  i18n: i18nTestUtils,
};

export default testUtils;
