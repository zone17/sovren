import type { Locator, Page } from '@playwright/test';

export class AnalyticsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly totalEarningsLabel: Locator;
  readonly loadingSpinner: Locator;
  readonly earningsChart: Locator;
  readonly periodSelector: Locator;
  readonly errorAlert: Locator;
  readonly noDataAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /creator analytics/i }).first();
    this.totalEarningsLabel = page.getByText('Total Earnings').first();
    this.loadingSpinner = page.locator('[class*="skeleton"], [class*="Skeleton"]').first();
    this.earningsChart = page.getByRole('heading', { name: /earnings trend/i }).first();
    this.periodSelector = page.getByRole('combobox').first();
    this.errorAlert = page.getByText('Analytics Error').first();
    this.noDataAlert = page.getByText('No Data Available').first();
  }

  async goto() {
    await this.page.goto('/dashboard/analytics');
  }

  /** Returns true if we landed on the analytics page (not redirected to /login). */
  isOnAnalytics(url: string): boolean {
    return /\/dashboard\/analytics/.test(url);
  }
}
