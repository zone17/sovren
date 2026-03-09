import { expect, test } from '@playwright/test';
import { BusinessPage } from './pages/business.page';

test.describe('Business Manager Dashboard', () => {
  let businessPage: BusinessPage;

  test.beforeEach(async ({ page }) => {
    businessPage = new BusinessPage(page);
    // Use page.goto() directly — POM's goto() has blocking waitFor that throws on redirect
    await page.goto('/business');

    // Wait for SPA to settle — either content renders or auth redirect fires
    await Promise.race([
      businessPage.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
  });

  test('loads dashboard with heading visible', async () => {
    await expect(businessPage.heading).toBeVisible();
  });

  test('defaults to revenue tab', async () => {
    await expect(businessPage.revenueTab).toHaveAttribute('aria-selected', 'true');
  });

  test('all four tabs are visible and clickable', async () => {
    await expect(businessPage.contractsTab).toBeVisible();
    await expect(businessPage.invoicesTab).toBeVisible();
    await expect(businessPage.revenueTab).toBeVisible();
    await expect(businessPage.taxTab).toBeVisible();

    await businessPage.switchTab('contracts');
    await expect(businessPage.contractsTab).toHaveAttribute('aria-selected', 'true');

    await businessPage.switchTab('invoices');
    await expect(businessPage.invoicesTab).toHaveAttribute('aria-selected', 'true');

    await businessPage.switchTab('tax');
    await expect(businessPage.taxTab).toHaveAttribute('aria-selected', 'true');
  });

  test('navigates to /business route', async ({ page }) => {
    await expect(page).toHaveURL(/\/business/);
  });

  test('invoices tab shows create invoice button', async () => {
    await businessPage.switchTab('invoices');
    await expect(businessPage.createInvoiceButton).toBeVisible();
  });

  test('tax tab shows year selector and export buttons', async () => {
    await businessPage.switchTab('tax');
    await expect(businessPage.yearSelector).toBeVisible();
    await expect(businessPage.exportCsvButton).toBeVisible();
    await expect(businessPage.exportJsonButton).toBeVisible();
  });

  test('contracts tab displays a content area after selection', async ({ page }) => {
    await businessPage.switchTab('contracts');
    await expect(businessPage.contractsTab).toHaveAttribute('aria-selected', 'true');
    // The tab panel associated with contracts should be visible and contain content
    // (either real data or an empty-state placeholder).
    const contractsPanel = page.getByRole('tabpanel');
    await expect(contractsPanel).toBeVisible();
    await expect(contractsPanel).not.toBeEmpty();
  });
});
