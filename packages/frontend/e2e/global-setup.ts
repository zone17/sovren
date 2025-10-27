/**
 * 🌐 Playwright Global Setup
 * Prepares test environment before all tests run
 */
import { chromium, FullConfig } from '@playwright/test';
import { NostrEvent } from 'nostr-tools';

async function globalSetup(config: FullConfig) {
  console.log('🚀 [Global Setup] Starting E2E test environment initialization');

  // Ensure test data directory exists
  const testDataDir = './e2e/test-data';
  try {
    const fs = await import('fs/promises');
    await fs.mkdir(testDataDir, { recursive: true });
    console.log('✅ [Global Setup] Test data directory created');
  } catch (error) {
    console.error('❌ [Global Setup] Failed to create test data directory:', error);
  }

  // Initialize test browser for setup tasks
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Clear any existing test data from localStorage/IndexedDB
    await page.goto(config.projects[0].use.baseURL || 'http://localhost:3000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear IndexedDB
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const dbs = indexedDB.databases();
        dbs.then((databases) => {
          databases.forEach((db) => {
            if (db.name) indexedDB.deleteDatabase(db.name);
          });
          resolve();
        });
      });
    });

    console.log('✅ [Global Setup] Cleared browser storage');

    // Verify app is accessible
    const response = await page.goto(config.projects[0].use.baseURL || 'http://localhost:3000');
    if (!response || response.status() !== 200) {
      throw new Error(`App not accessible: ${response?.status()}`);
    }

    console.log('✅ [Global Setup] Verified app accessibility');
  } catch (error) {
    console.error('❌ [Global Setup] Setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('🎉 [Global Setup] Environment ready for E2E tests');
}

export default globalSetup;
