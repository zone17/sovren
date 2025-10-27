/**
 * Jest Global Setup
 *
 * This file runs once before all test suites.
 * Used for one-time setup that affects all tests.
 */

module.exports = async () => {
  // Set global test environment
  process.env.NODE_ENV = 'test';

  // Any global setup that needs to run once before all tests
  console.log('🧪 Starting Jest test suite...');

  // Initialize test database connections if needed
  // Set up test servers if needed
  // Any other one-time setup
};
