import type { Locator, Page } from '@playwright/test';

export class SubscriptionsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly loadingSpinner: Locator;
  readonly createTierButton: Locator;
  readonly totalSubscribersCard: Locator;
  readonly tiersTab: Locator;
  readonly subscribersTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /subscription management/i }).first();
    this.loadingSpinner = page.locator('.animate-pulse').first();
    this.createTierButton = page.getByRole('button', { name: /create tier/i }).first();
    this.totalSubscribersCard = page.getByText('Total Subscribers').first();
    this.tiersTab = page.getByRole('tab', { name: /subscription tiers/i }).first();
    this.subscribersTab = page.getByRole('tab', { name: /subscribers/i }).first();
  }

  async goto() {
    await this.page.goto('/dashboard/subscriptions');
  }
}
