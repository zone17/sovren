/**
 * Jest Global Teardown
 *
 * This file runs once after all test suites.
 * Used for cleanup that affects all tests.
 */

module.exports = async () => {
  // Clean up any global resources
  console.log('🧹 Cleaning up after Jest test suite...');

  // Close database connections if needed
  // Stop test servers if needed
  // Any other cleanup
};
