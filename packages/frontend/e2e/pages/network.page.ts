/**
 * Network Page Object Model — Tasks #26-27
 * Slice 8: Creator Network + Notifications
 *
 * Wraps the CreatorNetworkDashboard at /community.
 * Tabs: Circles | Mentorship | Collaborations | Marketplace
 *
 * Follow/unfollow locators live on CreatorProfilePage (/creator/:id).
 * This POM covers the community hub: circles list, circle join/leave buttons,
 * mentor directory, mentor request button, and follower count display.
 */

import type { Locator, Page } from '@playwright/test';

export class NetworkPage {
  readonly page: Page;

  // ── Page heading ────────────────────────────────────────────────────────────
  readonly heading: Locator;

  // ── Tab navigation ──────────────────────────────────────────────────────────
  readonly circlesTab: Locator;
  readonly mentorshipTab: Locator;

  // ── Circles section ─────────────────────────────────────────────────────────
  readonly circlesHeading: Locator;
  readonly myCirclesSection: Locator;
  readonly suggestedCirclesSection: Locator;
  readonly createCircleButton: Locator;
  readonly circleDescriptionInput: Locator;
  readonly circleCreateConfirmButton: Locator;
  readonly circlesEmptyState: Locator;

  // ── Mentor directory section ─────────────────────────────────────────────────
  readonly mentorDirectoryHeading: Locator;
  readonly mentorNicheFilter: Locator;
  readonly mentorAudienceFilter: Locator;
  readonly mentorList: Locator;
  readonly mentorGoalsTextarea: Locator;
  readonly mentorRequestSendButton: Locator;
  readonly mentorEmptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page heading — "Community"
    this.heading = page.getByRole('heading', { name: /community/i }).first();

    // Tab buttons (CommunityNav uses role="tab" or role="button" depending on
    // implementation — use name-based matching to stay implementation-agnostic)
    this.circlesTab = page.getByRole('button', { name: /circles/i }).first();
    this.mentorshipTab = page.getByRole('button', { name: /mentorship/i }).first();

    // Circles section
    this.circlesHeading = page.getByRole('heading', { name: /creator circles/i }).first();
    this.myCirclesSection = page.getByRole('region', { name: /my circles/i }).first();
    this.suggestedCirclesSection = page.getByRole('region', { name: /suggested/i }).first();
    this.createCircleButton = page.getByRole('button', { name: /create circle/i }).first();
    this.circleDescriptionInput = page
      .getByRole('textbox', { name: /circle description/i })
      .first();
    this.circleCreateConfirmButton = page.getByRole('button', { name: /^create$/i }).first();
    this.circlesEmptyState = page.getByText(/no circles yet/i).first();

    // Mentor directory
    this.mentorDirectoryHeading = page.getByRole('heading', { name: /mentor directory/i }).first();
    this.mentorNicheFilter = page.getByRole('textbox', { name: /filter by niche/i }).first();
    this.mentorAudienceFilter = page.getByRole('combobox', { name: /filter by audience/i }).first();
    this.mentorList = page
      .getByRole('list')
      .filter({ has: page.locator('li') })
      .first();
    this.mentorGoalsTextarea = page.getByRole('textbox', { name: /mentorship goals/i }).first();
    this.mentorRequestSendButton = page.getByRole('button', { name: /send request/i }).first();
    this.mentorEmptyState = page.getByText(/no mentors match/i).first();
  }

  async goto() {
    await this.page.goto('/community');
    await this.heading.waitFor({ state: 'visible' });
  }

  async switchToMentorship() {
    await this.mentorshipTab.click();
    await this.mentorDirectoryHeading.waitFor({ state: 'visible' });
  }

  async switchToCircles() {
    await this.circlesTab.click();
    await this.circlesHeading.waitFor({ state: 'visible' });
  }

  /**
   * Returns the join button for a specific circle by name.
   * The button has aria-label "Join <name>" rendered by CircleList.
   */
  joinButtonFor(circleName: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`join ${circleName}`, 'i') }).first();
  }

  /**
   * Returns the leave button for a specific circle by name.
   */
  leaveButtonFor(circleName: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`leave ${circleName}`, 'i') }).first();
  }

  /**
   * Returns the "Request" button for a specific mentor (by their niche text).
   */
  requestButtonFor(mentorNiche: string): Locator {
    return this.page
      .getByRole('listitem')
      .filter({ hasText: mentorNiche })
      .getByRole('button', { name: /request/i })
      .first();
  }
}
