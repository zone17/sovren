import type { Locator, Page } from '@playwright/test';

export class RevenuePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly timeframe7d: Locator;
  readonly timeframe30d: Locator;
  readonly timeframe90d: Locator;
  readonly totalRevenueCard: Locator;
  readonly mrrCard: Locator;
  readonly activeSubscribersCard: Locator;
  readonly churnRateCard: Locator;
  readonly revenueChart: Locator;
  readonly tierBreakdown: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /revenue analytics/i }).first();
    this.timeframe7d = page.getByRole('radio', { name: /7 days/i });
    this.timeframe30d = page.getByRole('radio', { name: /30 days/i });
    this.timeframe90d = page.getByRole('radio', { name: /90 days/i });
    this.totalRevenueCard = page.getByText(/total revenue/i).first();
    this.mrrCard = page.getByText(/monthly recurring/i).first();
    this.activeSubscribersCard = page.getByText(/active subscribers/i).first();
    this.churnRateCard = page.getByText(/churn rate/i).first();
    this.revenueChart = page.getByRole('img', { name: /revenue bar chart/i });
    this.tierBreakdown = page.getByText(/revenue by tier/i).first();
  }

  async goto() {
    await this.page.goto('/dashboard/revenue');
  }
}
