/**
 * 💾 E2E Tests: Backup and Recovery
 * Tests key backup, data export, and recovery mechanisms
 */
import { test, expect, Page } from '@playwright/test';
import { ALICE, BOB } from './fixtures/test-users';

test.describe('NOSTR Backup and Recovery E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Set up Alice's key
    await page.evaluate((alice) => {
      localStorage.setItem('nostr_keypair_encrypted', JSON.stringify({
        privateKey: alice.privateKeyHex,
        publicKey: alice.publicKey,
        created: Date.now(),
      }));
    }, ALICE);
  });

  test.describe('Key Backup Creation', () => {
    test('should create mnemonic backup', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'mnemonic');

      await page.click('button:has-text("Generate Backup")');

      // Should show mnemonic phrase
      await expect(page.getByText(/mnemonic|seed phrase|recovery phrase/i)).toBeVisible({ timeout: 10000 });

      // Should have 12 or 24 words
      const mnemonicWords = await page.locator('[data-mnemonic-word]').count();
      expect([12, 24]).toContain(mnemonicWords);
    });

    test('should create encrypted file backup', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'file');

      // Set encryption password
      await page.fill('input[name="password"]', 'SecurePassword123!');
      await page.fill('input[name="confirm-password"]', 'SecurePassword123!');

      await page.click('button:has-text("Create Backup")');

      // Should trigger download
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Download")');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('.backup');
    });

    test('should create QR code backup', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'qr');

      await page.click('button:has-text("Generate QR Code")');

      // Should display QR code
      await expect(page.locator('canvas, svg[data-qr-code]')).toBeVisible({ timeout: 5000 });
    });

    test('should create social recovery backup', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'social_recovery');

      // Add guardians
      await page.fill('input[name="guardian-1"]', BOB.npub);
      await page.click('button:has-text("Add Guardian")');

      await page.click('button:has-text("Create Social Recovery")');

      // Should show recovery shares
      await expect(page.getByText(/recovery shares|shards/i)).toBeVisible({ timeout: 10000 });
    });

    test('should encrypt backup with password', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'mnemonic');

      await page.fill('input[name="password"]', 'Test123!');
      await page.click('button:has-text("Generate Backup")');

      // Should show encrypted backup indicator
      await expect(page.getByText(/encrypted|password protected/i)).toBeVisible();
    });

    test('should validate backup password strength', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');

      // Try weak password
      await page.fill('input[name="password"]', 'weak');

      // Should show strength indicator
      await expect(page.getByText(/weak|strength/i)).toBeVisible();
    });

    test('should require password confirmation', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');

      await page.fill('input[name="password"]', 'Test123!');
      await page.fill('input[name="confirm-password"]', 'Different123!');

      await page.click('button:has-text("Create Backup")');

      // Should show mismatch error
      await expect(page.getByText(/passwords.*match/i)).toBeVisible();
    });

    test('should track backup creation date', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'mnemonic');
      await page.click('button:has-text("Generate Backup")');

      // Navigate to backup list
      await page.click('text=My Backups');

      // Should show creation date
      await expect(page.getByText(/created|date/i)).toBeVisible();
    });
  });

  test.describe('Backup Verification', () => {
    test('should verify backup integrity', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      // Create backup
      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'mnemonic');
      await page.click('button:has-text("Generate Backup")');

      // Verify backup
      await page.click('button:has-text("Verify Backup")');

      // Should show verification result
      await expect(page.getByText(/verified|valid/i)).toBeVisible({ timeout: 5000 });
    });

    test('should test restore before confirming backup', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'mnemonic');
      await page.click('button:has-text("Generate Backup")');

      // Get mnemonic words
      const words: string[] = [];
      const wordElements = await page.locator('[data-mnemonic-word]').all();
      for (const element of wordElements) {
        words.push(await element.textContent() || '');
      }

      // Test restore
      await page.click('button:has-text("Test Restore")');

      // Enter mnemonic
      for (let i = 0; i < words.length; i++) {
        await page.fill(`input[name="word-${i}"]`, words[i]);
      }

      await page.click('button:has-text("Verify")');

      // Should show success
      await expect(page.getByText(/restore.*successful|backup.*valid/i)).toBeVisible({ timeout: 10000 });
    });

    test('should warn about unverified backups', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');
      await page.click('button:has-text("Generate Backup")');

      // Skip verification and try to finish
      await page.click('button:has-text("Finish"), button:has-text("Done")');

      // Should warn
      await expect(page.getByText(/not verified|verify backup/i)).toBeVisible();
    });

    test('should validate backup checksum', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'file');

      await page.fill('input[name="password"]', 'Test123!');
      await page.fill('input[name="confirm-password"]', 'Test123!');

      await page.click('button:has-text("Create Backup")');

      // Should show checksum
      await expect(page.getByText(/checksum|hash|sha256/i)).toBeVisible();
    });
  });

  test.describe('Recovery from Backup', () => {
    test('should restore from mnemonic', async () => {
      // Generate new keys first
      await page.click('text=Keys');
      await page.click('button:has-text("Generate")');
      await page.fill('input[name="name"]', 'Recovery Test Key');
      await page.click('button:has-text("Generate")');
      await page.waitForTimeout(2000);

      // Create mnemonic backup
      await page.click('text=Backup');
      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'mnemonic');
      await page.click('button:has-text("Generate Backup")');

      // Get mnemonic
      const words: string[] = [];
      const wordElements = await page.locator('[data-mnemonic-word]').all();
      for (const element of wordElements) {
        words.push(await element.textContent() || '');
      }

      // Clear storage (simulate loss)
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Restore from mnemonic
      await page.click('text=Restore');
      await page.click('button:has-text("Restore from Mnemonic")');

      // Enter mnemonic
      for (let i = 0; i < words.length; i++) {
        await page.fill(`input[name="word-${i}"]`, words[i]);
      }

      await page.click('button:has-text("Restore")');

      // Should restore successfully
      await expect(page.getByText(/restored|success/i)).toBeVisible({ timeout: 10000 });

      // Verify key is restored
      await page.click('text=Keys');
      await expect(page.getByText('Recovery Test Key')).toBeVisible();
    });

    test('should restore from encrypted file', async () => {
      // This test would require file upload, which is complex in E2E
      // Testing the UI flow only
      await page.click('text=Restore');
      await page.click('button:has-text("Restore from File")');

      // Should show file upload
      await expect(page.locator('input[type="file"]')).toBeVisible();

      // Should ask for password
      await expect(page.locator('input[name="password"], input[type="password"]')).toBeVisible();
    });

    test('should restore from QR code', async () => {
      await page.click('text=Restore');
      await page.click('button:has-text("Restore from QR Code")');

      // Should show camera/scanner interface
      await expect(page.getByText(/scan|camera|qr/i)).toBeVisible();
    });

    test('should recover using social recovery', async () => {
      await page.click('text=Restore');
      await page.click('button:has-text("Social Recovery")');

      // Should show guardian list interface
      await expect(page.getByText(/guardians|recovery shares/i)).toBeVisible();
    });

    test('should validate mnemonic during restore', async () => {
      await page.click('text=Restore');
      await page.click('button:has-text("Restore from Mnemonic")');

      // Enter invalid mnemonic
      const invalidWords = ['invalid', 'mnemonic', 'phrase', 'test', 'words', 'here', 'not', 'real', 'backup', 'data', 'wrong', 'entry'];
      for (let i = 0; i < invalidWords.length; i++) {
        await page.fill(`input[name="word-${i}"]`, invalidWords[i]);
      }

      await page.click('button:has-text("Restore")');

      // Should show validation error
      await expect(page.getByText(/invalid|checksum|mnemonic/i)).toBeVisible({ timeout: 5000 });
    });

    test('should require correct password for encrypted backup', async () => {
      await page.click('text=Restore');
      await page.click('button:has-text("Restore from File")');

      // Mock file upload (if possible in test environment)
      // Then enter wrong password
      await page.fill('input[name="password"]', 'WrongPassword123!');

      await page.click('button:has-text("Restore")');

      // Should show password error
      await expect(page.getByText(/incorrect.*password|decrypt.*failed/i)).toBeVisible();
    });
  });

  test.describe('Backup Management', () => {
    test('should list all backups', async () => {
      await page.click('text=Backup');
      await page.click('text=My Backups');

      // Should show backup list
      await expect(page.locator('[data-backup-item], [role="list"]')).toBeVisible();
    });

    test('should delete backup', async () => {
      // Create backup first
      await page.click('text=Backup');
      await page.click('button:has-text("Create Backup")');
      await page.selectOption('select[name="backup-method"]', 'mnemonic');
      await page.click('button:has-text("Generate Backup")');
      await page.click('button:has-text("Save")');

      // View backups
      await page.click('text=My Backups');

      // Delete
      await page.click('[data-backup-item]:first-child button[aria-label*="Delete"]');
      await page.click('button:has-text("Confirm Delete")');

      // Should be removed
      await expect(page.getByText(/deleted|removed/i)).toBeVisible({ timeout: 5000 });
    });

    test('should export backup', async () => {
      await page.click('text=Backup');
      await page.click('text=My Backups');

      // Export
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Export")');
      const download = await downloadPromise;

      expect(download).toBeDefined();
    });

    test('should show backup metadata', async () => {
      await page.click('text=Backup');
      await page.click('text=My Backups');

      await page.click('[data-backup-item]:first-child');

      // Should show details
      await expect(page.getByText(/created|type|encrypted|verified/i)).toBeVisible();
    });
  });

  test.describe('Data Export', () => {
    test('should export all data', async () => {
      await page.click('text=Settings');
      await page.click('text=Export Data');

      await page.click('button:has-text("Export All Data")');

      // Should trigger download
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Download")');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('.json');
    });

    test('should export keys only', async () => {
      await page.click('text=Settings');
      await page.click('text=Export Data');

      await page.check('input[name="export-keys"]');
      await page.uncheck('input[name="export-events"]');
      await page.uncheck('input[name="export-contacts"]');

      await page.click('button:has-text("Export")');

      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;

      expect(download).toBeDefined();
    });

    test('should export in different formats', async () => {
      await page.click('text=Settings');
      await page.click('text=Export Data');

      // Test JSON format
      await page.selectOption('select[name="format"]', 'json');
      await page.click('button:has-text("Export")');

      await page.waitForEvent('download');

      // Test CSV format (if supported)
      await page.selectOption('select[name="format"]', 'csv');
      await page.click('button:has-text("Export")');

      await page.waitForEvent('download');
    });
  });

  test.describe('Automated Backups', () => {
    test('should enable automatic backups', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');

      await page.click('button:has-text("Auto Backup Settings")');

      await page.check('input[name="enable-auto-backup"]');
      await page.selectOption('select[name="frequency"]', 'weekly');

      await page.click('button:has-text("Save")');

      // Should confirm settings
      await expect(page.getByText(/automatic backups.*enabled/i)).toBeVisible();
    });

    test('should configure backup schedule', async () => {
      await page.click('text=Settings');
      await page.click('text=Backup');
      await page.click('button:has-text("Auto Backup Settings")');

      await page.check('input[name="enable-auto-backup"]');

      // Set schedule options
      await page.selectOption('select[name="frequency"]', 'daily');
      await page.fill('input[name="backup-time"]', '02:00');

      await page.click('button:has-text("Save")');

      await expect(page.getByText(/scheduled|daily.*2:00/i)).toBeVisible();
    });
  });

  test.describe('Security', () => {
    test('should warn about backup security', async () => {
      await page.click('text=Backup');
      await page.click('button:has-text("Create Backup")');

      // Should show security warning
      await expect(page.getByText(/secure.*backup|keep safe|store securely/i)).toBeVisible();
    });

    test('should recommend multiple backup methods', async () => {
      await page.click('text=Backup');

      // Should show recommendation
      await expect(page.getByText(/multiple.*backups|redundant/i)).toBeVisible();
    });

    test('should sanitize backup files', async () => {
      await page.click('text=Settings');
      await page.click('text=Export Data');

      await page.click('button:has-text("Export")');

      // Should not include sensitive info in filename
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;

      const filename = download.suggestedFilename();
      expect(filename).not.toContain(ALICE.privateKeyHex);
      expect(filename).not.toContain('private');
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      await page.click('text=Backup');

      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // Should open create backup modal
      await expect(page.getByText(/create backup|backup method/i)).toBeVisible();
    });

    test('should have proper ARIA labels', async () => {
      await page.click('text=Backup');

      const backupButton = page.getByRole('button', { name: /create backup/i });
      await expect(backupButton).toHaveAccessibleName();
    });

    test('should provide clear instructions', async () => {
      await page.click('text=Restore');

      // Should have help text
      await expect(page.getByText(/enter.*mnemonic|upload.*file|scan.*qr/i)).toBeVisible();
    });
  });
});
