import type { Locator, Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;

  // Stats cards — labels in the card grid
  readonly publishedLabel: Locator;
  readonly viewsLabel: Locator;
  readonly earningsLabel: Locator;
  readonly identityLabel: Locator;

  // Content list section
  readonly contentHeading: Locator;
  readonly emptyStateHeading: Locator;
  readonly emptyStateDescription: Locator;

  // Primary CTA
  readonly createContentButton: Locator;

  // Loading state
  readonly loadingText: Locator;

  // Error state
  readonly errorHeading: Locator;
  readonly reloadButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: /^Dashboard$/i }).first();

    // Stats cards — case-insensitive to handle all-caps rendering
    this.publishedLabel = page.getByText(/published/i).first();
    this.viewsLabel = page.getByText(/views/i).first();
    this.earningsLabel = page.getByText(/earnings/i).first();
    this.identityLabel = page.getByText(/identity/i).first();

    // Content list section
    this.contentHeading = page.getByRole('heading', { name: /your content/i }).first();
    this.emptyStateHeading = page.getByText(/no content yet/i).first();
    this.emptyStateDescription = page
      .getByText(/start creating to see your dashboard come alive/i)
      .first();

    // Primary CTA button — matches both "Create Content" and "Create Your First Content"
    this.createContentButton = page.getByRole('button', { name: /create.*content/i }).first();

    // Loading state
    this.loadingText = page.getByText(/loading.*dashboard/i).first();

    // Error state
    this.errorHeading = page.getByRole('heading', { name: /something went wrong/i }).first();
    this.reloadButton = page.getByRole('button', { name: /reload/i }).first();
  }

  async goto() {
    await this.page.goto('/dashboard');
  }
}
