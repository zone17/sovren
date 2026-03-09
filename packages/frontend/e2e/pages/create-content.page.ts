import type { Locator, Page } from '@playwright/test';

export class CreateContentPage {
  readonly page: Page;

  // Overview view — always rendered as h1 regardless of activeView
  readonly heading: Locator;
  readonly subheading: Locator;

  // Quick Actions (overview)
  readonly createContentButton: Locator;
  readonly aiGenerateButton: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;

  // Content list (overview)
  readonly yourContentHeading: Locator;
  readonly searchInput: Locator;

  // Editor header bar (editor view)
  readonly backToDashboard: Locator;
  readonly publishButton: Locator;

  // Editor — title input (placeholder: "Enter title...")
  readonly titleInput: Locator;

  // Editor — toolbar buttons
  readonly saveButton: Locator;
  readonly previewToggle: Locator;
  readonly boldButton: Locator;
  readonly italicButton: Locator;

  // Editor — content areas
  readonly descriptionTextarea: Locator;
  readonly bodyTextarea: Locator;

  // Loading / error states
  readonly loadingIndicator: Locator;
  readonly errorHeading: Locator;
  readonly reloadButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // The component renders h1 "Creator Dashboard" in overview mode
    this.heading = page.getByRole('heading', { name: /Creator Dashboard/i, level: 1 }).first();
    this.subheading = page.getByText(/Manage your content with AI-powered tools/i).first();

    // Quick Actions panel buttons
    this.createContentButton = page.getByRole('button', { name: /Create Content/i }).first();
    this.aiGenerateButton = page.getByRole('button', { name: /AI Generate/i }).first();
    this.importButton = page.getByRole('button', { name: /^Import$/i }).first();
    this.exportButton = page.getByRole('button', { name: /^Export$/i }).first();

    // Content list heading
    this.yourContentHeading = page.getByRole('heading', { name: /Your Content/i }).first();
    this.searchInput = page.getByPlaceholder(/Search content/i).first();

    // Editor header bar
    this.backToDashboard = page.getByRole('button', { name: /Back to Dashboard/i }).first();
    this.publishButton = page.getByRole('button', { name: /^Publish$/i }).first();

    // Editor fields (from ContentEditor component)
    this.titleInput = page.getByPlaceholder(/Enter title/i).first();
    this.saveButton = page.getByRole('button', { name: /Save/i }).first();
    this.previewToggle = page.getByRole('button', { name: /Preview|Edit/i }).first();
    this.boldButton = page.getByRole('button', { name: /Bold/i }).first();
    this.italicButton = page.getByRole('button', { name: /Italic/i }).first();

    this.descriptionTextarea = page.getByPlaceholder(/Enter description/i).first();
    this.bodyTextarea = page.getByPlaceholder(/Start writing your content/i).first();

    // Loading state
    this.loadingIndicator = page.getByText(/Loading your creator dashboard/i).first();
    this.errorHeading = page.getByRole('heading', { name: /Something went wrong/i }).first();
    this.reloadButton = page.getByRole('button', { name: /Reload Dashboard/i }).first();
  }

  async goto() {
    await this.page.goto('/create');
  }

  async gotoDashboard() {
    await this.page.goto('/dashboard');
  }
}
