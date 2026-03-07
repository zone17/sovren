import type { Locator, Page } from '@playwright/test';

export class SubscriptionsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly tiersTab: Locator;
  readonly subscribersTab: Locator;
  readonly createTierButton: Locator;
  readonly totalSubscribersCard: Locator;
  readonly totalRevenueCard: Locator;
  readonly activeTiersCard: Locator;
  readonly loadingSkeleton: Locator;
  readonly errorAlert: Locator;
  readonly retryButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /subscription management/i }).first();
    this.tiersTab = page.getByRole('tab', { name: /subscription tiers/i }).first();
    this.subscribersTab = page.getByRole('tab', { name: /subscribers/i }).first();
    this.createTierButton = page.getByRole('button', { name: /create tier/i }).first();
    this.totalSubscribersCard = page.getByText(/total subscribers/i).first();
    this.totalRevenueCard = page.getByText(/total revenue/i).first();
    this.activeTiersCard = page.getByText(/active tiers/i).first();
    this.loadingSkeleton = page.locator('.animate-pulse').first();
    this.errorAlert = page.getByText(/error loading subscriptions/i);
    this.retryButton = page.getByRole('button', { name: /retry/i });
  }

  async goto() {
    await this.page.goto('/dashboard/subscriptions');
  }
}
