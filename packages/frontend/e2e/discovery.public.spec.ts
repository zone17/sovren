import { expect, test } from '@playwright/test';
import { DiscoveryPage } from './pages/discovery.page';

test.describe('Discovery Page', () => {
  let discovery: DiscoveryPage;

  test.beforeEach(async ({ page }) => {
    discovery = new DiscoveryPage(page);
    await discovery.goto();
  });

  test('renders heading, search, and category filters', async () => {
    await expect(discovery.heading).toBeVisible();
    await expect(discovery.searchInput).toBeVisible();
    await expect(discovery.categoryNav).toBeVisible();
    await expect(discovery.sortSelect).toBeVisible();
  });

  test('category buttons are interactive', async () => {
    const allButton = discovery.categoryButton('All');
    await expect(allButton).toBeVisible();
    await expect(allButton).toHaveAttribute('aria-pressed', 'true');

    const artButton = discovery.categoryButton('Art');
    await expect(artButton).toBeVisible();
    await artButton.click();
    await expect(artButton).toHaveAttribute('aria-pressed', 'true');
    await expect(allButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('search input accepts text', async () => {
    await discovery.searchInput.fill('bitcoin');
    await expect(discovery.searchInput).toHaveValue('bitcoin');
  });
});
