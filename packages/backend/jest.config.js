/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true,
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/server.ts', // Exclude server entry point from coverage
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@sovren/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
  extensionsToTreatAsEsm: [],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  restoreMocks: true,
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: 'tsconfig.test.json'
    }
  }
};
