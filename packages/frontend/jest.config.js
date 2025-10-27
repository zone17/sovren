/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',

    // 🌐 **IPFS/Helia Module Mocks**
    '^@helia/unixfs$': '<rootDir>/src/test-utils/__mocks__/@helia/unixfs.js',
    '^@helia/http$': '<rootDir>/src/test-utils/__mocks__/@helia/http.js',
    '^helia$': '<rootDir>/src/test-utils/__mocks__/helia.js',

    // 📦 **Arweave Mock**
    '^arweave$': '<rootDir>/src/test-utils/__mocks__/arweave.js',

    // 🔗 **NOSTR Tools Mock**
    '^nostr-tools$': '<rootDir>/src/test-utils/__mocks__/nostr-tools.js',

    // 🔐 **Noble Crypto Mock**
    '^@noble/secp256k1$': '<rootDir>/src/test-utils/__mocks__/@noble/secp256k1.js',

    // 🎨 **TipTap Mocks**
    '^@tiptap/react$': '<rootDir>/src/test-utils/__mocks__/@tiptap/react.js',
    '^@tiptap/starter-kit$': '<rootDir>/src/test-utils/__mocks__/@tiptap/starter-kit.js',
    '^@tiptap/extension-(.*)$': '<rootDir>/src/test-utils/__mocks__/@tiptap/extension.js',

    // 📊 **Web Vitals Mock**
    '^web-vitals$': '<rootDir>/src/test-utils/__mocks__/web-vitals.js',

    // ⚡ **Stripe Mock**
    '^stripe$': '<rootDir>/src/test-utils/__mocks__/stripe.js',

    // 📧 **Nodemailer Mock**
    '^nodemailer$': '<rootDir>/src/test-utils/__mocks__/nodemailer.js',

    // 🔄 **CSS and Static Assets**
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      'jest-transform-stub',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testTimeout: 15000,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/test-utils/**/*',
    '!src/**/__mocks__/**/*',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  moduleDirectories: ['node_modules', '<rootDir>/src'],

  // 🌐 **TEST ENVIRONMENT SETUP**
  globals: {
    'import.meta': {
      env: {
        DEV: false,
        NODE_ENV: 'test',
        MODE: 'test',
        // Vite environment variables for testing
        VITE_SUPABASE_URL: 'https://test-project.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key',
        VITE_ENABLE_CMS: 'true',
        VITE_ENABLE_AI_ASSISTANT: 'true',
        VITE_ENABLE_NOSTR_INTEGRATION: 'true',
        VITE_ENABLE_LIGHTNING_PAYMENTS: 'true',
      },
    },
  },

  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  fakeTimers: {
    enableGlobally: false,
  },
  maxWorkers: 1,
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|lucide-react|recharts|@noble|nostr-tools))'],
};

export default config;
