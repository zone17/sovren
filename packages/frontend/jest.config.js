module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  // Elite testing: Mock import.meta for Jest compatibility
  globals: {
    'import.meta': {
      env: {
        DEV: false,
        NODE_ENV: 'test',
      },
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(web-vitals)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  coverageThreshold: {
    // ELITE STANDARDS: Differentiated coverage by code type
    global: {
      statements: 60, // Adjusted for monitoring infrastructure
      branches: 50,
      functions: 60,
      lines: 60,
    },

    // 🏆 CORE BUSINESS LOGIC - HIGHEST STANDARDS (Google/Netflix level)
    'src/pages/**/*.{ts,tsx}': {
      statements: 90,  // User-facing features must be bulletproof
      branches: 85,
      functions: 90,
      lines: 90,
    },
    'src/store/**/*.{ts,tsx}': {
      statements: 95,  // State management is critical
      branches: 90,
      functions: 95,
      lines: 95,
    },
    'src/components/**/*.{ts,tsx}': {
      statements: 85,  // UI components need high confidence
      branches: 80,
      functions: 85,
      lines: 85,
    },
    'src/hooks/**/*.{ts,tsx}': {
      statements: 90,  // Custom hooks are reusable logic
      branches: 85,
      functions: 90,
      lines: 90,
    },

    // 🔧 INFRASTRUCTURE CODE - MODERATE STANDARDS
    'src/monitoring/**/*.{ts,tsx}': {
      statements: 40,  // Monitoring code interfaces with browser APIs
      branches: 30,
      functions: 40,
      lines: 40,
    },

    // 🤖 AI/ML CODE - HIGH STANDARDS (when we add it)
    'src/ai/**/*.{ts,tsx}': {
      statements: 85,  // AI logic needs testing but ML models are hard to test
      branches: 75,
      functions: 85,
      lines: 85,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
      },
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
