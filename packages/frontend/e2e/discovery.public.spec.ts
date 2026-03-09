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

  test('creator cards render as articles or empty state shows', async ({ page }) => {
    const cardCount = await discovery.creatorCards.count();

    if (cardCount > 0) {
      await expect(discovery.creatorCards.first()).toBeVisible();
    } else {
      await expect(discovery.emptyState).toBeVisible();
    }
  });

  test('sort select has expected options', async () => {
    const options = discovery.sortSelect.getByRole('option');
    await expect(options.filter({ hasText: 'Relevance' })).toBeAttached();
    await expect(options.filter({ hasText: 'Most Followers' })).toBeAttached();
    await expect(options.filter({ hasText: 'Newest' })).toBeAttached();
  });

  test('creator card has expected structure', async () => {
    const cardCount = await discovery.creatorCards.count();

    if (cardCount === 0) {
      await expect(discovery.emptyState).toBeVisible();
      return;
    }

    const firstCard = discovery.creatorCards.first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.getByRole('heading', { level: 3 })).toBeVisible();
    await expect(
      firstCard
        .getByRole('link', { name: /View Profile/i })
        .or(firstCard.getByRole('button', { name: /View Profile/i }))
    ).toBeVisible();
  });

  test('clicking view profile navigates to creator page', async ({ page }) => {
    const cardCount = await discovery.creatorCards.count();

    if (cardCount === 0) {
      await expect(discovery.emptyState).toBeVisible();
      return;
    }

    const firstCard = discovery.creatorCards.first();
    const viewProfileLink = firstCard
      .getByRole('link', { name: /View Profile/i })
      .or(firstCard.getByRole('button', { name: /View Profile/i }));

    await viewProfileLink.click();
    await expect(page).toHaveURL(/\/creator\//);
  });
});
