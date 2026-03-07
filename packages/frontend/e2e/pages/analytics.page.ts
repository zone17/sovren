import type { Locator, Page } from '@playwright/test';

export class AnalyticsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly overviewTab: Locator;
  readonly geographyTab: Locator;
  readonly periodSelector: Locator;
  readonly refreshButton: Locator;
  readonly totalEarningsCard: Locator;
  readonly earningsTrendCard: Locator;
  readonly loadingSkeleton: Locator;
  readonly errorAlert: Locator;
  readonly retryButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /creator analytics/i }).first();
    this.overviewTab = page.getByRole('tab', { name: /overview/i }).first();
    this.geographyTab = page.getByRole('tab', { name: /geography/i }).first();
    this.periodSelector = page.locator('select').first();
    this.refreshButton = page.getByRole('button', { name: /refresh/i }).first();
    this.totalEarningsCard = page.getByText(/total earnings/i).first();
    this.earningsTrendCard = page.getByText(/earnings trend/i).first();
    this.loadingSkeleton = page.locator('.animate-pulse').first();
    this.errorAlert = page.getByText(/analytics error/i);
    this.retryButton = page.getByRole('button', { name: /retry/i });
  }

  async goto() {
    await this.page.goto('/dashboard/analytics');
  }
}
