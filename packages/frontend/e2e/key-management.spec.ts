/**
 * 🔐 E2E Tests: NOSTR Key Management
 * Tests key generation, import/export, backup, and rotation
 */
import { test, expect, Page } from '@playwright/test';
import { TEST_USERS, ALICE, BOB } from './fixtures/test-users';

test.describe('NOSTR Key Management E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Navigate to key management page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Clear localStorage before each test
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('Key Generation', () => {
    test('should generate new NOSTR key pair successfully', async () => {
      // Navigate to key generation
      const generateButton = page.getByRole('button', { name: /generate key/i });
      await expect(generateButton).toBeVisible();
      await generateButton.click();

      // Fill in key details
      await page.fill('input[placeholder*="name"]', 'Test Key 1');
      await page.fill('textarea[placeholder*="description"]', 'E2E test generated key');

      // Select security level
      await page.selectOption('select', { label: 'Enhanced' });

      // Generate key
      const submitButton = page.getByRole('button', { name: /generate/i });
      await submitButton.click();

      // Wait for success message
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify key appears in list
      await page.getByRole('button', { name: /keys/i }).click();
      await expect(page.getByText('Test Key 1')).toBeVisible();

      // Verify public key is displayed
      await expect(page.locator('code').first()).toBeVisible();
    });

    test('should generate key with different security levels', async () => {
      const securityLevels = ['Basic', 'Enhanced', 'Maximum'];

      for (const level of securityLevels) {
        await page.getByRole('button', { name: /generate/i }).click();

        await page.fill('input[placeholder*="name"]', `${level} Security Key`);
        await page.selectOption('select', { label: level });

        await page.getByRole('button', { name: /generate/i }).click();
        await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

        // Verify in list
        await page.getByRole('button', { name: /keys/i }).click();
        await expect(page.getByText(`${level} Security Key`)).toBeVisible();
      }
    });

    test('should display entropy information for generated key', async () => {
      await page.getByRole('button', { name: /generate/i }).click();

      await page.fill('input[placeholder*="name"]', 'Entropy Test Key');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();

      // Verify entropy information is displayed
      await expect(page.getByText(/entropy:/i)).toBeVisible();
      await expect(page.getByText(/bits/i)).toBeVisible();
    });

    test('should generate keys with sufficient entropy', async () => {
      await page.getByRole('button', { name: /generate/i }).click();

      await page.fill('input[placeholder*="name"]', 'High Entropy Key');
      await page.selectOption('select', { label: 'Maximum' });

      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();

      // Check that entropy is >= 128 bits (minimum secure threshold)
      const entropyText = await page.getByText(/entropy:/i).textContent();
      const entropyBits = parseInt(entropyText?.match(/(\d+)\s*bits/)?.[1] || '0');
      expect(entropyBits).toBeGreaterThanOrEqual(128);
    });
  });

  test.describe('Key Import', () => {
    test('should import existing private key successfully', async () => {
      await page.getByRole('button', { name: /import/i }).click();

      // Use Alice's private key for import
      await page.fill('textarea[placeholder*="private key"]', ALICE.privateKeyHex);
      await page.fill('input[placeholder*="name"]', 'Imported Alice Key');

      await page.getByRole('button', { name: /import key/i }).click();
      await expect(page.getByText(/imported successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify key in list
      await page.getByRole('button', { name: /keys/i }).click();
      await expect(page.getByText('Imported Alice Key')).toBeVisible();

      // Verify public key matches
      const publicKeyElement = page.locator('code').first();
      const displayedPubkey = await publicKeyElement.textContent();
      expect(displayedPubkey).toContain(ALICE.publicKey.slice(0, 16));
    });

    test('should reject invalid private key format', async () => {
      await page.getByRole('button', { name: /import/i }).click();

      // Try to import invalid key
      await page.fill('textarea[placeholder*="private key"]', 'invalid-key-format');
      await page.fill('input[placeholder*="name"]', 'Invalid Key');

      await page.getByRole('button', { name: /import key/i }).click();

      // Expect error message
      await expect(page.getByText(/invalid|failed/i)).toBeVisible({ timeout: 5000 });
    });

    test('should reject short private keys', async () => {
      await page.getByRole('button', { name: /import/i }).click();

      // Try to import key that's too short
      await page.fill('textarea[placeholder*="private key"]', 'a'.repeat(32)); // Only 32 chars instead of 64
      await page.fill('input[placeholder*="name"]', 'Short Key');

      await page.getByRole('button', { name: /import key/i }).click();
      await expect(page.getByText(/invalid|length/i)).toBeVisible({ timeout: 5000 });
    });

    test('should import multiple keys successfully', async () => {
      const testKeys = [ALICE, BOB];

      for (const user of testKeys) {
        await page.getByRole('button', { name: /import/i }).click();

        await page.fill('textarea[placeholder*="private key"]', user.privateKeyHex);
        await page.fill('input[placeholder*="name"]', `${user.profile.name} Key`);

        await page.getByRole('button', { name: /import key/i }).click();
        await expect(page.getByText(/imported successfully/i)).toBeVisible({ timeout: 10000 });
      }

      // Verify both keys are in list
      await page.getByRole('button', { name: /keys/i }).click();
      await expect(page.getByText('Alice Test Key')).toBeVisible();
      await expect(page.getByText('Bob Test Key')).toBeVisible();
    });
  });

  test.describe('Key Display and Management', () => {
    test('should toggle private key visibility', async () => {
      // Generate a test key first
      await page.getByRole('button', { name: /generate/i }).click();
      await page.fill('input[placeholder*="name"]', 'Visibility Test Key');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();

      // Private key should be hidden by default
      const privateKeyDisplay = page.locator('code').nth(1);
      await expect(privateKeyDisplay).toContainText('••••••••');

      // Click eye icon to show
      await page.locator('button[aria-label*="Show"], button[title*="Show"]').first().click();

      // Private key should now be visible
      const visibleKey = await privateKeyDisplay.textContent();
      expect(visibleKey).not.toContain('••••••••');
      expect(visibleKey?.length).toBe(64); // Hex private key is 64 chars

      // Click eye icon again to hide
      await page.locator('button[aria-label*="Hide"], button[title*="Hide"]').first().click();
      await expect(privateKeyDisplay).toContainText('••••••••');
    });

    test('should copy public key to clipboard', async () => {
      // Generate a test key
      await page.getByRole('button', { name: /generate/i }).click();
      await page.fill('input[placeholder*="name"]', 'Copy Test Key');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();

      // Click copy button for public key
      await page.locator('button[aria-label*="Copy"], svg.lucide-copy').first().click();

      // Verify success message
      await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 3000 });

      // Verify clipboard contents (requires clipboard permissions)
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardContent.length).toBe(64); // Public key is 64 hex chars
    });

    test('should copy private key to clipboard when visible', async () => {
      // Generate a test key
      await page.getByRole('button', { name: /generate/i }).click();
      await page.fill('input[placeholder*="name"]', 'Private Copy Test');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();

      // Show private key
      await page.locator('button[aria-label*="Show"], button[title*="Show"]').first().click();

      // Copy private key
      await page.locator('button[aria-label*="Copy"], svg.lucide-copy').nth(1).click();

      // Verify success message
      await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 3000 });

      // Verify clipboard
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardContent.length).toBe(64);
    });

    test('should display key metadata correctly', async () => {
      await page.getByRole('button', { name: /generate/i }).click();
      await page.fill('input[placeholder*="name"]', 'Metadata Test Key');
      await page.fill('textarea[placeholder*="description"]', 'Test description for metadata');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();

      // Verify metadata
      await expect(page.getByText('Metadata Test Key')).toBeVisible();
      await expect(page.getByText('Test description for metadata')).toBeVisible();
      await expect(page.getByText(/created:/i)).toBeVisible();
      await expect(page.getByText(/security:/i)).toBeVisible();
    });
  });

  test.describe('Key Backup', () => {
    test('should create backup for key', async () => {
      // Generate a key
      await page.getByRole('button', { name: /generate/i }).click();
      await page.fill('input[placeholder*="name"]', 'Backup Test Key');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();

      // Create backup
      await page.getByRole('button', { name: /backup/i }).first().click();

      // Wait for backup confirmation
      await expect(page.getByText(/backup created/i)).toBeVisible({ timeout: 10000 });

      // Verify backup indicator
      await expect(page.locator('svg.lucide-check-circle')).toBeVisible();
    });

    test('should show backed up status in backup tab', async () => {
      // Generate and backup a key
      await page.getByRole('button', { name: /generate/i }).click();
      await page.fill('input[placeholder*="name"]', 'Backup Tab Test');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();
      await page.getByRole('button', { name: /backup/i }).first().click();
      await expect(page.getByText(/backup created/i)).toBeVisible({ timeout: 10000 });

      // Navigate to backup tab
      await page.getByRole('button', { name: /backup/i }).nth(1).click();

      // Verify key appears in backup list
      await expect(page.getByText('Backup Tab Test')).toBeVisible();
      await expect(page.locator('svg.lucide-check-circle')).toBeVisible();
    });
  });

  test.describe('Key Rotation', () => {
    test('should rotate key successfully', async () => {
      // Generate a key
      await page.getByRole('button', { name: /generate/i }).click();
      await page.fill('input[placeholder*="name"]', 'Rotation Test Key');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();

      // Get original public key
      const originalPubkey = await page.locator('code').first().textContent();

      // Rotate key
      await page.getByRole('button', { name: /rotate/i }).first().click();

      // Wait for rotation confirmation
      await expect(page.getByText(/rotated successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify new public key is different
      const newPubkey = await page.locator('code').first().textContent();
      expect(newPubkey).not.toBe(originalPubkey);

      // Verify rotation count is incremented
      await expect(page.getByText(/rotated/i)).toBeVisible();
    });

    test('should maintain key name after rotation', async () => {
      await page.getByRole('button', { name: /generate/i }).click();
      await page.fill('input[placeholder*="name"]', 'Persistent Name Key');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();
      await page.getByRole('button', { name: /rotate/i }).first().click();
      await expect(page.getByText(/rotated successfully/i)).toBeVisible({ timeout: 10000 });

      // Name should persist
      await expect(page.getByText('Persistent Name Key')).toBeVisible();
    });
  });

  test.describe('Key Deletion', () => {
    test('should delete key after confirmation', async () => {
      // Generate a key
      await page.getByRole('button', { name: /generate/i }).click();
      await page.fill('input[placeholder*="name"]', 'Delete Test Key');
      await page.getByRole('button', { name: /generate/i }).click();
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: /keys/i }).click();

      // Mock confirmation dialog
      page.on('dialog', (dialog) => dialog.accept());

      // Delete key
      await page.getByRole('button', { name: /delete/i }).first().click();

      // Wait for deletion confirmation
      await expect(page.getByText(/deleted successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify key is removed from list
      await expect(page.getByText('Delete Test Key')).not.toBeVisible();
    });

    test('should show empty state when no keys exist', async () => {
      await page.getByRole('button', { name: /keys/i }).click();

      // Should show empty state
      await expect(page.getByText(/no keys found/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /generate key/i })).toBeVisible();
    });
  });

  test.describe('Statistics and Settings', () => {
    test('should display accurate key statistics', async () => {
      // Generate multiple keys
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: /generate/i }).click();
        await page.fill('input[placeholder*="name"]', `Stats Test Key ${i + 1}`);
        await page.getByRole('button', { name: /generate/i }).click();
        await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });
      }

      // Check stats in header
      await page.getByRole('button', { name: /keys/i }).click();
      await expect(page.getByText(/3 keys/i)).toBeVisible();

      // Navigate to settings
      await page.getByRole('button', { name: /settings/i }).click();

      // Verify statistics
      await expect(page.getByText('3')).toBeVisible(); // Total keys
      await expect(page.getByText('Total Keys')).toBeVisible();
    });

    test('should show security best practices', async () => {
      await page.getByRole('button', { name: /settings/i }).click();

      // Verify security information is displayed
      await expect(page.getByText(/key security best practices/i)).toBeVisible();
      await expect(page.getByText(/always create backups/i)).toBeVisible();
      await expect(page.getByText(/rotate keys regularly/i)).toBeVisible();
      await expect(page.getByText(/never share your private keys/i)).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      await page.getByRole('button', { name: /generate/i }).click();

      // Tab through form elements
      await page.keyboard.press('Tab');
      await page.keyboard.type('Keyboard Test Key');

      await page.keyboard.press('Tab');
      await page.keyboard.type('Testing keyboard navigation');

      // Select option using keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown');

      // Submit using keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // Verify success
      await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });
    });

    test('should have proper ARIA labels', async () => {
      await page.getByRole('button', { name: /generate/i }).click();

      // Verify form inputs have labels
      const nameInput = page.locator('input[placeholder*="name"]');
      const labelFor = await nameInput.getAttribute('aria-label');
      expect(labelFor || await page.locator('label[for]').count()).toBeGreaterThan(0);

      // Verify buttons have accessible names
      const generateBtn = page.getByRole('button', { name: /generate/i });
      await expect(generateBtn).toHaveAccessibleName();
    });
  });
});
