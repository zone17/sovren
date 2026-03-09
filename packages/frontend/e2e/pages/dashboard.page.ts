import type { Locator, Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;

  // Stats cards (AnalyticsDashboard)
  readonly totalViewsLabel: Locator;
  readonly earningsLabel: Locator;
  readonly aiQualityScoreLabel: Locator;
  readonly publishedLabel: Locator;

  // Content list (EnhancedContentList)
  readonly contentHeading: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly sortFilter: Locator;
  readonly emptyStateHeading: Locator;
  readonly emptyStateDescription: Locator;

  // Quick Actions sidebar
  readonly createContentButton: Locator;
  readonly aiGenerateButton: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;

  // Loading state
  readonly loadingText: Locator;

  // Error state
  readonly errorHeading: Locator;
  readonly reloadButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Creator Dashboard' }).first();

    // Stats cards — match the label text inside each card
    this.totalViewsLabel = page.getByText('Total Views').first();
    this.earningsLabel = page.getByText('Earnings', { exact: true }).first();
    this.aiQualityScoreLabel = page.getByText('AI Quality Score').first();
    this.publishedLabel = page.getByText('Published', { exact: true }).first();

    // Content list section
    this.contentHeading = page.getByRole('heading', { name: 'Your Content' }).first();
    this.searchInput = page.getByPlaceholder('Search content...');
    this.statusFilter = page.getByRole('combobox').filter({ hasText: 'All Status' }).first();
    this.sortFilter = page.getByRole('combobox').filter({ hasText: 'Recently Updated' }).first();
    this.emptyStateHeading = page.getByRole('heading', { name: 'No content yet' }).first();
    this.emptyStateDescription = page
      .getByText('Create your first piece of content to get started')
      .first();

    // Quick Actions buttons
    this.createContentButton = page.getByRole('button', { name: 'Create Content' }).first();
    this.aiGenerateButton = page.getByRole('button', { name: 'AI Generate' }).first();
    this.importButton = page.getByRole('button', { name: 'Import' }).first();
    this.exportButton = page.getByRole('button', { name: 'Export' }).first();

    // Loading state
    this.loadingText = page.getByText('Loading your creator dashboard...').first();

    // Error state
    this.errorHeading = page.getByRole('heading', { name: 'Something went wrong' }).first();
    this.reloadButton = page.getByRole('button', { name: 'Reload Dashboard' }).first();
  }

  async goto() {
    await this.page.goto('/dashboard');
  }
}
