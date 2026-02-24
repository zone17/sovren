import type { Locator, Page } from '@playwright/test';

/**
 * Page Object for WellnessDashboard
 * Source: src/features/wellness/components/WellnessDashboard.tsx
 */
export class WellnessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subheading: Locator;
  readonly pulseCheckInButton: Locator;
  readonly burnoutRiskGauge: Locator;
  readonly restDayTracker: Locator;
  readonly sustainableScheduler: Locator;
  readonly workPatternHeatmap: Locator;
  readonly wellnessTrend: Locator;
  readonly boundarySettings: Locator;
  readonly wellnessResources: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Creator Wellness' });
    this.subheading = page.getByText('Monitor your work patterns');
    this.pulseCheckInButton = page.getByRole('button', { name: 'Pulse Check-In' });

    // Sub-components (verified against source)
    this.burnoutRiskGauge = page.locator('[class*="BurnoutRiskGauge"], [data-testid="burnout-risk"]').first();
    this.restDayTracker = page.locator('[class*="RestDayTracker"], [data-testid="rest-day-tracker"]').first();
    this.sustainableScheduler = page.locator('[class*="SustainableScheduler"]').first();
    this.workPatternHeatmap = page.locator('[class*="WorkPatternHeatmap"]').first();
    this.wellnessTrend = page.locator('[class*="WellnessTrend"]').first();
    this.boundarySettings = page.locator('[class*="BoundarySettings"]').first();
    this.wellnessResources = page.locator('[class*="WellnessResources"]').first();
  }

  async goto() {
    await this.page.goto('/wellness');
  }
}
