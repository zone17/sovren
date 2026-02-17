# Phase 7: Creator Safety Net -- Requirements Document

**Epics**: EPIC-007 (Creator Wellness) + EPIC-008 (Content Shield)
**PRD Source**: `SOVREN_PRD_V2_CREATOR_EMPOWERMENT.md` Domains 1 & 2
**Decomposition Source**: `docs/plans/PRD_V2_EPIC_DECOMPOSITION.md` (lines 451-969)
**Date**: 2026-02-15
**Author**: Product Owner (Phase 7 Sprint)
**Status**: DRAFT

---

## 1. Executive Summary

Phase 7 addresses the two most acute creator pain points identified in the PRD research:

1. **Burnout** (79-90% of creators affected; 2/3 report anxiety/depression)
2. **Content Theft** (AI clipper accounts outperforming originals; consumer skepticism doubled to 32%)

The Creator Safety Net delivers two feature systems:
- **Creator Wellness** (EPIC-007): Work pattern tracking, burnout risk scoring, sustainable scheduling, boundary controls, wellness check-ins, and a resource library.
- **Content Shield** (EPIC-008): Cryptographic provenance signing, perceptual content fingerprinting, NOSTR relay scanning for copies, alert management, DMCA report generation, and authenticity badges.

### Privacy Principle (Non-Negotiable)

**ALL wellness data is PRIVATE to the creator.** It is never shared with other users, never used for platform analytics, never sold to third parties, and deletable at any time. This is a core design constraint, not a feature toggle.

---

## 2. EPIC-007: Creator Wellness System

### 2.1 Domain Context

- **PRD Domain**: Domain 1 -- Creator Wellness
- **PRD Stories**: US-201 (Wellness Dashboard), US-202 (Sustainable Scheduling), US-203 (Creator Boundaries), US-204 (Wellness Insights & Resources)
- **Implementation Stories**: 10 (US-E7-001 through US-E7-010)
- **Builds On**: Existing analytics infrastructure (US-004), content scheduling (US-072), notification controls
- **New Database Tables**: `wellness_snapshots`, `creator_work_patterns`
- **New Feature Module**: `packages/frontend/src/features/wellness/`
- **New Backend Routes**: `packages/backend/src/routes/v2/wellness/`
- **New Shared Types**: `packages/shared/src/types/wellness.ts`

---

### US-E7-001: Wellness Data Model & Migration

**Priority**: P0-CRITICAL | **PRD Source**: Infrastructure for US-201 through US-204
**Dependencies**: None (start immediately)

#### User Story
As a backend developer, I need the wellness data model and database migration so that all wellness features have a stable data foundation.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-001-1 | `wellness_snapshots` table created with columns: `id` (UUID PK), `creator_id` (FK), `energy` (1-5 int), `motivation` (1-5 int), `stress` (1-5 int), `work_hours` (numeric), `created_at` (timestamptz) | Yes -- migration runs successfully |
| AC-001-2 | `creator_work_patterns` table created with columns: `id` (UUID PK), `creator_id` (FK), `date` (date), `content_time_mins` (int), `engagement_time_mins` (int), `management_time_mins` (int), `total_hours` (numeric), `created_at` (timestamptz) | Yes -- migration runs successfully |
| AC-001-3 | RLS policies enforce that creators can ONLY read/write their own rows in both tables | Yes -- cross-creator SELECT/INSERT returns 0 rows / error |
| AC-001-4 | Supabase migration file created and runs cleanly on both empty and existing databases | Yes -- run on fresh + seeded DB |
| AC-001-5 | TypeScript types exported from `packages/shared/src/types/wellness.ts` and importable by both frontend and backend | Yes -- tsc compiles without errors |
| AC-001-6 | Indexes created on `creator_id` and `created_at` for both tables | Yes -- EXPLAIN shows index scan |

#### Edge Cases
- Migration on a database that already has partial schema (idempotent migration)
- Creator with UUID that doesn't exist in the users table (FK constraint must reject)
- Concurrent migrations from multiple instances (migration lock)

#### Business Rules
- BR-001: No wellness data is ever exposed in any API that isn't scoped to the authenticated creator
- BR-001b: Deletion of a creator account MUST cascade-delete all wellness data

---

### US-E7-002: Work Pattern Tracking API

**Priority**: P0-CRITICAL | **PRD Source**: US-201
**Dependencies**: US-E7-001

#### User Story
As a creator, I want my work patterns automatically tracked so I can see how I spend my time without manual logging.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-002-1 | `POST /api/v2/wellness/patterns` accepts `{ type: 'content'|'engagement'|'management', duration_mins: number, timestamp: ISO8601 }` and returns 201 | Yes -- API test |
| AC-002-2 | `GET /api/v2/wellness/patterns?period=7d|30d|90d` returns aggregated work patterns grouped by day with totals per category | Yes -- API test with seeded data |
| AC-002-3 | `GET /api/v2/wellness/patterns/heatmap` returns 7x24 matrix (days x hours) of work activity intensity | Yes -- API test |
| AC-002-4 | Auto-tracking middleware captures content publish, DM sends, and analytics page views as implicit work events without creator action | Yes -- publish content, verify pattern record created |
| AC-002-5 | All endpoints validate input with Zod schemas; invalid payloads return 400 with structured error | Yes -- send malformed payload |
| AC-002-6 | Rate limiting: max 100 pattern records per creator per hour | Yes -- exceed limit, verify 429 |
| AC-002-7 | All endpoints return data scoped to authenticated creator only (no cross-creator leakage) | Yes -- auth as creator B, query creator A data returns empty |

#### Edge Cases
- Creator with zero work pattern data (new user): heatmap and aggregation return empty structures, not errors
- Pattern recorded at exactly midnight UTC: belongs to the correct day
- Pattern with `duration_mins: 0`: accepted (valid for tracking a point-in-time event like "opened analytics")
- Pattern with `duration_mins > 1440` (> 24 hours): rejected with validation error
- Two auto-tracked events within 1 second: both recorded (no dedup)
- Period parameter missing or invalid value: return 400 with valid options listed

#### Business Rules
- BR-002: Work patterns are read-only after creation (no PUT/DELETE for individual records -- creators can delete ALL their data via a bulk delete endpoint)
- BR-002b: Auto-tracking events are tagged with `source: 'auto'` to distinguish from manual entries (`source: 'manual'`)
- BR-002c: Heatmap data is always in the creator's configured timezone (or UTC if not set)

---

### US-E7-003: Burnout Risk Scoring Engine

**Priority**: P1-HIGH | **PRD Source**: US-201
**Dependencies**: US-E7-002

#### User Story
As a creator, I want to know my burnout risk level so I can take proactive steps before reaching crisis.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-003-1 | `GET /api/v2/wellness/risk-score` returns `{ score: number (0-100), level: 'low'|'moderate'|'high'|'critical', factors: FactorBreakdown[], baseline_ready: boolean }` | Yes -- API test |
| AC-003-2 | Scoring uses weighted 5-factor algorithm with correct weights: work hours trend (0.25), posting frequency spike (0.20), engagement drop (0.20), hour regularity (0.15), rest day deficit (0.20) | Yes -- unit test with known inputs |
| AC-003-3 | **Scenario A**: Creator works 40hrs/week, regular hours, 2 rest days => score ~15 (Low) | Yes -- deterministic test |
| AC-003-4 | **Scenario B**: Creator works 60hrs/week, posting 3x normal, engagement stable => score ~40 (Moderate) | Yes -- deterministic test |
| AC-003-5 | **Scenario C**: Creator works 70hrs/week, irregular hours, 0 rest days, engagement dropping => score ~85 (Critical) | Yes -- deterministic test |
| AC-003-6 | Baseline calibration: first 14 days of data establish personal baseline; before 14 days, `baseline_ready: false` and no risk level is computed | Yes -- test with <14 days data |
| AC-003-7 | Historical risk scores stored as weekly snapshots for trend display | Yes -- verify snapshot created weekly |
| AC-003-8 | Creator can adjust sensitivity thresholds via `PUT /api/v2/wellness/risk-score/settings` | Yes -- adjust, verify score changes |

#### Algorithm Specification

```
Score = sum of (factor_contribution * factor_weight) * 100

Factor contributions (each 0.0 to 1.0):

1. Work Hours Trend (weight: 0.25)
   - Compare current week hours to personal baseline (rolling 4-week average)
   - contribution = clamp((current / baseline - 1.0) / 0.5, 0, 1)
   - Triggers at >120% of baseline, maxes at >170%

2. Posting Frequency Spike (weight: 0.20)
   - Compare posts this week to 4-week rolling average
   - contribution = clamp((current / average - 1.0) / 1.0, 0, 1)
   - Triggers at >150% of average, maxes at >250%

3. Engagement Drop (weight: 0.20)
   - Compare engagement rate to 4-week average
   - contribution = clamp((1.0 - current / average) / 0.3, 0, 1)
   - Triggers when engagement drops below 70% of average, maxes at 40%

4. Hour Regularity (weight: 0.15)
   - Standard deviation of daily work start/end times
   - contribution = clamp((stddev_hours - 1.0) / 3.0, 0, 1)
   - Triggers at >1hr stddev, maxes at >4hrs

5. Rest Day Deficit (weight: 0.20)
   - Days this week with <30min tracked activity
   - contribution = clamp((2 - rest_days) / 2, 0, 1)
   - 2+ rest days = 0 contribution; 0 rest days = 1.0

Thresholds:
  Low:      0-25
  Moderate: 26-50
  High:     51-75
  Critical: 76-100
```

#### Edge Cases
- New creator with exactly 14 days of data: baseline computed, first score generated
- Creator with 13 days of data: `baseline_ready: false`, score returned as `null`
- Creator who works exclusively at night (e.g., 10pm-6am): hour regularity should not penalize consistent night-owl schedules
- Creator with zero posts in a week: posting frequency factor should not divide by zero
- Creator with zero engagement (no subscribers yet): engagement factor returns 0 contribution (no penalty for new creators)
- All 5 factors at maximum: score should be exactly 100
- All 5 factors at zero: score should be exactly 0
- Creator adjusts sensitivity after 30 days: historical scores stay as-is, only future scores use new thresholds

#### Business Rules
- BR-003: Burnout scores are NEVER shared outside the creator's own dashboard
- BR-003b: No push notifications for burnout risk unless creator explicitly opts in to risk alerts
- BR-003c: Risk score computation is idempotent -- calling the endpoint multiple times returns the same score for the same underlying data

---

### US-E7-004: Wellness Dashboard UI

**Priority**: P1-HIGH | **PRD Source**: US-201
**Dependencies**: US-E7-002, US-E7-003

#### User Story
As a creator, I want a wellness dashboard that shows my work patterns and burnout risk so I can monitor my wellbeing at a glance.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-004-1 | `WellnessDashboard` component renders as a new tab in existing CreatorDashboard | Yes -- navigate, verify tab exists |
| AC-004-2 | `WorkPatternHeatmap` displays 7x24 grid of work activity with color intensity | Yes -- visual regression test |
| AC-004-3 | `BurnoutRiskGauge` shows risk level with color coding: green (low), yellow (moderate), orange (high), red (critical) | Yes -- render with each level |
| AC-004-4 | `RestDayTracker` shows current streak, work/rest ratio, and weekly rest day count | Yes -- component test |
| AC-004-5 | `SustainablePaceIndicator` compares current posting frequency to personal sustainable baseline | Yes -- component test |
| AC-004-6 | Dashboard renders gracefully with empty data (new creator): shows onboarding message, not errors or blank space | Yes -- render with no API data |
| AC-004-7 | Dashboard renders correctly when `baseline_ready: false` (< 14 days): shows progress indicator ("7 more days until your baseline is ready") | Yes -- component test |
| AC-004-8 | All components have ARIA labels and are keyboard navigable | Yes -- axe accessibility test |
| AC-004-9 | Responsive design: usable on mobile (320px+), tablet, and desktop | Yes -- Playwright viewport tests |

#### Edge Cases
- API returns 500: dashboard shows error state with retry button, not crash
- Creator has exactly 1 day of data: heatmap shows sparse data, no misleading patterns
- Creator toggles between time periods (7d/30d/90d): data refreshes without full page reload
- Screen reader announces burnout risk level in plain language ("Your burnout risk is moderate at 42 out of 100")

#### Business Rules
- BR-004: Dashboard defaults to 7-day view on load
- BR-004b: Heatmap uses creator's timezone, not UTC
- BR-004c: No comparative data with other creators shown on the main dashboard (benchmarking is separate, opt-in only via pulse check-ins)

---

### US-E7-005: Sustainable Scheduling Assistant

**Priority**: P1-HIGH | **PRD Source**: US-202
**Dependencies**: US-E7-003

#### User Story
As a creator, I want recommendations for sustainable posting cadences so I can maintain consistency without overworking.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-005-1 | `GET /api/v2/wellness/schedule/recommendations` returns optimal posting frequency and best times based on creator's historical performance | Yes -- API test with seeded data |
| AC-005-2 | `GET /api/v2/wellness/buffer-depth` returns number of days of scheduled content ahead | Yes -- API test |
| AC-005-3 | `SustainableScheduler` component shows recommended cadence vs current cadence with visual comparison | Yes -- component test |
| AC-005-4 | `CreativeBuffer` component shows content buffer depth with threshold alert | Yes -- component test |
| AC-005-5 | `BatchCreationWindows` component suggests productive hours based on creator's historical output quality | Yes -- component test |
| AC-005-6 | Alert fires when content buffer drops below creator-set threshold (default: 3 days) | Yes -- set threshold, deplete buffer |
| AC-005-7 | Integrates with existing content scheduling (US-072) without breaking existing functionality | Yes -- regression test |

#### Edge Cases
- Creator with no scheduled content: buffer depth = 0, component shows "No content buffer" with call-to-action
- Creator with 100+ days of scheduled content: displays correctly without UI overflow
- Creator who posts at irregular intervals: recommendations based on available data, not forced to daily schedule
- Recommendations for a creator with < 14 days of data: show generic best practices, not data-driven recommendations
- Creator changes timezone: scheduled content times adjust, buffer depth recalculated

#### Business Rules
- BR-005: Recommendations optimize for SUSTAINABILITY, not maximum output. The algorithm should never recommend increasing posting frequency above the creator's historical sustainable peak.
- BR-005b: Buffer alerts are informational, never blocking. Creators can always publish outside the recommended schedule.
- BR-005c: "Best times" recommendations update weekly based on rolling 30-day performance data

---

### US-E7-006: Creator Boundaries Controls

**Priority**: P1-HIGH | **PRD Source**: US-203
**Dependencies**: US-E7-001

#### User Story
As a creator, I want to set engagement boundaries so I can protect my time and mental energy.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-006-1 | `PUT /api/v2/wellness/boundaries` saves boundary config: focus hours (start/end time, days), weekly engagement budget (minutes), DND mode (on/off), auto-response template | Yes -- API test |
| AC-006-2 | `GET /api/v2/wellness/boundaries` returns current settings | Yes -- API test |
| AC-006-3 | `BoundarySettings` component allows configuring all boundary options with immediate save | Yes -- component test |
| AC-006-4 | `CreatorAvailabilityStatus` component shows public-facing status: available / creating / offline | Yes -- component test |
| AC-006-5 | During focus hours, all notifications are silenced and queued for delivery when focus hours end | Yes -- set focus hours, verify notification queue |
| AC-006-6 | Auto-response sends via existing NOSTR DM system when DMs arrive during off-hours | Yes -- send DM during off-hours, verify auto-response |
| AC-006-7 | Status is visible on creator's public profile page | Yes -- view profile as supporter |
| AC-006-8 | DND mode batches notifications and delivers as a digest when DND is deactivated | Yes -- enable DND, accumulate notifications, disable DND |
| AC-006-9 | Weekly engagement budget shows remaining time and alerts at 80% and 100% thresholds | Yes -- simulate engagement time |

#### Edge Cases
- Focus hours span midnight (e.g., 10pm - 6am): correctly handles day boundary
- Creator in timezone UTC-12 sets focus hours: applied correctly relative to their local time
- Auto-response template is empty: no auto-response sent (silent off-hours)
- Creator receives 1000 notifications during DND: digest is paginated, not a wall of text
- Creator changes focus hours while currently in focus mode: change takes effect immediately (doesn't wait for current focus period to end)
- Supporter sends DM, gets auto-response, then sends follow-up: no second auto-response within 24 hours (anti-spam)

#### Business Rules
- BR-006: Boundary settings are per-creator and persist across sessions
- BR-006b: Public availability status is opt-in. Default is "do not show status."
- BR-006c: Auto-response cooldown: maximum 1 auto-response per sender per 24 hours
- BR-006d: Engagement budget resets weekly on the creator's configured "week start" day (default: Monday)

---

### US-E7-007: Wellness Pulse Check-Ins

**Priority**: P2-MEDIUM | **PRD Source**: US-204
**Dependencies**: US-E7-001

#### User Story
As a creator, I want optional weekly wellness check-ins so I can track my mental state over time.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-007-1 | `POST /api/v2/wellness/pulse` accepts `{ energy: 1-5, motivation: 1-5, stress: 1-5 }` and returns 201 | Yes -- API test |
| AC-007-2 | `GET /api/v2/wellness/pulse/history` returns pulse history array sorted by date descending | Yes -- API test |
| AC-007-3 | `WellnessPulseModal` appears as a gentle weekly prompt (once per 7 days, dismissible) | Yes -- component test |
| AC-007-4 | `WellnessTrend` component renders line chart of energy, motivation, stress over time | Yes -- visual component test |
| AC-007-5 | `GET /api/v2/wellness/benchmark` returns anonymous aggregate stats (average scores across all opted-in creators) with NO individual data | Yes -- API test, verify no creator IDs |
| AC-007-6 | Pulse data is opt-in only; creator must explicitly enable pulse check-ins | Yes -- verify no prompt until opt-in |
| AC-007-7 | Creator can delete all pulse history at any time via `DELETE /api/v2/wellness/pulse` | Yes -- API test |
| AC-007-8 | Dismissing the pulse modal respects opt-out permanently (never shows again until re-enabled in settings) | Yes -- dismiss, verify no future prompts |

#### Edge Cases
- Creator submits two pulses in the same week: second submission overwrites the first (one pulse per week)
- Creator opts out after 10 weeks of data: data retained but no more prompts. Deletion is separate action.
- Benchmark endpoint with < 10 opted-in creators: returns null (too small for anonymity)
- All values at 1 (worst): valid submission, triggers no automatic action (Sovren doesn't diagnose)
- All values at 5 (best): valid submission
- Values outside 1-5 range: rejected with 400

#### Business Rules
- BR-007: Pulse data never leaves the creator's own records. Benchmarking uses only aggregated, anonymized data.
- BR-007b: Benchmark requires minimum 10 participating creators per cohort for k-anonymity
- BR-007c: Pulse prompt appears on the creator's first dashboard visit each week, not at a fixed time
- BR-007d: Sovren does NOT interpret wellness data medically. No language like "you may be depressed" -- only factual trends ("your stress rating has increased 2 points over 4 weeks")

---

### US-E7-008: Wellness Resource Library

**Priority**: P3-LOW | **PRD Source**: US-204
**Dependencies**: None

#### User Story
As a creator, I want access to curated mental health and wellness resources so I can proactively support my wellbeing.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-008-1 | `WellnessResources` component renders categorized resource cards | Yes -- component test |
| AC-008-2 | Resources organized into categories: Communities, Articles, Tools, Crisis Resources | Yes -- verify categories |
| AC-008-3 | Each resource card shows: title, description, category, external link | Yes -- component test |
| AC-008-4 | Resources filterable by category | Yes -- filter, verify results |
| AC-008-5 | All links open in new tab (external sites, not hosted on Sovren) | Yes -- verify target="_blank" |
| AC-008-6 | Static data file with initial curated resources (minimum 3 per category) | Yes -- count resources |
| AC-008-7 | Mobile-responsive layout | Yes -- viewport test |
| AC-008-8 | Accessible: ARIA labels, keyboard navigable, proper heading hierarchy | Yes -- axe test |

#### Edge Cases
- External resource link is broken (404): resource still renders; broken link is a maintenance issue, not a runtime error
- Resource list is empty (all resources removed): shows "No resources available" message

#### Business Rules
- BR-008: Crisis resources (suicide hotlines, mental health emergency lines) are ALWAYS shown at the top, regardless of filter
- BR-008b: Resources are curated by the Sovren team, not user-generated
- BR-008c: No tracking of which resources creators click (privacy)

---

### US-E7-009: Wellness Feature Integration Tests

**Priority**: P1-HIGH | **PRD Source**: Quality gate
**Dependencies**: US-E7-004, US-E7-005, US-E7-006

#### Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-009-1 | E2E: Navigate to wellness dashboard, verify data renders with seeded data |
| AC-009-2 | E2E: Set boundary controls, verify notifications suppressed during focus hours |
| AC-009-3 | E2E: Submit wellness pulse, verify trend chart updates |
| AC-009-4 | Integration: Work pattern tracking captures content publish events automatically |
| AC-009-5 | Integration: Burnout risk score updates when patterns change |
| AC-009-6 | All E2E tests pass in Chromium, Firefox, and WebKit |

---

### US-E7-010: Wellness Feature Documentation

**Priority**: P2-MEDIUM | **PRD Source**: Documentation standard
**Dependencies**: All US-E7-* stories

#### Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-010-1 | Mermaid architecture diagram for wellness data flow saved to `/docs/architecture/diagrams/` |
| AC-010-2 | Mermaid component interaction diagram |
| AC-010-3 | CHANGELOG.md entry for all wellness features |
| AC-010-4 | ADR for wellness data privacy model saved to `/docs/decisions/` |
| AC-010-5 | CLAUDE.md updated if new patterns introduced |

---

## 3. EPIC-008: Content Shield (AI Protection)

### 3.1 Domain Context

- **PRD Domain**: Domain 2 -- Content Shield
- **PRD Stories**: US-211 (Content Provenance Signing), US-212 (Content Fingerprinting), US-213 (AI Content Alerts), US-214 (Authenticity Verification Badge)
- **Implementation Stories**: 11 (US-E8-001 through US-E8-009, with US-E8-004 split into 004a/004b/004c)
- **Builds On**: Existing NOSTR event publishing (US-015), NIP-05 verification (US-016)
- **New Database Tables**: `provenance_records`, `content_fingerprints`, `content_alerts`
- **New Feature Module**: `packages/frontend/src/features/content-shield/`
- **New Backend Service**: `packages/backend/src/services/provenance/`
- **New Shared Types**: `packages/shared/src/types/provenance.ts`

---

### US-E8-001: Provenance Data Model & NOSTR Event Extension

**Priority**: P0-CRITICAL | **PRD Source**: Infrastructure for US-211 through US-214
**Dependencies**: None

#### User Story
As a backend developer, I need the provenance and fingerprint data models so that Content Shield features have a stable data foundation.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-E8-001-1 | `provenance_records` table created with columns: `id` (UUID PK), `content_id` (FK), `nostr_event_id` (text), `signature` (text), `relay_confirmations` (jsonb array), `creator_pubkey` (text), `content_hash` (text), `created_at` (timestamptz) | Yes -- migration |
| AC-E8-001-2 | `content_fingerprints` table created with columns: `id` (UUID PK), `content_id` (FK), `creator_id` (FK), `hash_type` (enum: 'simhash'|'phash'), `hash_value` (text), `content_type` (enum: 'text'|'image'), `created_at` (timestamptz) | Yes -- migration |
| AC-E8-001-3 | `content_alerts` table created with columns: `id` (UUID PK), `creator_id` (FK), `content_id` (FK), `detected_copy_url` (text), `detected_event_id` (text nullable), `confidence` (numeric 0-100), `similarity_score` (numeric 0-100), `status` (enum: 'new'|'reviewed'|'false_positive'|'reported'|'resolved'), `created_at` (timestamptz), `updated_at` (timestamptz) | Yes -- migration |
| AC-E8-001-4 | RLS policies: creators can read all provenance records (public for verification) but only create for their own content; content_alerts readable/writable only by the creator | Yes -- cross-creator test |
| AC-E8-001-5 | NOSTR event tag extension defined: provenance metadata tags `['provenance', content_hash]`, `['provenance-sig', signature]`, `['provenance-relays', relay_list_json]` | Yes -- type definition |
| AC-E8-001-6 | TypeScript types exported from `packages/shared/src/types/provenance.ts` | Yes -- tsc compiles |
| AC-E8-001-7 | Migration runs on both clean and existing databases | Yes -- run on fresh + seeded |
| AC-E8-001-8 | Indexes on `content_id`, `creator_id`, `hash_value` for fast lookups | Yes -- EXPLAIN |

#### Edge Cases
- Content without a NOSTR event (draft content): provenance record can be created with `nostr_event_id: null` as placeholder
- Same content published to multiple relays: single provenance record with multiple relay confirmations in jsonb array
- Content fingerprint collision (two different texts produce same SimHash): fingerprint table allows duplicates; comparison returns multiple matches

#### Business Rules
- BR-E8-001: Provenance records are immutable after creation (no UPDATE, no DELETE). They serve as a permanent audit trail.
- BR-E8-001b: Content fingerprints are public data (hashes are non-reversible). Any user can verify a fingerprint.
- BR-E8-001c: Content alerts are private to the creator who owns the original content.

---

### US-E8-002: Content Provenance Signing Service

**Priority**: P0-CRITICAL | **PRD Source**: US-211
**Dependencies**: US-E8-001

#### User Story
As a creator, I want my content cryptographically signed at publication so I can prove original authorship.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-E8-002-1 | `ProvenanceService.signContent(contentId, creatorPubkey)` signs content with creator's NOSTR key and creates a provenance record | Yes -- unit test |
| AC-E8-002-2 | Provenance tags embedded in NOSTR events: author pubkey, timestamp, content hash (SHA-256), relay list | Yes -- verify event tags |
| AC-E8-002-3 | `GET /api/v2/shield/provenance/:contentId` returns full provenance chain: `{ contentId, creatorPubkey, signature, contentHash, timestamp, relayConfirmations[], nostrEventId }` | Yes -- API test |
| AC-E8-002-4 | Provenance certificate export: `GET /api/v2/shield/provenance/:contentId/certificate` returns JSON with all fields needed for DMCA/legal use | Yes -- API test |
| AC-E8-002-5 | Certificate includes: original content hash, creator signature, publication timestamp, relay confirmation timestamps, NOSTR event ID | Yes -- verify fields |

#### Edge Cases
- Content with no NOSTR key (creator hasn't set up NOSTR): signing fails gracefully with 400 error and clear message "NOSTR key required for content signing"
- Content already signed (duplicate signing attempt): return existing provenance record, don't create duplicate
- Relay is down during signing: provenance record created with empty relay confirmations; retried asynchronously
- Content modified after signing: hash no longer matches; verification returns "content modified since signing"
- Creator's NOSTR key is managed via browser extension (Alby, nos2x) vs manual input: both paths must work

#### Business Rules
- BR-E8-002: Provenance signing is automatic for all new content (no opt-in required)
- BR-E8-002b: Certificate export is free and unlimited (creators should never be gated from protecting their content)
- BR-E8-002c: Content hash uses SHA-256 of the normalized content body (whitespace-trimmed, lowercase for comparison)

---

### US-E8-003: Content Fingerprinting Service

**Priority**: P1-HIGH | **PRD Source**: US-212
**Dependencies**: US-E8-001

#### User Story
As a creator, I want my content fingerprinted at publication so copies can be detected across the NOSTR network.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-E8-003-1 | SimHash generated for text content at publish time; stored in `content_fingerprints` | Yes -- publish text, verify fingerprint |
| AC-E8-003-2 | pHash generated for image attachments at publish time; stored in `content_fingerprints` | Yes -- publish image, verify fingerprint |
| AC-E8-003-3 | `POST /api/v2/shield/fingerprint` allows manual fingerprint registration for existing content | Yes -- API test |
| AC-E8-003-4 | `GET /api/v2/shield/fingerprints/:creatorId` returns creator's fingerprint registry with pagination | Yes -- API test |
| AC-E8-003-5 | `POST /api/v2/shield/compare` accepts a hash and returns matches from creator's registry with similarity scores | Yes -- API test with known pairs |
| AC-E8-003-6 | Similarity scoring: exact copy (>95%), derivative (70-95%), coincidental (<70%) | Yes -- test with known pairs |
| AC-E8-003-7 | Batch fingerprinting job for existing published content (retroactive fingerprinting) | Yes -- run job, verify fingerprints created |
| AC-E8-003-8 | SimHash produces consistent results for the same text input | Yes -- hash same text twice, compare |
| AC-E8-003-9 | pHash produces consistent results for the same image input | Yes -- hash same image twice, compare |

#### Edge Cases
- Very short text (< 50 characters): SimHash may be unreliable. Flag fingerprint with `low_confidence: true`
- Image smaller than 8x8 pixels: pHash cannot be computed. Skip with warning.
- Content with both text and images: generate BOTH SimHash and pHash fingerprints
- Unicode text (emoji, CJK characters): SimHash must handle correctly
- Batch job on 10,000+ content pieces: processes in chunks with progress tracking, doesn't timeout or OOM
- Comparison API with no fingerprints in registry: returns empty array, not error

#### Business Rules
- BR-E8-003: Fingerprints are computed automatically at publish time. No creator action needed.
- BR-E8-003b: Fingerprint comparison is computationally expensive. Rate limit: 10 comparisons per creator per minute.
- BR-E8-003c: Fingerprint hashes are non-reversible. Content cannot be reconstructed from a hash.
- BR-E8-003d: Video fingerprinting is OUT OF SCOPE for Phase 7. Text and image only.

---

### US-E8-004a: NOSTR Relay Content Scanner Job

**Priority**: P1-HIGH | **PRD Source**: US-213
**Dependencies**: US-E8-003, US-E0-001 (BullMQ)

#### User Story
As a creator, I want the platform to scan NOSTR relays for copies of my content so I'm alerted when theft is detected.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-E8-004a-1 | BullMQ scheduled job connects to configurable list of NOSTR relays | Yes -- verify connections |
| AC-E8-004a-2 | Relay subscription management: connect, subscribe to text note (kind:1) and image events, handle reconnection on disconnect | Yes -- integration test |
| AC-E8-004a-3 | Content ingestion: receive events, extract text/image content, compute fingerprints | Yes -- feed test event |
| AC-E8-004a-4 | Compare incoming fingerprints against ALL creators' registered fingerprints | Yes -- test with matching content |
| AC-E8-004a-5 | Similarity scoring applied: exact copy (>95%), derivative (70-95%), coincidental (<70%) | Yes -- test with known scores |
| AC-E8-004a-6 | `content_alerts` record created when match found above configurable threshold (default: 70%) | Yes -- verify alert creation |
| AC-E8-004a-7 | Rate limiting: configurable requests-per-minute per relay (default: 60 RPM) | Yes -- verify rate limiting |
| AC-E8-004a-8 | Scanner skips events authored by the content owner (don't alert on your own reposts) | Yes -- test with self-authored event |

#### Edge Cases
- Relay connection refused: retry with exponential backoff (max 5 retries, then skip relay this cycle)
- Relay returns malformed event: skip event, log warning, continue scanning
- 10,000+ events in a scan cycle: processes in batches, doesn't overwhelm comparison engine
- Fingerprint matches content from a creator who has since deleted their account: skip, don't create orphan alert
- Same copied content detected on multiple relays: single alert with multiple relay sources, not duplicate alerts
- Scanner job overlaps with previous run: BullMQ concurrency = 1, second job queued

#### Business Rules
- BR-E8-004a: Scanner runs on a configurable schedule (default: every 6 hours)
- BR-E8-004a-b: Relay list is admin-configurable. Default: 3 popular public NOSTR relays.
- BR-E8-004a-c: Scanner only compares against creators who have opted into Content Shield (default: all creators with fingerprints)
- BR-E8-004a-d: Events authored by the same pubkey as the original content are ALWAYS excluded from alerts

---

### US-E8-004b: Alert Management API

**Priority**: P1-HIGH | **PRD Source**: US-213
**Dependencies**: US-E8-004a

#### User Story
As a creator, I want to manage content theft alerts so I can review, dismiss false positives, and take action on real copies.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-E8-004b-1 | `GET /api/v2/shield/alerts?status=new|reviewed|resolved|false_positive|reported` returns paginated alert feed | Yes -- API test |
| AC-E8-004b-2 | `PUT /api/v2/shield/alerts/:id` updates alert status with valid transitions | Yes -- API test |
| AC-E8-004b-3 | Valid status transitions: new -> reviewed, reviewed -> false_positive, reviewed -> reported, reported -> resolved, new -> false_positive | Yes -- test invalid transition |
| AC-E8-004b-4 | Alert detail includes side-by-side comparison data: original content excerpt + detected copy excerpt + similarity score | Yes -- API test |
| AC-E8-004b-5 | New alerts trigger notification in existing NotificationCenter | Yes -- verify notification |
| AC-E8-004b-6 | Alert count badge shows unread (new) alert count for Content Shield nav item | Yes -- component test |
| AC-E8-004b-7 | All endpoints scoped to authenticated creator (RLS enforced) | Yes -- cross-creator test |

#### Edge Cases
- Creator with 0 alerts: returns empty array, not error
- Creator with 500+ alerts: pagination works (default page size 20)
- Invalid status transition (e.g., new -> resolved): returns 400 with valid transition options
- Alert for content that has since been deleted by the creator: alert still accessible for record-keeping
- Concurrent status updates on the same alert: last-write-wins with optimistic locking (updated_at check)

#### Business Rules
- BR-E8-004b: Alerts are retained for 1 year, then auto-archived (not deleted)
- BR-E8-004b-b: False positive dismissals are tracked to improve future scanner accuracy
- BR-E8-004b-c: Reported alerts are locked from further status changes until DMCA process completes

---

### US-E8-004c: DMCA Report Generator

**Priority**: P1-HIGH | **PRD Source**: US-213
**Dependencies**: US-E8-004b, US-E8-002

#### User Story
As a creator, I want one-click DMCA report generation so I can protect my content with legal documentation.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-E8-004c-1 | `POST /api/v2/shield/alerts/:id/dmca-report` generates DMCA report for a specific alert | Yes -- API test |
| AC-E8-004c-2 | Report includes: original content provenance proof (creator signature, content hash, timestamp, relay confirmations) | Yes -- verify fields |
| AC-E8-004c-3 | Report includes: copy evidence (detected content URL/event ID, similarity score, comparison data) | Yes -- verify fields |
| AC-E8-004c-4 | Report includes: DMCA-required legal fields (claimant info, description of original work, description of infringing material, good faith statement, perjury statement) | Yes -- verify fields |
| AC-E8-004c-5 | Export as both JSON and PDF formats | Yes -- download both |
| AC-E8-004c-6 | Rate limit: max 10 DMCA reports per creator per day | Yes -- exceed limit |

#### Edge Cases
- Alert has no provenance record (content was published before Content Shield): report generated with available data, marked as "partial provenance"
- Content alert for NOSTR content with no URL (only event ID): report uses event ID as reference
- PDF generation fails: return 500 with retry option, don't lose the data
- Creator has not set their legal name in profile: report prompts for required claimant information before generating

#### Business Rules
- BR-E8-004c: DMCA reports are informational tools. Sovren does not file reports on behalf of creators.
- BR-E8-004c-b: Rate limiting prevents report spam / abuse
- BR-E8-004c-c: Report includes a disclaimer that Sovren is providing tools, not legal advice
- BR-E8-004c-d: Generated reports are stored and accessible to the creator for 5 years

---

### US-E8-005: Authenticity Verification Badge UI

**Priority**: P1-HIGH | **PRD Source**: US-214
**Dependencies**: US-E8-002

#### User Story
As a supporter, I want to verify that content is from the original creator so I can trust what I'm consuming.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-E8-005-1 | `AuthenticityBadge` component renders in 3 states: verified (green checkmark), unverified (gray), disputed (orange warning) | Yes -- render each state |
| AC-E8-005-2 | Badge click-through opens provenance chain viewer showing: creator pubkey, timestamp, content hash, relay confirmations, NOSTR event link | Yes -- click test |
| AC-E8-005-3 | Badge integrated into existing `FeedItem` component (visible on all content in feed) | Yes -- feed render test |
| AC-E8-005-4 | Badge integrated into content detail pages | Yes -- detail page test |
| AC-E8-005-5 | NIP-05 verification status combined with provenance display ("Verified by NOSTR identity + content provenance") | Yes -- component test |
| AC-E8-005-6 | ARIA labels: screen reader announces "Verified original content by [creator name]" or "Unverified content" or "Disputed content" | Yes -- axe test |
| AC-E8-005-7 | Badge is compact (icon-sized) in feed view, expandable to full details on click | Yes -- visual test |

#### Edge Cases
- Content published before Content Shield existed: badge shows "unverified" (no provenance data)
- Provenance record exists but content has been modified since signing: badge shows "disputed" (hash mismatch)
- NOSTR relay confirmations are empty (relays were down): badge shows "verified" with note "relay confirmations pending"
- Content from a creator who has revoked their NOSTR key: badge shows "unverified" with explanation
- User clicks badge on slow connection: loading state shown in provenance viewer

#### Business Rules
- BR-E8-005: Badge is informational only. "Unverified" does not mean "fake" -- it means provenance data is unavailable.
- BR-E8-005b: "Disputed" status requires evidence (hash mismatch or active content alert). It is not user-reportable.
- BR-E8-005c: Badge renders on all content by default. There is no option to hide it.

---

### US-E8-006: Content Shield Dashboard

**Priority**: P1-HIGH | **PRD Source**: US-211, US-212, US-213
**Dependencies**: US-E8-003, US-E8-004b

#### User Story
As a creator, I want a Content Shield dashboard to see my provenance registry, fingerprint coverage, and content alerts in one place.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-E8-006-1 | `ShieldDashboard` component renders as the main Content Shield page | Yes -- navigation test |
| AC-E8-006-2 | Provenance registry overview: total signed content, latest signatures | Yes -- component test |
| AC-E8-006-3 | `FingerprintCoverage` component: percentage of content fingerprinted, total count | Yes -- component test |
| AC-E8-006-4 | `AlertsFeed` component: recent alerts with side-by-side original vs copy comparison | Yes -- component test |
| AC-E8-006-5 | `DMCAReportButton` component: one-click report generation from alert card | Yes -- click test |
| AC-E8-006-6 | Alert resolution workflow: review -> false_positive OR report (inline on dashboard) | Yes -- interaction test |
| AC-E8-006-7 | Dashboard renders with empty data: "All clear! No alerts yet." with explanation of Content Shield | Yes -- empty state test |
| AC-E8-006-8 | Responsive and accessible | Yes -- viewport + axe tests |

#### Edge Cases
- Creator with 0 content (brand new account): dashboard shows onboarding guide for Content Shield
- Creator with 1000+ alerts: pagination and filtering work smoothly
- Alert feed loads while scanner job is running: shows current data, auto-refreshes when new alerts arrive
- Side-by-side comparison for image content: shows thumbnails, not full-size images

#### Business Rules
- BR-E8-006: Dashboard is accessible under the "Content Shield" top-level navigation item
- BR-E8-006b: Alert feed defaults to "new" alerts filter
- BR-E8-006c: Coverage stats update in near-real-time (within 1 minute of new content published)

---

### US-E8-007: Provenance Auto-Signing Integration

**Priority**: P0-CRITICAL | **PRD Source**: US-211
**Dependencies**: US-E8-002

#### User Story
As a creator, I want all my new content automatically signed with provenance so I don't have to remember to do it manually.

#### Acceptance Criteria

| # | Criterion | Testable? |
|---|-----------|-----------|
| AC-E8-007-1 | Provenance signing hooks into existing `POST /api/v1/content/publish` pipeline | Yes -- publish content, verify provenance record |
| AC-E8-007-2 | Existing content without provenance continues to work (backward compatible) | Yes -- fetch old content, verify no errors |
| AC-E8-007-3 | Provenance tags present in NOSTR events created during publish | Yes -- inspect event tags |
| AC-E8-007-4 | Signing works with browser extension key management (Alby, nos2x) | Yes -- E2E test |
| AC-E8-007-5 | Signing works with manual key input | Yes -- E2E test |
| AC-E8-007-6 | If signing fails (e.g., key unavailable), content still publishes but without provenance. Error logged, creator notified. | Yes -- test with no key |

#### Edge Cases
- Creator publishes during brief network outage: content publishes locally, provenance signing retried asynchronously
- Creator switches NOSTR keys between publishes: new provenance uses new key; old content retains old provenance
- Content published via API (not UI): auto-signing still applies
- Bulk content import: batch signing with progress indicator

#### Business Rules
- BR-E8-007: Signing failure NEVER blocks content publication. Content availability is more important than provenance.
- BR-E8-007b: Failed signings are queued for retry (max 3 retries over 24 hours)
- BR-E8-007c: Creator is notified of signing failures via in-app notification

---

### US-E8-008: Content Shield Integration Tests

**Priority**: P1-HIGH
**Dependencies**: US-E8-005, US-E8-006

#### Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-E8-008-1 | E2E: Publish content -> verify provenance badge appears on content in feed |
| AC-E8-008-2 | E2E: Click provenance badge -> verify provenance chain data displayed |
| AC-E8-008-3 | Integration: Fingerprint generated automatically on content publish |
| AC-E8-008-4 | Integration: Copy detection finds matching content (test with known fingerprint match) |
| AC-E8-008-5 | Integration: DMCA report contains correct provenance data and all required fields |
| AC-E8-008-6 | All E2E tests pass in Chromium, Firefox, and WebKit |
| AC-E8-008-7 | No regressions in existing content publish test suite |

---

### US-E8-009: Content Shield Documentation

**Priority**: P2-MEDIUM
**Dependencies**: All US-E8-* stories

#### Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-E8-009-1 | Mermaid diagram: provenance chain data flow saved to `/docs/architecture/diagrams/` |
| AC-E8-009-2 | Mermaid diagram: copy detection scanner architecture |
| AC-E8-009-3 | ADR: Content fingerprinting algorithm choices (SimHash, pHash) saved to `/docs/decisions/` |
| AC-E8-009-4 | CHANGELOG.md entry for all Content Shield features |

---

## 4. Cross-Cutting Concerns

### 4.1 Data Privacy Requirements

| Requirement | Applies To | Enforcement |
|-------------|-----------|-------------|
| Wellness data is PRIVATE to creator | All US-E7-* stories | RLS policies, API auth, no analytics aggregation of individual data |
| Pulse benchmarking uses ONLY anonymized aggregates | US-E7-007 | k-anonymity (min 10 creators), no creator IDs in response |
| Creator can delete ALL their wellness data | US-E7-001 through US-E7-007 | CASCADE DELETE + bulk delete API endpoint |
| Content alerts are PRIVATE to creator | US-E8-004b | RLS policies, API auth |
| Provenance records are PUBLIC (for verification) | US-E8-001, US-E8-002 | Public read access, write restricted to content owner |
| Content fingerprints are PUBLIC | US-E8-001, US-E8-003 | Non-reversible hashes, public read |

### 4.2 Performance Requirements

| Metric | Target | Applies To |
|--------|--------|-----------|
| Dashboard load time | < 2s (LCP) | US-E7-004, US-E8-006 |
| Risk score computation | < 500ms | US-E7-003 |
| Fingerprint generation (text) | < 100ms per content piece | US-E8-003 |
| Fingerprint generation (image) | < 500ms per image | US-E8-003 |
| Fingerprint comparison | < 200ms per comparison | US-E8-003 |
| Provenance signing | < 300ms | US-E8-002 |
| Scanner job cycle | < 30 minutes for 3 relays | US-E8-004a |
| API response time (p99) | < 500ms | All endpoints |

### 4.3 Accessibility Requirements

All new UI components MUST meet:
- WCAG 2.1 AA compliance
- Keyboard navigation for all interactive elements
- ARIA labels for all non-text content
- Screen reader announcements for dynamic content updates (burnout risk changes, new alerts)
- Color is never the ONLY indicator (always paired with text/icon)

### 4.4 Testing Requirements

| Scope | Coverage Target |
|-------|----------------|
| Backend services, repositories, scoring engine | 95%+ |
| Frontend components | 85%+ |
| Integration tests | All critical paths covered |
| E2E tests | Core user journeys in 3 browsers |

---

## 5. Success Metrics

### EPIC-007: Creator Wellness

| Metric | Target | Measurement |
|--------|--------|-------------|
| Wellness feature adoption | 60% of active creators visit dashboard within 30 days | Analytics |
| Average work hours (post-feature) | Stabilize at < 45 hrs/week for creators using boundaries | Work pattern data |
| Burnout risk distribution | < 20% of creators in "high" or "critical" | Risk score distribution |
| Rest day compliance | Creators take 2+ rest days/week | Work pattern data |
| Pulse check-in opt-in rate | 30% of active creators | Pulse submission count |

### EPIC-008: Content Shield

| Metric | Target | Measurement |
|--------|--------|-------------|
| Provenance signing coverage | 100% of new content auto-signed | Provenance record count vs content count |
| Copy detection rate | 80%+ of copies on monitored NOSTR relays | Scanner match rate |
| Alert-to-notification time | < 24 hours | Timestamp delta |
| DMCA report generation | 1-click for 100% of detected copies | Report count vs alert count |
| Badge engagement | 10% of supporters click provenance badge at least once | Click tracking |

---

## 6. Out of Scope for Phase 7

- Video fingerprinting (Phase 9+)
- Cross-platform scanning beyond NOSTR relays (Phase 9+)
- AI-powered content repurposing (Phase 8)
- Creator-to-creator collaboration (Phase 8)
- Revenue forecasting and income tools (Phase 9)
- Mental health diagnosis or therapy recommendations (NEVER)
- Sharing wellness data with third parties (NEVER)
