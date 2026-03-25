# Sovren User Journey Gherkin Specifications

**Date**: 2026-03-09
**Purpose**: Comprehensive Gherkin scenarios for every customer workflow on the Sovren platform
**Coverage**: 15 user journeys, 80+ scenarios, dual-path (browser + API) testing

---

## Coverage Matrix

| #   | Journey                         | Route(s)                                         | POM         | Spec            | Tests | Status                     |
| --- | ------------------------------- | ------------------------------------------------ | ----------- | --------------- | ----- | -------------------------- |
| 1   | Creator Onboarding              | `/signup`, `/onboarding/*`                       | 4 exist     | 3 exist (smoke) | 6     | Partial — smoke only       |
| 2   | Content Creation & Publishing   | `/create`                                        | **MISSING** | **MISSING**     | 0     | **GAP**                    |
| 3   | Content Discovery & Consumption | `/discover`, `/post/:id`, `/content/:id`         | 2 exist     | 2 exist (smoke) | 6     | Partial                    |
| 4   | Creator Dashboard & Management  | `/dashboard`                                     | **MISSING** | **MISSING**     | 0     | **GAP**                    |
| 5   | Analytics & Performance         | `/dashboard/analytics`                           | exists      | exists (smoke)  | 3     | Smoke only                 |
| 6   | Monetization & Lightning        | `/dashboard/revenue`, `/dashboard/subscriptions` | 2 exist     | 2 exist (smoke) | 6     | Smoke only                 |
| 7   | Identity & Profile              | `/profile`, `/creator/:id`                       | 2 exist     | 1 exists        | 9     | Partial — no /profile spec |
| 8   | Comments & Engagement           | `/post/:id` (comments section)                   | exists      | 2 exist         | 21    | **Good**                   |
| 9   | Content Shield & Safety         | `/shield`                                        | exists      | exists          | 4     | Smoke+                     |
| 10  | Business Management             | `/business`                                      | exists      | exists          | 6     | Smoke+                     |
| 11  | Wellness & Creator Health       | `/wellness`                                      | exists      | exists          | 5     | Smoke+                     |
| 12  | Creator Network & Community     | `/community`                                     | exists      | exists          | 4     | Smoke+                     |
| 13  | Notifications                   | (panel overlay)                                  | exists      | exists          | 6     | **Good**                   |
| 14  | Navigation & Layout             | (all pages)                                      | exists      | exists          | 6     | **Good**                   |
| 15  | Agent-Native API Workflows      | `/api/*`                                         | N/A         | **MISSING**     | 0     | **GAP** — no API project   |

**Legend**: GAP = no test coverage, Smoke = page loads + heading visible only, Smoke+ = page loads + basic interaction, Good = meaningful assertions

---

## Journey 1: Creator Onboarding

**Goal**: New creator goes from zero → signed up → onboarded → ready to create

**Routes**: `/` → `/signup` → `/onboarding` → `/onboarding/nostr` → `/onboarding/lightning` → `/dashboard`
**Existing coverage**: 3 specs (6 tests), smoke only — page loads, headings visible
**Gap**: No flow test connecting signup → onboarding → dashboard

```gherkin
Feature: Creator Onboarding
  As a new creator
  I want to set up my profile and configure my identity
  So that I can start publishing content and earning

  Background:
    Given the Sovren application is running
    And I am not authenticated

  # --- SIGNUP ---

  Scenario: View signup page from home
    Given I am on the home page
    When I click the "Sign Up" link
    Then I should see the signup page
    And I should see the signup form with email and password fields

  Scenario: Sign up with valid credentials
    Given I am on the signup page
    When I enter a valid email and password
    And I click the sign up button
    Then I should be redirected to the onboarding flow
    And I should be authenticated

  Scenario: Sign up with invalid email shows error
    Given I am on the signup page
    When I enter an invalid email format
    And I click the sign up button
    Then I should see an email validation error
    And I should remain on the signup page

  # --- ONBOARDING WIZARD ---

  Scenario: Complete onboarding wizard landing
    Given I am authenticated
    When I navigate to /onboarding
    Then I should see the onboarding wizard
    And I should see progress indicators
    And I should see the first step

  Scenario: NOSTR key setup step
    Given I am on the NOSTR onboarding step
    When I complete the NOSTR key configuration
    Then I should see confirmation of my NOSTR identity
    And I should be able to proceed to the next step

  Scenario: Lightning wallet setup step
    Given I am on the Lightning onboarding step
    When I complete the Lightning wallet configuration
    Then I should see confirmation of my wallet setup
    And I should be able to proceed to the dashboard

  # --- GOLDEN PATH FLOW ---

  Scenario: Full onboarding journey (golden path)
    Given I am on the home page
    When I sign up as a new creator
    And I complete the onboarding wizard
    And I configure my NOSTR identity
    And I set up my Lightning wallet
    Then I should arrive at my creator dashboard
    And I should see the empty state with "Create Your First Content" prompt

  # --- AGENT PATH ---

  Scenario: Agent registers via API
    Given the API is available
    When I POST to /api/auth/challenge with a NOSTR pubkey
    Then I should receive a challenge string
    When I POST to /api/auth/authenticate with the signed challenge
    Then I should receive an auth token
    And the token should be valid for subsequent API calls
```

---

## Journey 2: Content Creation & Publishing

**Goal**: Creator creates and publishes content (article, image, video, audio)

**Route**: `/create`
**Existing coverage**: **NONE** — no POM, no spec
**Gap**: This is the core product action with zero E2E coverage

```gherkin
Feature: Content Creation & Publishing
  As a creator
  I want to create and publish various types of content
  So that my audience can consume and engage with my work

  Background:
    Given I am authenticated as a creator
    And I am on the content creation page

  # --- ARTICLE CREATION ---

  Scenario: Publish a text article
    When I fill in the title "My First Article"
    And I write content "Hello Sovren! This is my first post."
    And I select content type "article"
    And I click "Publish"
    Then I should see a success notification
    And the article should appear on my dashboard
    And the article should be viewable at its unique URL

  Scenario: Publish article with tags
    When I fill in the title "Tagged Article"
    And I write content "Content with tags"
    And I add tags "bitcoin, nostr, lightning"
    And I click "Publish"
    Then the article should be saved with the specified tags
    And the tags should be visible on the post page

  # --- MEDIA CONTENT ---

  Scenario: Publish content with image upload
    When I select content type "image"
    And I upload an image file
    Then I should see a preview of the uploaded image
    When I fill in the title "Image Post" and click "Publish"
    Then the post page should display the uploaded image
    And the image URL should point to Supabase Storage

  Scenario: Publish content with video upload
    When I select content type "video"
    And I upload a video file
    Then I should see a video preview
    When I fill in the title "Video Post" and click "Publish"
    Then the post page should display a playable video player

  Scenario: Publish content with audio upload
    When I select content type "audio"
    And I upload an audio file
    Then I should see an audio player preview
    When I fill in the title "Audio Post" and click "Publish"
    Then the post page should display an audio player

  # --- MONETIZED CONTENT ---

  Scenario: Publish monetized content
    When I fill in the title "Premium Article"
    And I enable the monetization toggle
    And I set the price to 1000 sats
    And I click "Publish"
    Then the content should be published with monetization enabled
    And the post page should show the price badge (1000 sats)

  # --- VALIDATION & EDGE CASES ---

  Scenario: Empty title shows validation error
    When I leave the title field empty
    And I click "Publish"
    Then I should see a title validation error
    And the form should not submit

  Scenario: Double-click publish prevention
    When I fill in valid content
    And I click "Publish" twice rapidly
    Then only one content item should be created
    And I should not see a duplicate

  # --- AGENT PATH ---

  Scenario: Agent publishes article via API
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with:
      | field       | value              |
      | title       | Agent Article      |
      | content     | Published by agent |
      | contentType | article            |
    Then I should receive 201 with the content item
    And the content should have an id, title, and created_at

  Scenario: Agent publishes content with file upload via API
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with multipart form data including a file
    Then I should receive 201
    And the response should include a content_url pointing to Supabase Storage

  Scenario: Agent publishes monetized content via API
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with monetization fields
    Then the content should have is_monetized=true and price_sats set
```

---

## Journey 3: Content Discovery & Consumption

**Goal**: Visitor/supporter discovers, browses, and views content

**Routes**: `/discover` → `/post/:id` or `/content/:id`
**Existing coverage**: `discovery.public.spec.ts` (3 tests), `post.auth.spec.ts` (3 tests) — basic
**Gap**: No cross-page flow test (discover → view), no content type rendering tests

```gherkin
Feature: Content Discovery & Consumption
  As a visitor or supporter
  I want to discover and view creator content
  So that I can find interesting creators to follow and support

  # --- DISCOVERY PAGE ---

  Scenario: Browse discovery page
    Given I am on the home page
    When I navigate to the discovery page
    Then I should see content cards in a grid/list layout
    And each card should display title, creator name, type icon, and engagement stats

  Scenario: Filter content by category
    Given I am on the discovery page
    When I select a content category filter
    Then I should see only content matching that category
    And the filter should be visually indicated as active

  Scenario: Search for content
    Given I am on the discovery page
    When I type a search term
    Then I should see content matching the search term
    And results should update as I type (or on submit)

  # --- CONTENT VIEWING ---

  Scenario: View a published article
    Given there is published content with a known ID
    When I navigate to /post/{id}
    Then I should see the post title
    And I should see the author name
    And I should see the content body
    And I should see engagement stats (views, likes, comments)
    And I should see tags if present

  Scenario: View content with image media
    Given there is published image content
    When I view the post
    Then I should see the image rendered from Supabase Storage URL
    And the image should have appropriate alt text

  Scenario: View content with video media
    Given there is published video content
    When I view the post
    Then I should see a playable video player

  Scenario: View content with audio media
    Given there is published audio content
    When I view the post
    Then I should see an audio player

  # --- CROSS-PAGE FLOW ---

  Scenario: Discover content and view it (cross-page journey)
    Given I am on the discovery page
    And there are published content items
    When I click on a content card
    Then I should navigate to the post detail page
    And the post should display the same content previewed in the card

  # --- AGENT PATH ---

  Scenario: Agent lists content via API
    When I GET /api/v1/content with pagination params
    Then I should receive a paginated list of content items
    And each item should include id, title, content_type, and stats

  Scenario: Agent reads single content item via API
    Given a content item exists with a known ID
    When I GET /api/v1/content/{id}
    Then I should receive the full content item with all fields
```

---

## Journey 4: Creator Dashboard & Content Management

**Goal**: Creator monitors and manages their published content

**Route**: `/dashboard`
**Existing coverage**: **NONE** — no POM, no spec
**Gap**: Core management interface with zero E2E coverage

```gherkin
Feature: Creator Dashboard & Content Management
  As a creator
  I want to see my content performance and manage my publications
  So that I can understand what's working and take action

  Background:
    Given I am authenticated as a creator

  # --- DASHBOARD OVERVIEW ---

  Scenario: View dashboard with published content
    Given I have published at least one content item
    When I navigate to /dashboard
    Then I should see my total published content count
    And I should see total views across all content
    And I should see total likes across all content
    And I should see total earnings in sats

  Scenario: View dashboard empty state
    Given I have no published content
    When I navigate to /dashboard
    Then I should see an empty state message
    And I should see a "Create Your First Content" call-to-action

  # --- CONTENT LIST ---

  Scenario: View content list in reverse chronological order
    Given I have published multiple content items
    When I view the dashboard
    Then I should see my content items sorted newest first
    And each item should show title, status, view count, and publish date

  Scenario: Click content row navigates to post
    Given I have published content visible on the dashboard
    When I click on a content item row
    Then I should navigate to /post/{id}
    And I should see the full post detail

  # --- CONTENT ACTIONS ---

  Scenario: Delete content from dashboard
    Given I have published content
    When I click the delete button on a content item
    And I confirm the deletion in the dialog
    Then the item should be removed from the dashboard list
    And the content should no longer be accessible at its URL

  Scenario: Navigate to create content
    Given I am on the dashboard
    When I click the "Create Content" button
    Then I should navigate to /create

  # --- AGENT PATH ---

  Scenario: Agent lists own content via API
    Given I have a valid auth token
    When I GET /api/v1/content
    Then I should receive my content items with stats
    And I can compute total views, likes, and earnings

  Scenario: Agent deletes content via API
    Given I have a valid auth token
    And I have created content with a known ID
    When I DELETE /api/v1/content/{id}
    Then I should receive a success response
    And the content should no longer be retrievable
```

---

## Journey 5: Analytics & Performance Monitoring

**Goal**: Creator analyzes content performance in detail

**Route**: `/dashboard/analytics`
**Existing coverage**: `analytics.auth.spec.ts` (3 tests) — smoke level
**Gap**: No assertion on actual analytics data or charts

```gherkin
Feature: Analytics & Performance Monitoring
  As a creator
  I want to see detailed analytics about my content performance
  So that I can optimize my content strategy

  Background:
    Given I am authenticated as a creator

  Scenario: View analytics dashboard
    Given I have published content with engagement data
    When I navigate to /dashboard/analytics
    Then I should see the analytics page heading
    And I should see performance charts or metrics
    And I should see content performance breakdowns

  Scenario: Navigate to analytics from main dashboard
    Given I am on /dashboard
    When I click the analytics navigation item
    Then I should navigate to /dashboard/analytics

  Scenario: Analytics shows meaningful metrics
    When I navigate to /dashboard/analytics
    Then I should see at least one of: views chart, engagement rate, or top content list
    And the page should not show only loading spinners after 5 seconds
```

---

## Journey 6: Monetization & Lightning Payments

**Goal**: Creator earns via Lightning, supporter pays/tips

**Routes**: `/dashboard/revenue`, `/dashboard/subscriptions`
**Existing coverage**: `revenue.auth.spec.ts` (3 tests), `subscriptions.auth.spec.ts` (3 tests) — smoke
**Gap**: No tip flow, no payment assertion, no monetization toggle in creation

```gherkin
Feature: Monetization & Lightning Payments
  As a creator
  I want to earn Bitcoin via Lightning Network
  So that I can monetize my content with near-zero fees

  Background:
    Given I am authenticated as a creator

  # --- REVENUE DASHBOARD ---

  Scenario: View revenue dashboard
    When I navigate to /dashboard/revenue
    Then I should see the revenue page heading
    And I should see total earnings summary
    And I should see revenue breakdown by content item

  Scenario: Revenue page shows earnings data
    Given I have monetized content
    When I view the revenue dashboard
    Then I should see non-zero earnings data
    Or I should see empty state with monetization instructions

  # --- SUBSCRIPTION MANAGEMENT ---

  Scenario: View subscription tiers
    When I navigate to /dashboard/subscriptions
    Then I should see the subscriptions page heading
    And I should see subscription tier management options

  # --- TIPPING FLOW ---

  Scenario: Supporter sees tip button on post
    Given I am viewing a published post by a creator with Lightning wallet
    Then I should see a "Tip Creator" or Lightning tip button
    And clicking it should open a Lightning payment interface

  # --- MONETIZED CONTENT CREATION ---

  Scenario: Set content price during creation
    Given I am on the create content page
    When I enable the monetization toggle
    And I set the price to 1000 sats
    And I publish the content
    Then the price should be visible on the post page

  # --- AGENT PATH ---

  Scenario: Agent creates monetized content via API
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with is_monetized=true and price_sats=1000
    Then the content should be created with monetization enabled

  Scenario: Agent queries earnings via API
    Given I have a valid auth token
    When I GET /api/v1/content
    Then I can compute total earnings across monetized content
```

---

## Journey 7: Identity & Profile Management

**Goal**: Creator establishes and manages their NOSTR identity and public profile

**Routes**: `/profile`, `/creator/:id`
**Existing coverage**: `creator-profile.auth.spec.ts` (8 tests — good), `profile-dashboard.public.spec.ts` (1 test)
**Gap**: No `/profile` spec (has POM but no spec), no profile editing tests

```gherkin
Feature: Identity & Profile Management
  As a creator
  I want to manage my identity and public profile
  So that supporters can find and recognize me

  # --- OWN PROFILE ---

  Scenario: View own profile
    Given I am authenticated as a creator
    When I navigate to /profile
    Then I should see my profile information
    And I should see my NOSTR pubkey (truncated display)
    And I should see my display name
    And I should see my creator statistics

  Scenario: Profile shows NOSTR identity
    Given I am authenticated with a NOSTR key
    When I view my profile
    Then I should see my pubkey displayed
    And I should see NIP-05 verification status if available

  # --- PUBLIC CREATOR PROFILE ---

  Scenario: View another creator's profile
    Given a creator with ID "xyz" has published content
    When I navigate to /creator/xyz
    Then I should see their display name and avatar
    And I should see their published content list
    And I should see their follower/following counts

  Scenario: Follow a creator from their profile
    Given I am authenticated
    And I am viewing another creator's profile
    When I click the "Follow" button
    Then the button should change to "Following"
    And the follower count should increment

  # --- PROFILE DASHBOARD (PUBLIC) ---

  Scenario: View profile dashboard when not authenticated
    When I navigate to /profile-dashboard
    Then I should see the profile dashboard page
    And I should see a prompt to sign in or basic public info

  # --- AGENT PATH ---

  Scenario: Agent reads own profile via API
    Given I have a valid auth token
    When I GET /api/v1/users/me
    Then I should receive my full profile with pubkey, role, and stats

  Scenario: Agent reads another user's profile via API
    Given I have a valid auth token
    When I GET /api/v1/users/{userId}
    Then I should receive the user's public profile information
```

---

## Journey 8: Comments & Engagement

**Goal**: Users engage with content through comments and threaded discussions

**Route**: `/post/:id` (comments section)
**Existing coverage**: `comments.auth.spec.ts` (10 tests), `comments.public.spec.ts` (11 tests) — **good**
**Gap**: No cross-journey test (create content → add comment → see comment count update)

```gherkin
Feature: Comments & Engagement
  As a user
  I want to comment on content and interact with creators
  So that I can participate in the community

  # --- COMMENT CREATION ---

  Scenario: Post a comment on published content
    Given I am authenticated
    And I am viewing a published post with comments enabled
    When I type a comment in the comment input
    And I submit the comment
    Then my comment should appear in the comments section
    And the comment count should increment

  Scenario: Post a reply to an existing comment
    Given I am viewing a post with existing comments
    When I click reply on a comment
    And I type a reply and submit
    Then my reply should appear nested under the parent comment

  # --- COMMENT VIEWING ---

  Scenario: View threaded comments on a post
    Given a post has comments with replies
    When I view the post
    Then I should see top-level comments
    And I should see nested replies under parent comments
    And comments should show author name, timestamp, and content

  Scenario: View comments as unauthenticated user
    Given I am not authenticated
    And a post has published comments
    When I view the post
    Then I should see existing comments (read-only)
    And I should see a prompt to log in to comment

  # --- COMMENT MODERATION ---

  Scenario: Delete own comment
    Given I have posted a comment
    When I click the delete button on my comment
    Then the comment should be removed
    And the comment count should decrement

  # --- CROSS-JOURNEY FLOW ---

  Scenario: Create content then add comment (journey test)
    Given I am authenticated
    When I create and publish a new article
    And I navigate to the published post
    And I post a comment
    Then the comment should appear under the post
    And the post's comment count should show 1

  # --- AGENT PATH ---

  Scenario: Agent posts comment via API
    Given I have a valid auth token
    When I POST to /api/v2/comments with content_id and body
    Then I should receive 201 with the created comment
    And the comment should have an id, author, and timestamp
```

---

## Journey 9: Content Shield & Safety

**Goal**: Creator manages content moderation, safety metrics, and protection

**Route**: `/shield`
**Existing coverage**: `shield.auth.spec.ts` (4 tests) — basic
**Gap**: No moderation action tests, no safety metric assertions

```gherkin
Feature: Content Shield & Safety
  As a creator
  I want to protect my content and manage moderation
  So that my platform presence remains safe and professional

  Background:
    Given I am authenticated as a creator

  Scenario: View shield dashboard
    When I navigate to /shield
    Then I should see the shield page heading
    And I should see content safety metrics
    And I should see moderation tools or status indicators

  Scenario: Shield shows safety score
    When I view the shield dashboard
    Then I should see a content safety score or rating
    And I should see recommendations if safety issues exist

  Scenario: View flagged content list
    When I view the shield dashboard
    And there are flagged content items
    Then I should see a list of flagged items with reasons
    And I should see action buttons (approve, remove)

  Scenario: Navigate to shield from main navigation
    Given I am on any authenticated page
    When I click the shield link in the navigation
    Then I should navigate to /shield
```

---

## Journey 10: Business Management

**Goal**: Creator manages contracts, invoices, revenue tracking, and tax reporting

**Route**: `/business`
**Existing coverage**: `business.auth.spec.ts` (6 tests) — decent
**Gap**: No financial data assertions, no export tests

```gherkin
Feature: Business Management
  As a creator running a content business
  I want to manage contracts, invoices, and taxes
  So that I can operate professionally

  Background:
    Given I am authenticated as a creator

  Scenario: View business dashboard
    When I navigate to /business
    Then I should see the business page heading
    And I should see revenue overview section
    And I should see contract management section

  Scenario: View revenue overview
    When I am on the business dashboard
    Then I should see total revenue figures
    And I should see revenue trends or charts

  Scenario: View contract management
    When I am on the business dashboard
    Then I should see contract listing or management interface
    And I should see invoice tracking section

  Scenario: Export financial data
    When I am on the business dashboard
    And I click the export button
    Then I should receive a downloadable file with financial data

  Scenario: View tax reporting
    When I am on the business dashboard
    Then I should see tax-related information or quarterly summaries
```

---

## Journey 11: Wellness & Creator Health

**Goal**: Creator monitors creative health, burnout risk, and activity patterns

**Route**: `/wellness`
**Existing coverage**: `wellness.auth.spec.ts` (5 tests) — decent
**Gap**: No burnout gauge data assertion, no activity pattern tests

```gherkin
Feature: Wellness & Creator Health
  As a creator
  I want to monitor my creative health and burnout risk
  So that I can sustain my content creation long-term

  Background:
    Given I am authenticated as a creator

  Scenario: View wellness dashboard
    When I navigate to /wellness
    Then I should see the wellness page heading
    And I should see wellness metrics
    And I should see burnout risk gauge
    And I should see activity pattern visualization

  Scenario: Burnout gauge shows meaningful data
    When I view the wellness dashboard
    Then the burnout risk gauge should display a score or level
    And it should not show only a loading state after 5 seconds

  Scenario: View activity patterns
    When I view the wellness dashboard
    Then I should see my content creation activity over time
    And I should see rest/recovery indicators

  Scenario: Wellness recommendations
    When I view the wellness dashboard
    And my burnout risk is elevated
    Then I should see actionable recommendations
```

---

## Journey 12: Creator Network & Community

**Goal**: Creator connects with other creators via circles, mentorship, collaborations, and marketplace

**Route**: `/community`
**Existing coverage**: `creator-network.auth.spec.ts` (4 tests), `network.auth.spec.ts` (17 tests) — good
**Gap**: No actual circle creation or mentorship request flow tests

```gherkin
Feature: Creator Network & Community
  As a creator
  I want to connect with other creators
  So that I can collaborate, mentor, and grow together

  Background:
    Given I am authenticated as a creator

  # --- TAB NAVIGATION ---

  Scenario: View community page with tabs
    When I navigate to /community
    Then I should see the community page heading
    And I should see tabs for Circles, Mentorship, Collaborations, and Marketplace

  Scenario: Switch between community tabs
    When I am on the community page
    And I click the "Mentorship" tab
    Then the Mentorship tab should be active
    And I should see mentorship-specific content

  # --- CIRCLES ---

  Scenario: View circles tab
    When I am on the community page
    And the Circles tab is active
    Then I should see available circles or empty state

  # --- MENTORSHIP ---

  Scenario: Filter mentorship listings
    When I switch to the Mentorship tab
    Then I should see filter inputs for niche and audience size
    When I enter a niche filter value
    Then the filter should be applied to results

  # --- COLLABORATIONS ---

  Scenario: View collaborations tab
    When I switch to the Collaborations tab
    Then I should see collaboration opportunities or placeholder

  # --- MARKETPLACE ---

  Scenario: View marketplace tab
    When I switch to the Marketplace tab
    Then I should see marketplace listings or placeholder
```

---

## Journey 13: Notifications

**Goal**: User receives and manages real-time notifications

**Route**: Notification panel (overlay, accessible from any page)
**Existing coverage**: `notifications.auth.spec.ts` (6 tests) — good
**Gap**: Minor — could add notification preferences test

```gherkin
Feature: Notifications
  As a user
  I want to receive notifications about activity on my content
  So that I can stay engaged with my audience

  Background:
    Given I am authenticated

  Scenario: View notification bell
    When I am on any authenticated page
    Then I should see a notification bell icon in the header

  Scenario: Open notification panel
    When I click the notification bell
    Then I should see the notification panel
    And I should see my recent notifications or empty state

  Scenario: Receive notification after being followed
    Given another creator follows me
    When I open the notification panel
    Then I should see a "new follower" notification

  Scenario: Mark all notifications as read
    Given I have unread notifications
    When I open the notification panel
    And I click "Mark all as read"
    Then the unread badge should disappear
    And all notifications should show as read

  Scenario: Empty notification state
    Given I have no notifications
    When I open the notification panel
    Then I should see an empty state message
```

---

## Journey 14: Navigation & Global Layout

**Goal**: User navigates between all sections of the platform seamlessly

**Route**: All routes (layout wrapper)
**Existing coverage**: `navigation.auth.spec.ts` (6 tests) — good
**Gap**: No mobile/responsive navigation test, no breadcrumb verification

```gherkin
Feature: Navigation & Global Layout
  As a user
  I want to navigate between all platform sections
  So that I can access any feature quickly

  Background:
    Given I am authenticated as a creator

  Scenario: Navigation bar shows all creator links
    When I am on any authenticated page
    Then I should see links to: Profile, Create, Dashboard, Wellness, Shield
    And the Sovren logo should be visible

  Scenario: Navigate to each main section
    When I click the Dashboard link
    Then I should navigate to /dashboard
    When I click the Wellness link
    Then I should navigate to /wellness
    When I click the Shield link
    Then I should navigate to /shield

  Scenario: Logo navigates to home
    When I click the Sovren logo
    Then I should navigate to the home page (/)

  Scenario: Home page navigation for visitors
    Given I am not authenticated
    When I am on the home page
    Then I should see navigation links to Discover, Login, and Sign Up
```

---

## Journey 15: Agent-Native API Workflows

**Goal**: AI agents can perform all creator actions programmatically via API

**Route**: `/api/*` (no browser — Playwright `request` context only)
**Existing coverage**: **NONE** — no `*.api.spec.ts` files, no API project in playwright.config.ts
**Gap**: Entire agent-native test path is missing

```gherkin
Feature: Agent-Native API Workflows
  As an AI agent
  I want to perform all creator actions via API
  So that I can automate content creation, monitoring, and optimization

  # --- AUTHENTICATION ---

  Scenario: Agent authenticates via NOSTR challenge-response
    When I POST to /api/auth/challenge with my NOSTR pubkey
    Then I should receive a challenge string
    When I POST to /api/auth/authenticate with the signed challenge
    Then I should receive a JWT token
    And the token should work for subsequent API calls

  Scenario: Agent receives 401 for expired token
    Given I have an expired auth token
    When I make any authenticated API request
    Then I should receive 401 with error_code UNAUTHORIZED
    And the error should include a message and suggested_action

  # --- CONTENT CRUD ---

  Scenario: Agent creates article content
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with article data
    Then I should receive 201
    And the response should include the content item with id, title, and created_at

  Scenario: Agent creates content with file upload
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with multipart form data and a file
    Then I should receive 201
    And content_url should point to Supabase Storage

  Scenario: Agent lists all content
    Given I have a valid auth token
    When I GET /api/v1/content with limit=20&offset=0
    Then I should receive a paginated response
    And each item should include id, title, content_type, created_at, and stats

  Scenario: Agent reads single content item
    Given a content item exists with ID {id}
    When I GET /api/v1/content/{id}
    Then I should receive the full content item

  Scenario: Agent deletes own content
    Given I have created content with ID {id}
    When I DELETE /api/v1/content/{id}
    Then I should receive a success response
    And the content should no longer exist

  # --- ERROR HANDLING ---

  Scenario: Agent receives structured error on validation failure
    Given I have a valid auth token
    When I POST to /api/v1/content/publish with missing required fields
    Then I should receive 400
    And the response should have success=false
    And the error object should include code and message

  Scenario: Agent receives 404 for nonexistent content
    Given I have a valid auth token
    When I GET /api/v1/content/nonexistent-id
    Then I should receive 404
    And the error should include NOT_FOUND code

  # --- COMMENTS VIA API ---

  Scenario: Agent posts a comment
    Given I have a valid auth token
    And content exists with ID {contentId}
    When I POST to /api/v2/comments with content_id and body
    Then I should receive 201 with the created comment

  Scenario: Agent lists comments for content
    Given content exists with comments
    When I GET /api/v2/comments?content_id={contentId}
    Then I should receive a list of comments

  # --- SECURITY TESTS ---

  Scenario: Agent cannot delete another user's content (ownership check)
    Given User A has created content with ID {id}
    And I am authenticated as User B
    When I DELETE /api/v1/content/{id}
    Then I should receive 403 Forbidden
    # NOTE: Currently this test will FAIL — DELETE has no ownership check (P1 security gap)

  Scenario: Agent cannot access protected routes without auth
    When I GET /api/v1/content without an Authorization header
    Then I should receive 401

  # --- HEALTH & READINESS ---

  Scenario: Health endpoints are accessible
    When I GET /health
    Then I should receive 200 with status information
    When I GET /ready
    Then I should receive 200 indicating readiness
    When I GET /live
    Then I should receive 200 indicating liveness
```

---

## Cross-Journey Integration Tests

These tests validate multi-page flows that span multiple journeys.

```gherkin
Feature: Cross-Journey Integration
  As a creator
  I want the entire platform to work together seamlessly
  So that I can complete complex workflows without issues

  Scenario: Full creator golden path (Journey 1+2+4+3)
    Given I am authenticated as a creator
    # Start on empty dashboard
    When I navigate to /dashboard
    Then I should see the empty state
    # Create content
    When I click "Create Content"
    And I publish an article titled "Golden Path Test"
    Then I should see a success message
    # Dashboard shows new content
    When I navigate to /dashboard
    Then I should see "Golden Path Test" in my content list
    # View the post
    When I click on "Golden Path Test"
    Then I should see the full post at /post/{id}
    # Verify on discovery page
    When I navigate to /discover
    Then the published content should be discoverable
    # Cleanup
    When I delete the test content via API
    Then it should be removed

  Scenario: Content lifecycle with comments (Journey 2+4+8)
    Given I am authenticated as a creator
    And I have published content "Comment Test Post"
    When I navigate to the post
    And I post a comment "Great article!"
    Then the comment should appear
    And the comment count should show 1
    When I navigate to /dashboard
    Then the content item should reflect the updated comment count

  Scenario: Discovery to creator profile flow (Journey 3+7)
    Given there is published content by a known creator
    When I am on the discovery page
    And I click on a content card
    Then I should see the post detail
    When I click the creator's name
    Then I should navigate to /creator/{id}
    And I should see their profile and content list
```

---

## Implementation Priority Matrix

| Priority | Journey                                 | New Files Needed       | Est. Tests | Effort |
| -------- | --------------------------------------- | ---------------------- | ---------- | ------ |
| **P1**   | J2: Content Creation                    | POM + spec             | 8-10       | Medium |
| **P1**   | J4: Dashboard                           | POM + spec             | 6-8        | Medium |
| **P1**   | Cross-Journey Golden Path               | spec only              | 2-3        | Small  |
| **P1**   | J3: Discovery (enhance)                 | enhance spec           | 3-4        | Small  |
| **P1**   | Infra: API project in playwright.config | config change          | 0          | Tiny   |
| **P1**   | Infra: Test media fixtures              | fixture files          | 0          | Tiny   |
| **P2**   | J7: Profile                             | spec only (POM exists) | 3-4        | Small  |
| **P2**   | J6: Monetization (enhance)              | enhance specs          | 3-4        | Small  |
| **P2**   | J15: Agent API CRUD                     | spec only              | 8-10       | Medium |
| **P2**   | J15: Agent Auth                         | spec only              | 3-4        | Small  |
| **P2**   | J5: Analytics (enhance)                 | enhance spec           | 2-3        | Small  |
| **P3**   | J8: Comments Journey                    | spec only              | 3-4        | Small  |
| **P3**   | J9-12: Shield/Biz/Well/Network enhance  | enhance specs          | 4-6        | Small  |
| **P3**   | J14: Navigation mobile                  | enhance spec           | 1-2        | Tiny   |
| **P3**   | Cleanup: Delete 9 duplicate " 2" files  | deletion only          | 0          | Tiny   |
