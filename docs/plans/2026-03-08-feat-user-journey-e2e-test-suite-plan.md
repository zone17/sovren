---
title: 'feat: User Journey Mapping + Agent-Native E2E Test Suite'
type: feat
date: 2026-03-08
deepened: 2026-03-08
---

# User Journey Mapping + Agent-Native E2E Test Suite

## Enhancement Summary

**Deepened on:** 2026-03-08
**Sections enhanced:** 8
**Research agents used:** Creator platform competitive analysis, codebase explorer, agent-native architecture patterns, institutional Playwright docs, Playwright config analysis

### Key Improvements

1. **New Playwright project tier for API-only tests** — `*.api.spec.ts` files need a dedicated project in `playwright.config.ts` (no browser, request-only)
2. **File upload test fixtures pattern** — tiny deterministic fixtures (<10KB each) with cleanup, following pattern #26 (no mocks in E2E)
3. **Security test scenarios added** — DELETE ownership gap, auth bypass vectors, SSRF on content_url
4. **Agent-native test architecture** — dual-path testing (browser + API) with idempotency key validation, rate limit header assertions, machine-readable error format checks
5. **Cross-page journey data lifecycle** — beforeAll API setup, afterAll cleanup, content creation via API not UI for data prerequisites

### New Considerations Discovered

- Playwright config has NO project for `*.api.spec.ts` — tests won't run without adding one
- DELETE `/api/v1/content/:id` has no ownership check — any authenticated user can delete any content (P1 security gap)
- UPDATE route uses broken DI controller — needs direct Supabase rewrite before E2E can test edits
- Demo mode auth injects `e2e-demo-token-{timestamp}` which won't pass real backend validation — API tests require `USE_BACKEND=1`

## Overview

Map every user experience journey on the Sovren creator platform, define Gherkin acceptance criteria for each journey, and create a Playwright E2E test suite that validates the complete product works end-to-end.

**Key differentiator**: Sovren is built for two classes of users — **human creators** and **AI agents**. Every journey must work for both. High-frequency repetitive tasks (content creation, cross-posting, analytics monitoring) are explicitly designed for agent automation.

## Problem Statement

We've been fixing pages in isolation — patching individual components without validating that complete user flows work end-to-end. This session alone required fixing:

- Content publishing (FormData/file upload pipeline)
- Post viewing (broken Redux selector → API fetch)
- Dashboard navigation (no click handlers)
- RLS policies (blocking all writes)

Each fix was reactive. We need proactive validation: **if a user journey is defined, it has an E2E test that proves it works.**

## The Agent-Native Lens

### Market Context (2025-2026 Research)

No major creator platform is built AI-first yet. Ghost comes closest with its API-first architecture and 0% platform fee. YouTube is the only platform investing heavily in native AI creation tools (Dream Screen, Veo 3, auto-dubbing). The rest layer AI features on incrementally.

**The gap Sovren can fill**: A NOSTR-native, agent-first creator platform where the API is the product and the UI is one of many consumers.

**Key competitive insights from research:**

- **Substack's Notes** drove 90%+ of new subscriber growth — social/discovery layer is critical
- **Ghost's 0% fee + API-first** is the model to beat for creator ownership
- **Ko-fi's one-click tips** show frictionless Lightning payments could be a killer feature
- **Gumroad's Merchant of Record** shows tax compliance matters at scale
- **YouTube's AI tools** (Dream Screen, auto-dubbing) show where content creation is heading
- **Jasper Grid** shows the shift from "AI as writing assistant" to "AI as autonomous content pipeline"
- **MCP** (Model Context Protocol) has 97M+ monthly SDK downloads — it's the universal agent-to-tool standard

### Agent-Native Architecture Principles

From Apideck, MuleSoft, and the Agentic API framework:

1. **API is the product; UI is one consumer** — invert the typical platform architecture
2. **Every human action has an API equivalent** — task-oriented endpoints, not just CRUD
3. **Machine-actionable error responses** — `error_code`, `message`, `documentation_url`, `suggested_action`
4. **Rate limit headers on every response** — `X-RateLimit-Remaining`, `X-RateLimit-Limit`, `X-RateLimit-Reset`
5. **Idempotency keys** — agents retry on failure; without idempotency, retries create duplicates
6. **MCP server** — expose platform capabilities as MCP tools for any AI agent
7. **Webhook/SSE events** — push-based notifications, not polling
8. **Agent identity & attribution** — track which agent created/modified content

### What This Means for Testing

Every user journey has TWO test paths:

1. **Browser E2E** (Playwright) — validates the human experience
2. **API E2E** (Playwright `request` context) — validates the agent experience

### High-Frequency Tasks for Agent Automation

| Tier                        | Tasks                                                                                                                     | Status                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Fully automatable today** | Content scheduling/publishing, cross-posting, SEO tagging, comment moderation, analytics monitoring, thumbnail generation | APIs partially exist       |
| **Partially automatable**   | Audience engagement, monetization optimization, video creation                                                            | Need human review loop     |
| **Emerging**                | Content strategy, brand partnerships, crisis management                                                                   | Requires creative judgment |

## User Journey Map

### Journey 1: Creator Onboarding

**Goal**: New creator goes from zero to published content

```gherkin
Feature: Creator Onboarding
  As a new creator
  I want to set up my profile and publish my first content
  So that I can start building an audience and earning

  Scenario: Complete creator onboarding flow
    Given I am on the home page
    When I click "Get Started" or "Sign Up"
    Then I should see the signup page

    When I choose NOSTR login
    Then I should be prompted to connect my NOSTR key
    And I should see the onboarding wizard

    When I complete the NOSTR onboarding step
    Then I should see the Lightning wallet setup step

    When I complete Lightning onboarding
    Then I should be redirected to my dashboard
    And I should see "No content yet" empty state
    And I should see a "Create Your First Content" CTA

  Scenario: Create and publish first article
    Given I am authenticated as a creator
    And I am on the dashboard
    When I click "Create Content"
    Then I should see the content creation form

    When I fill in the title "My First Post"
    And I write content "Hello Sovren!"
    And I select content type "article"
    And I click "Publish"
    Then I should see a success message
    And I should be redirected to the dashboard
    And I should see "My First Post" in my content list

  Scenario: Create and publish content with media (image)
    Given I am authenticated as a creator
    When I navigate to /create
    And I select content type "image"
    And I upload an image file
    Then I should see a preview of the image

    When I fill in the title and click "Publish"
    Then the content should be saved with the image URL
    And the post page should display the uploaded image

  Scenario: Create and publish content with media (video)
    Given I am authenticated as a creator
    When I navigate to /create
    And I select content type "video"
    And I upload a video file
    Then I should see a video preview

    When I fill in the title and click "Publish"
    Then the post page should display a playable video

  Scenario: Create and publish content with media (audio)
    Given I am authenticated as a creator
    When I navigate to /create
    And I select content type "audio"
    And I upload an audio file
    Then I should see an audio player preview

    When I fill in the title and click "Publish"
    Then the post page should display an audio player

  # AGENT PATH
  Scenario: Agent publishes content via API
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with multipart form data
      | field       | value              |
      | title       | Agent-Created Post |
      | content     | Automated content  |
      | contentType | article            |
      | tags        | ai,automated       |
    Then I should receive 201 with the content item
    And the content should be visible at /api/v1/content/:id

  Scenario: Agent publishes content with file upload via API
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with a file attachment
    Then I should receive 201 with content_url pointing to Supabase Storage
```

### Journey 2: Content Discovery & Consumption

**Goal**: Supporter discovers and views content

```gherkin
Feature: Content Discovery
  As a supporter/visitor
  I want to discover and view creator content
  So that I can find interesting creators to follow and support

  Scenario: Browse discovery page
    Given I am on the home page
    When I click "Discover" in the navigation
    Then I should see the discovery page with content cards
    And each card should show title, creator, type icon, and stats

  Scenario: View a content post
    Given there is published content with id "abc-123"
    When I navigate to /post/abc-123
    Then I should see the post title and metadata
    And I should see the content body/media
    And I should see view count, like count, comment count
    And I should see tags if present

  Scenario: View content from dashboard
    Given I am authenticated as a creator
    And I have published content
    When I am on the dashboard
    And I click on a content item row
    Then I should navigate to /post/:id
    And I should see the full post

  Scenario: View content with media
    Given there is published content with an image
    When I view the post
    Then I should see the image rendered
    And the image should be loaded from Supabase Storage URL

  # AGENT PATH
  Scenario: Agent lists content via API
    When I GET /api/v1/content?limit=20&offset=0
    Then I should receive a paginated list of content items
    And each item should include id, title, content_type, stats

  Scenario: Agent reads single content item via API
    When I GET /api/v1/content/:id
    Then I should receive the full content item with all fields
```

### Journey 3: Creator Dashboard & Analytics

**Goal**: Creator monitors content performance

```gherkin
Feature: Creator Dashboard
  As a creator
  I want to see my content performance at a glance
  So that I can understand what's working and optimize

  Scenario: View dashboard stats
    Given I am authenticated as a creator
    And I have published 3 articles with various stats
    When I navigate to /dashboard
    Then I should see total published count
    And I should see total views across all content
    And I should see total likes across all content
    And I should see total earnings in sats

  Scenario: View content list with actions
    Given I am on the dashboard
    Then I should see my content items in reverse chronological order
    And each item should show title, status, stats, and date
    And I should see View and Delete buttons

  Scenario: Delete content from dashboard
    Given I am on the dashboard
    And I have published content
    When I click the delete button on a content item
    And I confirm the deletion
    Then the item should be removed from the list
    And the API should delete it from the database

  Scenario: Navigate to analytics
    Given I am on the dashboard
    When I navigate to /dashboard/analytics
    Then I should see detailed analytics for my content

  # AGENT PATH
  Scenario: Agent monitors content performance via API
    Given I have a valid auth token
    When I GET /api/v1/content
    Then I can compute total views, likes, and earnings
    And I can identify top-performing content
    And I can detect content that needs optimization
```

### Journey 4: Monetization & Tipping

**Goal**: Creator earns and supporter pays via Lightning

```gherkin
Feature: Monetization
  As a creator
  I want to earn Bitcoin via Lightning Network
  So that I can monetize my content directly

  Scenario: Set content price during creation
    Given I am on the create content page
    When I enable monetization
    And I set the price to 1000 sats
    Then the content should be published with is_monetized=true
    And the price should be visible on the post page

  Scenario: Supporter tips a creator
    Given I am viewing a published post
    And the creator has a Lightning wallet connected
    When I click "Tip Creator"
    Then I should see a Lightning payment interface
    And I should be able to send sats to the creator

  Scenario: View revenue dashboard
    Given I am authenticated as a creator
    When I navigate to /dashboard/revenue
    Then I should see my total earnings
    And I should see a breakdown by content item

  # AGENT PATH
  Scenario: Agent creates monetized content via API
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with monetization
      | field              | value |
      | monetization.enabled | true  |
      | monetization.price   | 1000  |
    Then the content should be created with is_monetized=true and price_sats=1000

  Scenario: Agent queries earnings via API
    Given I have a valid auth token
    When I GET /api/v1/content
    Then I can compute total price_sats across monetized content
```

### Journey 5: Identity & Profile

**Goal**: Creator establishes and manages their identity

```gherkin
Feature: Identity & Profile
  As a creator
  I want to manage my identity and profile
  So that supporters can find and recognize me

  Scenario: View public profile
    Given I am authenticated
    When I navigate to /profile
    Then I should see my NOSTR pubkey (truncated)
    And I should see my display name
    And I should see my creator stats

  Scenario: NOSTR identity verification
    Given I am on the onboarding page
    When I connect my NOSTR key
    Then my pubkey should be stored
    And my NIP-05 should be verifiable

  Scenario: View creator profile (public)
    Given creator with id "xyz" has published content
    When I navigate to /creator/xyz
    Then I should see their profile and content list

  # AGENT PATH
  Scenario: Agent reads user profile via API
    Given I have a valid auth token
    When I GET /api/v1/users/me
    Then I should receive my full profile with pubkey, role, and stats
```

### Journey 6: Comments & Community

**Goal**: Supporters engage with content and creators

```gherkin
Feature: Comments & Community
  As a supporter
  I want to comment on content and interact with creators
  So that I can engage with the community

  Scenario: Post a comment on content
    Given I am authenticated
    And I am viewing a published post
    When I type a comment and submit
    Then my comment should appear in the comments section
    And the comment count should increment

  Scenario: View threaded comments
    Given a post has comments with replies
    When I view the post
    Then I should see top-level comments
    And I should see nested replies

  Scenario: View community page
    Given I am authenticated
    When I navigate to /community
    Then I should see creator network features

  # AGENT PATH
  Scenario: Agent posts comment via API
    Given I have a valid auth token
    When I POST to /api/v2/comments with content_id and body
    Then I should receive 201 with the created comment
```

### Journey 7: Content Shield & Safety

**Goal**: Creator manages content moderation and safety

```gherkin
Feature: Content Shield
  As a creator
  I want to protect my content and manage moderation
  So that my platform presence is safe

  Scenario: View shield dashboard
    Given I am authenticated as a creator
    When I navigate to /shield
    Then I should see content safety metrics
    And I should see moderation tools

  Scenario: Moderate flagged content
    Given I have content that's been flagged
    When I view the shield dashboard
    Then I should see flagged items
    And I should be able to approve or remove them
```

### Journey 8: Business Management

**Goal**: Creator manages business operations

```gherkin
Feature: Business Management
  As a creator running a content business
  I want to manage contracts, invoices, and taxes
  So that I can operate professionally

  Scenario: View business dashboard
    Given I am authenticated as a creator
    When I navigate to /business
    Then I should see revenue overview
    And I should see contract management
    And I should see invoice tracking

  Scenario: Export financial data
    Given I am on the business dashboard
    When I click export
    Then I should receive a downloadable file with my financial data
```

### Journey 9: Wellness & Creator Health

**Goal**: Creator monitors their wellbeing

```gherkin
Feature: Creator Wellness
  As a creator
  I want to monitor my creative health and burnout risk
  So that I can sustain my content creation long-term

  Scenario: View wellness dashboard
    Given I am authenticated as a creator
    When I navigate to /wellness
    Then I should see wellness metrics
    And I should see burnout risk gauge
    And I should see activity patterns
```

## Current State Inventory

### Routes (22 frontend pages)

| Route                      | Page              | E2E Spec                              | POM                            | Status                      |
| -------------------------- | ----------------- | ------------------------------------- | ------------------------------ | --------------------------- |
| `/`                        | Home              | `home.public.spec.ts`                 | `home.page.ts`                 | Working                     |
| `/login`                   | Login             | `auth.public.spec.ts`                 | `login.page.ts`                | Working (demo mode)         |
| `/signup`                  | Signup            | `auth.public.spec.ts`                 | `signup.page.ts`               | Working (demo mode)         |
| `/onboarding`              | Onboarding        | `onboarding.public.spec.ts`           | `onboarding.page.ts`           | Partial                     |
| `/onboarding/nostr`        | NOSTR Setup       | `nostr-onboarding.public.spec.ts`     | `nostr-onboarding.page.ts`     | Partial                     |
| `/onboarding/lightning`    | Lightning Setup   | `lightning-onboarding.public.spec.ts` | `lightning-onboarding.page.ts` | Partial                     |
| `/profile-dashboard`       | Profile Dashboard | `profile-dashboard.public.spec.ts`    | `profile-dashboard.page.ts`    | Working                     |
| `/profile`                 | Profile           | -                                     | `profile.page.ts`              | Has POM, no spec            |
| `/post/:id`                | Post View         | `post.auth.spec.ts`                   | `post.page.ts`                 | Just fixed (API fetch)      |
| `/create`                  | Create Content    | -                                     | -                              | Just fixed (file upload)    |
| `/dashboard`               | Creator Dashboard | -                                     | -                              | Just fixed (clickable rows) |
| `/dashboard/analytics`     | Analytics         | `analytics.auth.spec.ts`              | `analytics.page.ts`            | Has spec                    |
| `/dashboard/subscriptions` | Subscriptions     | `subscriptions.auth.spec.ts`          | `subscriptions.page.ts`        | Has spec                    |
| `/discover`                | Discovery         | `discovery.public.spec.ts`            | `discovery.page.ts`            | Has spec                    |
| `/creator/:id`             | Creator Profile   | `creator-profile.auth.spec.ts`        | `creator-profile.page.ts`      | Has spec                    |
| `/content/:id`             | Content Detail    | -                                     | -                              | No spec/POM                 |
| `/dashboard/revenue`       | Revenue           | `revenue.auth.spec.ts`                | `revenue.page.ts`              | Has spec                    |
| `/wellness`                | Wellness          | `wellness.auth.spec.ts`               | `wellness.page.ts`             | Has spec                    |
| `/shield`                  | Shield            | `shield.auth.spec.ts`                 | `shield.page.ts`               | Has spec                    |
| `/community`               | Community         | `creator-network.auth.spec.ts`        | `creator-network.page.ts`      | Has spec                    |
| `/business`                | Business          | `business.auth.spec.ts`               | `business.page.ts`             | Has spec                    |
| `/monitoring`              | Monitoring        | `monitoring.auth.spec.ts`             | `monitoring.page.ts`           | Has spec                    |

### Missing E2E Coverage (Critical Gaps)

| Journey                         | Missing Specs                                    | Priority          |
| ------------------------------- | ------------------------------------------------ | ----------------- |
| Content Creation                | No `create-content.auth.spec.ts`                 | P1 — core product |
| Creator Dashboard               | No `dashboard.auth.spec.ts`                      | P1 — core product |
| Content View + Media            | `post.auth.spec.ts` exists but needs media tests | P1                |
| Profile Management              | No `profile.auth.spec.ts`                        | P2                |
| Content → Dashboard → Post flow | No cross-page journey test                       | P1                |
| API-only agent paths            | None exist                                       | P2 — agent-native |

### Backend API Endpoints

| API          | Method  | Route                        | Status                          |
| ------------ | ------- | ---------------------------- | ------------------------------- |
| Content CRUD | GET     | `/api/v1/content`            | Working (direct Supabase)       |
| Content CRUD | GET     | `/api/v1/content/:id`        | Working                         |
| Content CRUD | POST    | `/api/v1/content/publish`    | Working (with file upload)      |
| Content CRUD | DELETE  | `/api/v1/content/:id`        | Working                         |
| Auth         | POST    | `/api/auth/challenge`        | Working                         |
| Auth         | POST    | `/api/auth/authenticate`     | Working                         |
| Comments     | CRUD    | `/api/v2/comments`           | Working                         |
| Discovery    | GET     | `/api/v2/discovery`          | Working                         |
| Health       | GET     | `/health`, `/ready`, `/live` | Working                         |
| Lightning    | Various | `/api/lightning/*`           | Backend ready, frontend partial |
| Payments     | Various | `/api/v1/payments/*`         | Backend ready, frontend partial |
| Users        | Various | `/api/v1/users/*`            | Working                         |

## Implementation Plan

### Phase 1: Core Journey E2E Tests (P1)

**The flows that define Sovren as a product**

#### 1a. Create Content E2E (`create-content.auth.spec.ts`)

- New POM: `create-content.page.ts`
- Tests: publish article, publish with image upload, publish with tags, publish with monetization
- Validates the full form → API → Supabase → success redirect flow

#### 1b. Creator Dashboard E2E (`dashboard.auth.spec.ts`)

- New POM: `dashboard.page.ts`
- Tests: view stats, view content list, click content row → navigate to post, delete content
- Validates dashboard data matches API response

#### 1c. Full Creator Journey E2E (`creator-journey.auth.spec.ts`)

- Cross-page flow: Login → Dashboard (empty) → Create Content → Publish → Dashboard (has content) → View Post → Delete → Dashboard (empty again)
- This is the **golden path** test — if this passes, the core product works

#### 1d. Content View with Media E2E (enhance `post.auth.spec.ts`)

- Add tests for image/video/audio rendering
- Validate Supabase Storage URLs load correctly
- Test monetization display (price badge)

#### Research Insights: Phase 1 Implementation Details

**POM Design for CreateContent page:**

```typescript
// e2e/pages/create-content.page.ts
import type { Locator, Page } from '@playwright/test';

export class CreateContentPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly titleInput: Locator;
  readonly contentInput: Locator;
  readonly contentTypeSelect: Locator;
  readonly fileInput: Locator;
  readonly tagsInput: Locator;
  readonly monetizationToggle: Locator;
  readonly priceInput: Locator;
  readonly publishButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /create/i }).first();
    this.titleInput = page.getByRole('textbox', { name: /title/i });
    this.contentInput = page.getByRole('textbox', { name: /content|description/i });
    this.contentTypeSelect = page.getByRole('combobox', { name: /type/i });
    this.fileInput = page.locator('input[type="file"]');
    this.tagsInput = page.getByRole('textbox', { name: /tags/i });
    this.monetizationToggle = page.getByRole('checkbox', { name: /monetiz/i });
    this.priceInput = page.getByRole('spinbutton', { name: /price/i });
    this.publishButton = page.getByRole('button', { name: /publish/i });
    this.successMessage = page.getByText(/success|published/i).first();
  }

  async goto() {
    await this.page.goto('/create');
  }

  async publishArticle(title: string, content: string) {
    await this.titleInput.fill(title);
    await this.contentInput.fill(content);
    await this.publishButton.click();
  }

  async publishWithFile(title: string, filePath: string) {
    await this.titleInput.fill(title);
    await this.fileInput.setInputFiles(filePath);
    await this.publishButton.click();
  }
}
```

**Golden path test pattern** (cross-page journey):

```typescript
// creator-journey.auth.spec.ts
test('creator publishes content and views it', async ({ page, request }) => {
  const dashboard = new DashboardPage(page);
  const createContent = new CreateContentPage(page);
  const post = new PostPage(page);

  // 1. Dashboard shows empty state
  await dashboard.goto();
  await expect(dashboard.emptyState).toBeVisible();

  // 2. Navigate to create → publish
  await dashboard.createContentButton.click();
  await createContent.publishArticle('E2E Journey Test', 'Hello from E2E!');

  // 3. Wait for API response, then verify redirect
  await page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/content/publish') && resp.status() === 201
  );

  // 4. Dashboard shows the new content
  await dashboard.goto();
  await expect(dashboard.contentList.getByText('E2E Journey Test')).toBeVisible();

  // 5. Click to view post
  await dashboard.contentList.getByText('E2E Journey Test').click();
  await expect(post.title).toHaveText('E2E Journey Test');

  // 6. Cleanup via API (not UI — faster and more reliable)
  const contentItems = await request.get('/api/v1/content');
  const { data } = await contentItems.json();
  const item = data.items.find((i) => i.title === 'E2E Journey Test');
  if (item) await request.delete(`/api/v1/content/${item.id}`);
});
```

**Media upload test** (uses fixture files):

```typescript
test('creator publishes image content', async ({ page }) => {
  const createContent = new CreateContentPage(page);
  await createContent.goto();
  await createContent.publishWithFile('Image Test', TEST_MEDIA.image);

  // Wait for upload completion
  await page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/content/publish') && resp.status() === 201
  );

  // Verify image renders on post page
  const postPage = new PostPage(page);
  await expect(postPage.mediaImage).toBeVisible();
  // Verify Supabase Storage URL (not local file path)
  const src = await postPage.mediaImage.getAttribute('src');
  expect(src).toContain('supabase');
});
```

**Edge cases for Phase 1:**

- Empty title submission → should show validation error
- Very long title (>500 chars) → should truncate or reject
- Duplicate publish (double-click) → should not create two items (pattern #26 double-submit guard)
- Network failure during upload → should show error, not hang
- Loading state must not hide structural UI (pattern #82)

### Phase 2: Supporting Journey E2E Tests (P2)

#### 2a. Profile Management (`profile.auth.spec.ts`)

- Tests: view profile, see NOSTR pubkey, see creator stats

#### 2b. Discovery Flow (`discovery-journey.public.spec.ts`)

- Cross-page: Home → Discover → Click content card → View post
- Validates the supporter/visitor experience

#### 2c. Monetization Flow (enhance existing specs)

- Test creating monetized content and seeing price display
- Lightning tip button visibility (stub — real payment requires LN node)

### Phase 3: Agent-Native API E2E Tests (P2)

#### 3a. Agent Content CRUD (`agent-content.api.spec.ts`)

- Uses Playwright `request` context (no browser needed)
- Tests: create content via API, list content, get single item, delete
- Tests: file upload via API (multipart/form-data)
- Validates every browser action has an API equivalent

#### 3b. Agent Auth Flow (`agent-auth.api.spec.ts`)

- Tests: challenge → authenticate → use token for subsequent requests
- Validates programmatic NOSTR auth works for agents

### Phase 4: Advanced Journey Tests (P3)

#### 4a. Comments Flow (`comments-journey.auth.spec.ts`)

- Create content → Post comment → See comment appear → Reply to comment

#### 4b. Shield & Business (enhance existing specs)

- Validate core workflows within each dashboard

#### 4c. Wellness Monitoring (enhance existing spec)

- Validate burnout gauge renders with real data

## Test Architecture

### File Structure (new files marked with \*)

```
e2e/
├── pages/
│   ├── create-content.page.ts     *  ← New POM
│   ├── dashboard.page.ts          *  ← New POM
│   ├── home.page.ts                  (existing)
│   ├── login.page.ts                 (existing)
│   ├── post.page.ts                  (existing, enhance)
│   └── ... (24 existing POMs)
├── fixtures/
│   ├── test-credentials.ts           (existing)
│   ├── test-media.ts              *  ← Test image/video/audio files
│   └── media/                     *  ← Tiny binary fixtures
│       ├── test-image.png             (1x1 red pixel, ~68 bytes)
│       ├── test-audio.mp3             (0.1s silence, ~2KB)
│       └── test-video.mp4            (1 frame black, ~5KB)
├── auth.setup.ts                     (existing)
├── create-content.auth.spec.ts    *  ← Phase 1a
├── dashboard.auth.spec.ts         *  ← Phase 1b
├── creator-journey.auth.spec.ts   *  ← Phase 1c (golden path)
├── profile.auth.spec.ts           *  ← Phase 2a
├── discovery-journey.public.spec.ts * ← Phase 2b
├── agent-content.api.spec.ts      *  ← Phase 3a
├── agent-auth.api.spec.ts         *  ← Phase 3b
├── comments-journey.auth.spec.ts  *  ← Phase 4a
└── ... (23 existing specs)
```

### Research Insights: Playwright Config Gap

**Critical**: `playwright.config.ts` currently has 3 projects (setup, chromium-authenticated, chromium-public) but NO project for API-only tests. Agent tests (`*.api.spec.ts`) will not be discovered without adding a 4th project:

```typescript
// Add to playwright.config.ts projects array:
{
  name: 'api',
  testMatch: /\.api\.spec\.ts$/,
  dependencies: ['setup'],  // needs auth token
  use: {
    // No browser — API tests use request context only
    baseURL: process.env.E2E_API_URL || 'http://localhost:3001',
  },
},
```

**Important**: API tests MUST run with `USE_BACKEND=1` — demo mode tokens (`e2e-demo-token-{timestamp}`) won't pass real backend JWT validation. The `auth.setup.ts` already handles both paths, but API tests need a real backend to have meaningful assertions.

### Research Insights: Test Fixture Strategy

**Per institutional pattern #26** (docs/solutions/testing/playwright-e2e-anti-patterns.md): E2E tests must NEVER use `page.route()` to mock API responses. All data must come from real API calls.

**File upload fixtures** should be tiny deterministic binaries committed to the repo:

```typescript
// e2e/fixtures/test-media.ts
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEST_MEDIA = {
  image: path.join(__dirname, 'media/test-image.png'), // 1x1 PNG, ~68 bytes
  audio: path.join(__dirname, 'media/test-audio.mp3'), // 0.1s silence, ~2KB
  video: path.join(__dirname, 'media/test-video.mp4'), // 1 frame, ~5KB
} as const;
```

**Generate fixtures** (one-time, commit to repo):

```bash
# 1x1 red PNG
printf '\x89PNG\r\n\x1a\n' > test-image.png  # (use ffmpeg for valid files)
ffmpeg -f lavfi -i "color=c=red:s=1x1:d=0.04" -frames:v 1 test-image.png
ffmpeg -f lavfi -i "anullsrc=r=44100:cl=mono" -t 0.1 -q:a 9 test-audio.mp3
ffmpeg -f lavfi -i "color=c=black:s=1x1:d=0.04" -c:v libx264 test-video.mp4
```

### Test Data Strategy

Tests that need content in the database should create it via API in `beforeAll`:

```typescript
let contentId: string;

test.beforeAll(async ({ request }) => {
  const formData = new FormData();
  formData.append('title', 'E2E Test Content');
  formData.append('content', 'Test body');
  formData.append('contentType', 'article');

  const res = await request.post('/api/v1/content/publish', {
    multipart: { title: 'E2E Test', content: 'Body', contentType: 'article' },
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const { data } = await res.json();
  contentId = data.id;
});

test.afterAll(async ({ request }) => {
  await request.delete(`/api/v1/content/${contentId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
});
```

### Research Insights: Data Lifecycle Best Practices

**Pattern: API setup, UI verify, API cleanup**

The correct E2E data strategy (per institutional testing docs) is:

1. **Setup**: Create data via API (fast, deterministic, no UI flake)
2. **Test**: Verify via browser (the actual user journey)
3. **Cleanup**: Delete via API in `afterAll` (even if test fails — `afterAll` always runs)

**Edge cases to handle:**

- **Supabase Storage cleanup**: File uploads create Storage objects. `afterAll` must delete both the content row AND the storage object, or storage fills up in CI
- **Orphaned test data**: If `beforeAll` creates data but the test suite crashes before `afterAll`, orphaned rows accumulate. Mitigate with unique prefixes: `E2E-{timestamp}-{testName}` in titles, then a CI job that purges `E2E-*` content older than 1 hour
- **Parallel test isolation**: Playwright runs specs in parallel. Each spec's `beforeAll` must create its OWN data — never share content IDs across spec files (structuredClone pattern, common-solutions.md #42)

**Demo mode limitation**: In demo mode (no `USE_BACKEND`), API calls go to the frontend dev server which doesn't proxy to backend. Browser tests work (the UI renders mock state from localStorage), but API-based data setup won't work. This means:

- Phase 1-2 browser tests: work in both demo and backend modes
- Phase 3 API tests: require `USE_BACKEND=1` exclusively
- Golden path test: requires `USE_BACKEND=1` for the full create→view→delete cycle

### Agent-Native Test Pattern

```typescript
// agent-content.api.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Agent Content API', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    // Authenticate programmatically
    const challenge = await request.post('/api/auth/challenge');
    const { data } = await challenge.json();
    const auth = await request.post('/api/auth/authenticate', {
      data: { pubkey: testPubkey, challenge: data.challenge, ... },
    });
    token = (await auth.json()).data.token;
  });

  test('agent can create content via API', async ({ request }) => {
    const res = await request.post('/api/v1/content/publish', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        title: 'Agent-Created Content',
        content: 'Created by AI agent',
        contentType: 'article',
        tags: 'ai,automated',
      },
    });
    expect(res.status()).toBe(201);
    const { data } = await res.json();
    expect(data.title).toBe('Agent-Created Content');
    expect(data.id).toBeTruthy();
  });

  test('agent can list all content via API', async ({ request }) => {
    const res = await request.get('/api/v1/content');
    expect(res.ok()).toBeTruthy();
    const { data } = await res.json();
    expect(data.items).toBeInstanceOf(Array);
    expect(data.total).toBeGreaterThanOrEqual(0);
  });
});
```

### Research Insights: Agent-Native Testing Architecture

**From Apideck, MuleSoft, and Agentic API framework research:**

Agent tests should validate capabilities that distinguish an agent-ready API from a basic CRUD API. Each API test should check:

1. **Machine-readable error responses** — not just status codes, but structured error bodies:

```typescript
test('agent receives actionable error on invalid content type', async ({ request }) => {
  const res = await request.post('/api/v1/content/publish', {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: 'Test', contentType: 'invalid_type' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.success).toBe(false);
  expect(body.error).toBeTruthy();
  // Future: validate error_code and suggested_action fields
});
```

2. **Idempotency** (gap — not yet implemented, but tests should be ready):

```typescript
test.skip('duplicate publish with same idempotency key returns original', async ({ request }) => {
  const idempotencyKey = `e2e-${Date.now()}`;
  const payload = { title: 'Idempotent Test', content: 'Body', contentType: 'article' };
  const headers = { Authorization: `Bearer ${token}`, 'Idempotency-Key': idempotencyKey };

  const res1 = await request.post('/api/v1/content/publish', { headers, data: payload });
  const res2 = await request.post('/api/v1/content/publish', { headers, data: payload });

  expect(res1.status()).toBe(201);
  expect(res2.status()).toBe(200); // Returns existing, not 201
  const d1 = await res1.json(),
    d2 = await res2.json();
  expect(d1.data.id).toBe(d2.data.id); // Same content, not duplicate
});
```

3. **Rate limit headers** (gap — not yet implemented):

```typescript
test.skip('API responses include rate limit headers', async ({ request }) => {
  const res = await request.get('/api/v1/content');
  expect(res.headers()['x-ratelimit-limit']).toBeTruthy();
  expect(res.headers()['x-ratelimit-remaining']).toBeTruthy();
});
```

**Security test scenarios** (from institutional critical-patterns.md):

```typescript
test('DELETE requires ownership (P1 security gap)', async ({ request }) => {
  // Create content as user A, try to delete as user B
  // Currently this WILL PASS because DELETE has no ownership check
  // This test documents the security gap and should FAIL until fixed
});
```

**MCP server test vision** (future — when MCP server is built):

```typescript
// Future: Test Sovren MCP tools via MCP client SDK
// import { Client } from '@modelcontextprotocol/sdk/client';
// const client = new Client({ name: 'e2e-agent' });
// const result = await client.callTool('sovren_publish_content', { title: '...' });
```

## Acceptance Criteria

### Phase 1 (P1 — Must Have)

- [ ] `create-content.auth.spec.ts` — 4+ tests covering article, image upload, tags, monetization toggle
- [ ] `dashboard.auth.spec.ts` — 4+ tests covering stats display, content list, click-to-view, delete
- [ ] `creator-journey.auth.spec.ts` — 1 golden-path test covering Login → Create → View → Delete
- [ ] `post.auth.spec.ts` enhanced — media rendering tests for image, video, audio content types
- [ ] New POMs: `create-content.page.ts`, `dashboard.page.ts`
- [ ] All new tests pass with `npm run test:e2e`
- [ ] All new tests pass in CI

### Phase 2 (P2 — Should Have)

- [ ] `profile.auth.spec.ts` — profile view with NOSTR pubkey display
- [ ] `discovery-journey.public.spec.ts` — cross-page discovery flow
- [ ] Monetization display validation in post view

### Phase 3 (P2 — Agent-Native)

- [ ] `agent-content.api.spec.ts` — full CRUD via API (no browser)
- [ ] `agent-auth.api.spec.ts` — programmatic auth flow
- [ ] Every browser-testable action has an API-testable equivalent

### Phase 4 (P3 — Nice to Have)

- [ ] `comments-journey.auth.spec.ts` — comment creation and display
- [ ] Shield/business/wellness spec enhancements

## High-Frequency Tasks for Agent Automation

These are the repetitive creator tasks that should be fully automatable via API:

| Task                       | Frequency    | Current API                              | Agent-Ready?              |
| -------------------------- | ------------ | ---------------------------------------- | ------------------------- |
| Publish article            | Daily        | POST /api/v1/content/publish             | Yes                       |
| Publish with media         | Daily        | POST /api/v1/content/publish (multipart) | Yes                       |
| List my content            | Multiple/day | GET /api/v1/content                      | Yes                       |
| View content stats         | Multiple/day | GET /api/v1/content/:id                  | Yes                       |
| Delete content             | Weekly       | DELETE /api/v1/content/:id               | Yes                       |
| Schedule content           | Daily        | Not yet built                            | No — needs scheduling API |
| Cross-post to NOSTR relays | Per-publish  | Backend has NOSTR publish code           | Partial                   |
| Auto-tag content           | Per-publish  | Not yet built                            | No — needs AI tagging API |
| Monitor analytics          | Daily        | GET /api/v2/analytics                    | Partial                   |
| Manage comments            | Multiple/day | GET/POST /api/v2/comments                | Yes                       |

## Dependencies & Risks

### Dependencies

- Supabase running (for content CRUD tests)
- Backend running (for API tests with `USE_BACKEND=1`)
- Demo mode fallback (for CI without backend)
- Test media files (small image/video/audio for upload tests)

### Risks

- **File upload in CI**: Need small test fixtures (<1MB each)
- **Supabase Storage in CI**: Tests create real storage objects — need cleanup
- **Auth state**: Demo mode vs real backend auth may behave differently
- **Flaky tests**: Media upload timing, network latency

### Mitigations

- Use tiny test fixtures (1x1 PNG, 1-second MP3, 1-second MP4)
- `afterAll` cleanup hooks for created content and storage objects
- Dual auth paths already implemented in `auth.setup.ts`
- `toBeVisible()` with reasonable timeouts for media loading

### Research Insights: Additional Risks & Mitigations

**Risk: Supabase project pausing (pattern #66-#67)**

- Free-tier Supabase projects pause after 90 days of inactivity
- Current project `pgxpjiarfmsammhwesfx` was recreated after a pause during CI E2E pipeline work
- **Mitigation**: CI runs keep the project active; add a weekly health-check ping in CI

**Risk: DELETE ownership gap (P1 security)**

- `content.routes.ts:222-236`: DELETE has no `WHERE creator_id = user.id` check
- Any authenticated user can delete any content
- E2E tests should document this gap with a failing test that's skipped until fixed:

```typescript
test.skip("cannot delete another creator's content", async ({ request }) => {
  // TODO: Fix DELETE ownership check, then unskip
});
```

**Risk: UPDATE route broken (DI dependency)**

- `content.routes.ts:300-309`: PUT `/:id` uses `getController().updateContent()` which goes through broken DI
- Cannot E2E test content editing until this route is rewritten to direct Supabase (like the other CRUD routes)
- **Mitigation**: Phase 1 skips edit tests; P2 includes fixing the UPDATE route

**Risk: Flaky media tests in CI**

- Supabase Storage uploads from CI may be slow or fail due to network
- **Mitigation**: Use `test.slow()` annotation on media upload tests; use `waitForResponse` with extended timeout; retry 2x in CI (already configured in `playwright.config.ts`)

**Risk: Test pollution between parallel specs**

- Playwright runs specs in parallel with `fullyParallel: true`
- If two specs create content with the same title, list/search tests may find wrong items
- **Mitigation**: Unique prefixes per spec: `E2E-{specName}-{timestamp}-{title}`

## Competitive Platform Comparison

Research across 7 major creator platforms reveals patterns Sovren should adopt:

| Platform     | Revenue Model     | Discovery              | Agent-Ready?     | Key Lesson for Sovren                                                  |
| ------------ | ----------------- | ---------------------- | ---------------- | ---------------------------------------------------------------------- |
| **Substack** | 10% of paid subs  | Notes (social graph)   | No API access    | Notes-style social layer drives 90%+ growth                            |
| **Patreon**  | 8% standard       | Off-platform only      | OAuth + REST API | Tiered memberships increase ARPU                                       |
| **YouTube**  | 30-45% take       | Algorithmic            | Limited API      | Only platform investing in native AI creation tools                    |
| **Medium**   | Revenue pool      | Algorithm + editorial  | No creator API   | Reading-time monetization is unique but creator has no pricing control |
| **Gumroad**  | 10% + $0.50/txn   | Marketplace (30%)      | Limited          | Merchant of Record tax handling = huge value                           |
| **Ghost**    | 0% (hosting fee)  | None (self-distribute) | Full REST API    | API-first + 0% fee = best creator ownership model                      |
| **Ko-fi**    | 5% (0% with Gold) | Minimal                | No API           | One-click tips = lowest friction to first dollar                       |

**Sovren's positioning**: Ghost's API-first ownership model + Ko-fi's frictionless tipping (via Lightning) + Substack's social discovery (via NOSTR) + agent-native architecture that no platform has yet.

### Research Insights: Competitive E2E Testing Implications

**What to test from each competitor's model:**

| Competitor Pattern               | Sovren Equivalent                   | E2E Test Priority |
| -------------------------------- | ----------------------------------- | ----------------- |
| Ghost: API-first CRUD            | Content CRUD via API tests          | P1 (Phase 3)      |
| Ko-fi: one-click tip             | Lightning tip button → invoice flow | P2 (Phase 2c)     |
| Substack: Notes/discovery feed   | Discovery page with filters         | P2 (Phase 2b)     |
| YouTube: media upload pipeline   | Image/video/audio upload + preview  | P1 (Phase 1d)     |
| Gumroad: pricing during creation | Monetization toggle + price field   | P1 (Phase 1a)     |

**Key insight from competitive analysis**: No major creator platform has comprehensive API-only E2E tests. Ghost comes closest with their API test suite, but even Ghost's tests are primarily integration tests against a test database, not true E2E through a real deployment. Sovren's dual-path testing (browser + API) would be industry-leading.

**The "AI content pipeline" trend** (Jasper Grid, HeyGen Agent): These tools show that the future creator is an orchestrator who manages AI agents, not a solo writer. The E2E test suite should validate that:

1. An agent can autonomously create, publish, and verify content (Phase 3a)
2. An agent can monitor performance and trigger optimization (Phase 3 analytics)
3. Multiple agents can operate concurrently without conflict (parallel API tests)

## Agent-Native API Gap Analysis

APIs Sovren has vs what's needed for full agent parity:

| Capability              | Current API                              | Gap                                            | Priority |
| ----------------------- | ---------------------------------------- | ---------------------------------------------- | -------- |
| Create content          | POST /api/v1/content/publish             | None — works                                   | -        |
| Upload media            | POST /api/v1/content/publish (multipart) | None — works                                   | -        |
| List content            | GET /api/v1/content                      | Missing: filter by type, status, date range    | P2       |
| Get content             | GET /api/v1/content/:id                  | None — works                                   | -        |
| Delete content          | DELETE /api/v1/content/:id               | Missing: ownership validation                  | P1       |
| Update content          | PUT /api/v1/content/:id                  | Exists via DI (broken) — needs direct Supabase | P1       |
| Schedule content        | Not built                                | Need POST /api/v1/content/schedule             | P2       |
| Batch publish           | Not built                                | Need POST /api/v1/content/batch                | P3       |
| User profile            | GET/PUT /api/v1/users/\*                 | Exists                                         | -        |
| Comments                | GET/POST /api/v2/comments                | Exists                                         | -        |
| Analytics               | GET /api/v2/analytics                    | Partial                                        | P2       |
| Lightning invoice       | POST /api/lightning/invoice              | Exists                                         | -        |
| Lightning payment       | POST /api/lightning/payment              | Exists                                         | -        |
| Rate limit headers      | Not implemented                          | Need on all endpoints                          | P2       |
| Idempotency keys        | Not implemented                          | Need for mutating endpoints                    | P2       |
| Machine-readable errors | Partial (error string)                   | Need error_code + suggested_action             | P3       |
| MCP server              | Not built                                | Future — expose as MCP tools                   | P3       |

### Research Insights: Agent-Native API Priorities

**From competitive analysis and agent framework research:**

The most impactful agent-native improvements, ranked by value to agent developers:

1. **DELETE ownership check (P1)** — This is a security vulnerability, not just an agent gap. Fix in `content.routes.ts`:

```typescript
router.delete('/:id', authenticate, async (req, res) => {
  const user = (req as any).user;
  const { data: content } = await supabase
    .from('content')
    .select('creator_id')
    .eq('id', req.params.id)
    .single();

  if (!content) return res.status(404).json({ success: false, error: 'Not found' });

  // Look up user's DB id from nostr_pubkey
  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('nostr_pubkey', user.nostr_pubkey)
    .single();

  if (!dbUser || content.creator_id !== dbUser.id) {
    return res.status(403).json({ success: false, error: 'Not authorized' });
  }
  // ... proceed with delete
});
```

2. **UPDATE route fix (P1)** — Rewrite PUT `/:id` to use direct Supabase (same pattern as existing CRUD routes), bypassing the broken DI controller.

3. **Content filtering (P2)** — Add query params to GET `/api/v1/content`: `?type=article&status=published&created_after=2026-01-01&sort=view_count`

4. **Rate limit headers (P2)** — Express middleware using `express-rate-limit` already exists (`rateLimiters`), but doesn't set standard headers. Ghost's API sets `X-RateLimit-*` on every response — agents use these to self-throttle.

5. **Idempotency keys (P2)** — Critical for agent reliability. Agents retry on network failure; without idempotency, retries create duplicate content. Implementation: hash `Idempotency-Key` header + endpoint + user → check Redis/DB before processing.

**What makes Ghost's API "agent-ready" that Sovren lacks:**

- Filtering/sorting on every list endpoint
- Webhook events for content lifecycle (created, updated, published, deleted)
- API versioning with deprecation headers
- Pagination with `next` cursor (not just offset)
- Content format negotiation (JSON, HTML, plaintext)

## Future: MCP Server for Sovren

When ready, expose Sovren as an MCP server so any AI agent can:

```
tools:
  - sovren_publish_content(title, content, type, tags, media?)
  - sovren_list_content(filter?, limit?, offset?)
  - sovren_get_analytics(content_id?, period?)
  - sovren_create_invoice(amount_sats, description)
  - sovren_check_payment(payment_hash)
  - sovren_post_comment(content_id, body)
  - sovren_moderate_content(content_id, action)
```

This would make Sovren the first NOSTR-native, Lightning-enabled, MCP-compatible creator platform.

## References

### Internal Codebase

- Existing E2E patterns: `docs/solutions/testing/` (patterns #26, #30, #82)
- POM template: CLAUDE.md E2E section
- Auth setup: `e2e/auth.setup.ts`
- Content API: `packages/backend/src/routes/v1/content.routes.ts`
- Critical patterns: `docs/solutions/patterns/critical-patterns.md` (#11 PostgREST escaping, #15 cross-content refs)
- Playwright config: `packages/frontend/playwright.config.ts` (3-tier projects, needs 4th for API)
- Anti-patterns: `docs/solutions/testing/playwright-e2e-anti-patterns.md` (no `page.route()` mocking)
- Quick reference: `docs/solutions/testing/playwright-e2e-quick-reference.md` (POM, auth, assertions)
- Prevention strategies: `docs/solutions/testing/playwright-e2e-prevention-strategies.md` (decision tree)

### Institutional Patterns Applied

- **#26**: E2E must not mock API — real browser + real backend, zero `page.route()`
- **#30**: Convention-based spec naming — `*.auth.spec.ts` / `*.public.spec.ts` / `*.api.spec.ts` (new)
- **#42**: structuredClone for test data isolation in parallel specs
- **#82**: Loading state must not hide structural UI — buttons/headings visible even during load
- **#113**: POM YAGNI — only add locators needed by current tests, not speculative ones

### Research Sources (2025-2026)

- Substack, Patreon, YouTube, Medium, Gumroad, Ghost, Ko-fi platform analysis
- Apideck, MuleSoft, Agentic API framework — agent-native API design principles
- MCP (Model Context Protocol) — 97M+ monthly SDK downloads, Linux Foundation governance
- Jasper Grid, HeyGen Agent — AI-native content pipeline tools
- Ayrshare, Outstand — unified social media publishing APIs
- WebMCP (Google/Microsoft W3C draft) — declarative agent-website interaction standard
