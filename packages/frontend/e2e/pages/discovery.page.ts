import type { Locator, Page } from '@playwright/test';

export class DiscoveryPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly categoryNav: Locator;
  readonly sortSelect: Locator;
  readonly loadingSpinner: Locator;
  readonly errorAlert: Locator;
  readonly retryButton: Locator;
  readonly emptyState: Locator;
  readonly creatorCards: Locator;
  readonly paginationNav: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly resultAnnouncement: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Discover Creators' }).first();
    this.searchInput = page.getByPlaceholder(/Search creators/i);
    this.categoryNav = page.getByRole('navigation', { name: /Creator categories/i });
    this.sortSelect = page.getByLabel('Sort by:');
    this.loadingSpinner = page.getByRole('status', { name: /Loading creators/i });
    this.errorAlert = page.getByRole('alert');
    this.retryButton = page.getByRole('button', { name: 'Try Again' });
    this.emptyState = page.getByText('No creators found');
    this.creatorCards = page.getByRole('article');
    this.paginationNav = page.getByRole('navigation', { name: 'Pagination' });
    this.previousPageButton = page.getByRole('button', { name: 'Previous Page' });
    this.nextPageButton = page.getByRole('button', { name: 'Next Page' });
    this.resultAnnouncement = page.getByText(/creators found/i);
  }

  async goto() {
    await this.page.goto('/discover');
  }

  categoryButton(name: string): Locator {
    return this.categoryNav.getByRole('button', { name });
  }

  creatorCard(name: string): Locator {
    return this.page.getByRole('article', { name: new RegExp(name, 'i') });
  }
}
