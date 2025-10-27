/**
 * 🧹 Playwright Global Teardown
 * Cleans up test environment after all tests complete
 */
import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 [Global Teardown] Starting cleanup');

  try {
    // Clean up test data files
    const fs = await import('fs/promises');
    const testDataDir = './e2e/test-data';

    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
      console.log('✅ [Global Teardown] Test data directory cleaned');
    } catch (error) {
      console.warn('⚠️ [Global Teardown] Could not clean test data directory:', error);
    }

    // Additional cleanup tasks can be added here
    // - Close mock relay servers
    // - Clean up temporary files
    // - Reset test databases

    console.log('✅ [Global Teardown] Cleanup complete');
  } catch (error) {
    console.error('❌ [Global Teardown] Cleanup failed:', error);
  }
}

export default globalTeardown;
