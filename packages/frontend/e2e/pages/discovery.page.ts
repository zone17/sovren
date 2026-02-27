import type { Locator, Page } from '@playwright/test';

export class DiscoveryPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly categoryNav: Locator;
  readonly sortSelect: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Discover Creators' }).first();
    this.searchInput = page.getByPlaceholder(/Search creators/i);
    this.categoryNav = page.getByRole('navigation', { name: /Creator categories/i });
    this.sortSelect = page.getByLabel('Sort by:');
  }

  async goto() {
    await this.page.goto('/discover');
  }

  categoryButton(name: string): Locator {
    return this.categoryNav.getByRole('button', { name });
  }
}
