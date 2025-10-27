/**
 * 🧪 **ELITE ENVIRONMENT SETUP - COMPREHENSIVE TESTING ENVIRONMENT**
 *
 * @description Environment setup for elite Jest testing standards
 * @version 2.0.0 - Production-Ready Test Environment
 * @author Elite Engineering Team
 * @lastModified 2024-12-28
 *
 * **FEATURES:**
 * - Comprehensive environment variables
 * - Mock service configurations
 * - Test database setup
 * - Security settings for testing
 * - Performance monitoring setup
 * - NOSTR and Lightning Network mocks
 *
 * **USAGE:**
 * This file is automatically loaded before all tests
 * through the Jest setupFiles configuration
 */

// 🌐 **GLOBAL ENVIRONMENT VARIABLES**
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';

// 🎯 **TEST CONFIGURATION**
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';
process.env.TEST_TIMEOUT = '30000';
process.env.TEST_VERBOSE = 'true';

// 🗄️ **DATABASE CONFIGURATION**
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/sovren_test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// 🔐 **AUTHENTICATION & SECURITY**
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.API_SECRET_KEY = 'test-api-secret-key';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters!';
process.env.SESSION_SECRET = 'test-session-secret';

// 🔗 **NOSTR CONFIGURATION**
process.env.NOSTR_RELAY_URL = 'wss://test-relay.example.com';
process.env.NOSTR_PRIVATE_KEY = 'test-private-key-64-chars-hex';
process.env.NOSTR_PUBLIC_KEY = 'test-public-key-64-chars-hex';
process.env.NIP05_DOMAIN = 'test.example.com';

// ⚡ **LIGHTNING NETWORK CONFIGURATION**
process.env.LNBITS_URL = 'https://test-lnbits.example.com';
process.env.LNBITS_API_KEY = 'test-lnbits-api-key';
process.env.LIGHTNING_NODE_URL = 'test-lightning-node.example.com';
process.env.LIGHTNING_MACAROON = 'test-macaroon';

// 📧 **EMAIL CONFIGURATION**
process.env.SMTP_HOST = 'test-smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test-password';
process.env.FROM_EMAIL = 'noreply@test.example.com';

// 💳 **PAYMENT CONFIGURATION**
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123456789';
process.env.STRIPE_SECRET_KEY = 'sk_test_123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123456789';

// 🌐 **EXTERNAL SERVICES**
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.IPFS_GATEWAY = 'https://test-ipfs.example.com';
process.env.ARWEAVE_GATEWAY = 'https://test-arweave.example.com';

// 📊 **MONITORING & ANALYTICS**
process.env.SENTRY_DSN = 'https://test@sentry.io/test';
process.env.ANALYTICS_API_KEY = 'test-analytics-key';
process.env.PERFORMANCE_API_KEY = 'test-performance-key';

// 🔍 **LOGGING CONFIGURATION**
process.env.LOG_LEVEL = 'error';
process.env.LOG_FORMAT = 'json';
process.env.LOG_FILE = '/dev/null';

// 🎨 **FRONTEND CONFIGURATION**
process.env.VITE_API_URL = 'http://localhost:3000/api';
process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
process.env.VITE_STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
process.env.VITE_NOSTR_RELAY_URL = process.env.NOSTR_RELAY_URL;

// 🚀 **DEPLOYMENT CONFIGURATION**
process.env.VERCEL_URL = 'https://test.vercel.app';
process.env.VERCEL_ENV = 'test';
process.env.DEPLOYMENT_URL = 'https://test.sovren.app';

// 🔧 **FEATURE FLAGS**
process.env.FEATURE_AI_ENHANCED = 'true';
process.env.FEATURE_LIGHTNING_PAYMENTS = 'true';
process.env.FEATURE_NOSTR_AUTH = 'true';
process.env.FEATURE_ADVANCED_ANALYTICS = 'true';
process.env.FEATURE_REAL_TIME_UPDATES = 'true';

// 🌟 **ELITE TESTING FLAGS**
process.env.ENABLE_TEST_MOCKING = 'true';
process.env.ENABLE_PERFORMANCE_TESTING = 'true';
process.env.ENABLE_SECURITY_TESTING = 'true';
process.env.ENABLE_ACCESSIBILITY_TESTING = 'true';
process.env.ENABLE_VISUAL_REGRESSION_TESTING = 'true';

// 🎯 **TESTING BEHAVIOR CONFIGURATION**
process.env.MOCK_EXTERNAL_APIS = 'true';
process.env.MOCK_PAYMENT_PROCESSING = 'true';
process.env.MOCK_EMAIL_SENDING = 'true';
process.env.MOCK_FILE_UPLOADS = 'true';
process.env.MOCK_REAL_TIME_FEATURES = 'true';

// 📱 **MOBILE TESTING CONFIGURATION**
process.env.MOBILE_VIEWPORT_WIDTH = '375';
process.env.MOBILE_VIEWPORT_HEIGHT = '667';
process.env.TABLET_VIEWPORT_WIDTH = '768';
process.env.TABLET_VIEWPORT_HEIGHT = '1024';

// 🔍 **BROWSER TESTING CONFIGURATION**
process.env.HEADLESS_BROWSER = 'true';
process.env.BROWSER_TIMEOUT = '30000';
process.env.SCREENSHOT_ON_FAILURE = 'true';
process.env.VIDEO_RECORDING = 'false'; // Disabled for performance

// 🎭 **MOCK CONFIGURATION**
process.env.MOCK_NETWORK_DELAY = '100'; // ms
process.env.MOCK_ERROR_RATE = '0.05'; // 5% error rate for resilience testing
process.env.MOCK_LATENCY_VARIATION = '50'; // ms variation

// 🔐 **SECURITY TESTING CONFIGURATION**
process.env.SECURITY_SCAN_ENABLED = 'true';
process.env.VULNERABILITY_SCAN_ENABLED = 'true';
process.env.PENETRATION_TEST_MODE = 'false'; // Only enabled for specific tests

// ⚡ **PERFORMANCE TESTING CONFIGURATION**
process.env.PERFORMANCE_BUDGET_LOAD_TIME = '2000'; // 2 seconds
process.env.PERFORMANCE_BUDGET_FCP = '1500'; // First Contentful Paint
process.env.PERFORMANCE_BUDGET_LCP = '2500'; // Largest Contentful Paint
process.env.PERFORMANCE_BUDGET_FID = '100'; // First Input Delay
process.env.PERFORMANCE_BUDGET_CLS = '0.1'; // Cumulative Layout Shift

// 🌐 **GLOBAL FETCH MOCK SETUP**
if (typeof global !== 'undefined') {
  // @ts-ignore
  global.fetch = require('jest-fetch-mock');
  // @ts-ignore
  global.AbortController = class AbortController {
    signal = { aborted: false };
    abort() {
      this.signal.aborted = true;
    }
  };
}

// 📱 **MOBILE API MOCKS**
if (typeof global !== 'undefined') {
  Object.assign(global, {
    navigator: {
      ...global.navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      maxTouchPoints: 5,
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
        readText: jest.fn().mockResolvedValue(''),
      },
      share: jest.fn().mockResolvedValue(undefined),
      geolocation: {
        getCurrentPosition: jest.fn(),
        watchPosition: jest.fn(),
        clearWatch: jest.fn(),
      },
    },
  });
}

// 🎯 **WINDOW OBJECT MOCKS**
if (typeof window !== 'undefined') {
  // Mock window.crypto for cryptographic operations
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      subtle: {
        digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
        sign: jest.fn().mockResolvedValue(new ArrayBuffer(64)),
        verify: jest.fn().mockResolvedValue(true),
        generateKey: jest.fn().mockResolvedValue({
          privateKey: {},
          publicKey: {},
        }),
      },
    },
    writable: true,
  });

  // Mock window.localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    },
    writable: true,
  });

  // Mock window.sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    },
    writable: true,
  });

  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/',
      search: '',
      hash: '',
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
    },
    writable: true,
  });

  // Mock window.ResizeObserver
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock window.IntersectionObserver
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
    writable: true,
  });
}

// 🎨 **CSS MOCKS**
if (typeof window !== 'undefined') {
  // Mock getComputedStyle
  global.getComputedStyle = jest.fn().mockImplementation(() => ({
    getPropertyValue: jest.fn().mockReturnValue(''),
    setProperty: jest.fn(),
    removeProperty: jest.fn(),
  }));
}

// 📊 **PERFORMANCE API MOCKS**
if (typeof global !== 'undefined') {
  global.performance = {
    ...global.performance,
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn().mockReturnValue([]),
    getEntriesByName: jest.fn().mockReturnValue([]),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
  };
}

// 📡 **WEBSOCKET MOCKS**
if (typeof global !== 'undefined') {
  global.WebSocket = jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    send: jest.fn(),
    readyState: 1, // OPEN
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

// 🔔 **NOTIFICATION MOCKS**
if (typeof global !== 'undefined') {
  global.Notification = jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));

  // @ts-ignore
  global.Notification.permission = 'granted';
  // @ts-ignore
  global.Notification.requestPermission = jest.fn().mockResolvedValue('granted');
}

// 🎯 **CANVAS MOCKS**
if (typeof global !== 'undefined') {
  global.HTMLCanvasElement.prototype.getContext = jest.fn().mockImplementation(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn().mockImplementation(() => ({
      data: new Array(4).fill(255),
    })),
    putImageData: jest.fn(),
    createImageData: jest.fn().mockImplementation(() => []),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn().mockReturnValue({ width: 0 }),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
  }));
}

// 🚨 **ERROR BOUNDARY TESTING**
if (typeof global !== 'undefined') {
  global.console = {
    ...global.console,
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

// 📱 **TOUCH EVENT MOCKS**
if (typeof global !== 'undefined') {
  global.TouchEvent = class TouchEvent extends Event {
    touches = [];
    targetTouches = [];
    changedTouches = [];
    constructor(type, options) {
      super(type, options);
    }
  };
}

// 🎯 **SETUP COMPLETE**
console.log('🧪 Elite environment setup completed successfully!');
console.log('🌐 Test environment configured with comprehensive mocks and utilities');
console.log(
  '📊 Environment variables:',
  Object.keys(process.env).filter(
    (key) => key.startsWith('TEST_') || key.startsWith('VITE_') || key.startsWith('FEATURE_')
  ).length
);

// 🔍 **VALIDATION**
if (process.env.NODE_ENV !== 'test') {
  console.warn('⚠️  Warning: NODE_ENV is not set to "test"');
}

if (!process.env.JEST_WORKER_ID) {
  console.warn('⚠️  Warning: JEST_WORKER_ID not detected');
}
