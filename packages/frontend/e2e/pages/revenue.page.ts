import type { Locator, Page } from '@playwright/test';

export class RevenuePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly totalRevenueLabel: Locator;
  readonly revenueChart: Locator;
  readonly tierBreakdown: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /revenue analytics/i }).first();
    this.totalRevenueLabel = page.getByText('Total Revenue').first();
    this.revenueChart = page.locator('[aria-label="Revenue bar chart"]').first();
    this.tierBreakdown = page.getByRole('heading', { name: /revenue by tier/i }).first();
    this.loadingSpinner = page.locator('.animate-pulse').first();
  }

  async goto() {
    await this.page.goto('/dashboard/revenue');
  }
}
