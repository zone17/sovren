# Phase 7: Creator Safety Net -- Definition of Done

**Epics**: EPIC-007 (Creator Wellness) + EPIC-008 (Content Shield)
**Date**: 2026-02-15
**Author**: Product Owner (Phase 7 Sprint)
**Format**: PASS / PARTIAL / FAIL per criterion per story
**Companion Document**: `docs/plans/phase7-requirements.md`

---

## Validation Instructions

For each criterion:

- **PASS**: Criterion fully met with evidence (test output, screenshot, API response, code link)
- **PARTIAL**: Criterion partially met -- document what is missing and why
- **FAIL**: Criterion not met -- document blocker or reason

A story is **DONE** when:

1. All P0 criteria are PASS
2. No P1 criteria are FAIL (PARTIAL acceptable with documented plan)
3. P2/P3 criteria can be PARTIAL with a follow-up ticket

A story is **NOT DONE** if any P0 criterion is FAIL or PARTIAL.

---

## EPIC-007: Creator Wellness System

### US-E7-001: Wellness Data Model & Migration

| #   | Criterion                                                                                                                                                                 | Priority | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `wellness_snapshots` table created with correct columns (id, creator_id, energy, motivation, stress, work_hours, created_at)                                              | P0       | PENDING |          |
| 2   | `creator_work_patterns` table created with correct columns (id, creator_id, date, content_time_mins, engagement_time_mins, management_time_mins, total_hours, created_at) | P0       | PENDING |          |
| 3   | RLS policies block cross-creator access on both tables (tested with 2 different creator IDs)                                                                              | P0       | PENDING |          |
| 4   | Supabase migration runs on clean database without errors                                                                                                                  | P0       | PENDING |          |
| 5   | Supabase migration runs on existing database without errors (idempotent)                                                                                                  | P0       | PENDING |          |
| 6   | TypeScript types exported from `packages/shared/src/types/wellness.ts` and compile without errors                                                                         | P0       | PENDING |          |
| 7   | Indexes on `creator_id` and `created_at` verified via EXPLAIN plan                                                                                                        | P1       | PENDING |          |
| 8   | FK constraint rejects creator_id not in users table                                                                                                                       | P1       | PENDING |          |
| 9   | CASCADE DELETE removes wellness data when creator account deleted                                                                                                         | P1       | PENDING |          |
| 10  | 95%+ test coverage on data access layer                                                                                                                                   | P1       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E7-002: Work Pattern Tracking API

| #   | Criterion                                                                            | Priority | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------ | -------- | ------- | -------- |
| 1   | `POST /api/v2/wellness/patterns` accepts valid payload and returns 201               | P0       | PENDING |          |
| 2   | `GET /api/v2/wellness/patterns?period=7d` returns aggregated patterns grouped by day | P0       | PENDING |          |
| 3   | `GET /api/v2/wellness/patterns?period=30d` returns correct 30-day aggregation        | P0       | PENDING |          |
| 4   | `GET /api/v2/wellness/patterns?period=90d` returns correct 90-day aggregation        | P0       | PENDING |          |
| 5   | `GET /api/v2/wellness/patterns/heatmap` returns 7x24 matrix                          | P0       | PENDING |          |
| 6   | Auto-tracking middleware captures content publish events                             | P0       | PENDING |          |
| 7   | Auto-tracking middleware captures DM send events                                     | P1       | PENDING |          |
| 8   | Auto-tracking middleware captures analytics page view events                         | P1       | PENDING |          |
| 9   | Zod validation rejects invalid payloads with 400                                     | P0       | PENDING |          |
| 10  | Rate limiting returns 429 after 100 records/hour/creator                             | P1       | PENDING |          |
| 11  | API returns only authenticated creator's data (cross-creator test)                   | P0       | PENDING |          |
| 12  | New creator with zero data: endpoints return empty structures, not errors            | P0       | PENDING |          |
| 13  | `duration_mins > 1440` rejected with validation error                                | P1       | PENDING |          |
| 14  | Period parameter invalid value returns 400                                           | P1       | PENDING |          |
| 15  | Auto-tracked events tagged with `source: 'auto'`                                     | P1       | PENDING |          |
| 16  | 95%+ test coverage on wellness routes                                                | P1       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E7-003: Burnout Risk Scoring Engine

| #   | Criterion                                                                                                                             | Priority | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `GET /api/v2/wellness/risk-score` returns correct response shape (`score`, `level`, `factors[]`, `baseline_ready`)                    | P0       | PENDING |          |
| 2   | Weights correct: work hours (0.25), posting frequency (0.20), engagement drop (0.20), hour regularity (0.15), rest day deficit (0.20) | P0       | PENDING |          |
| 3   | **Scenario A**: 40hrs/week, regular hours, 2 rest days => score ~15 (Low)                                                             | P0       | PENDING |          |
| 4   | **Scenario B**: 60hrs/week, 3x posting, stable engagement => score ~40 (Moderate)                                                     | P0       | PENDING |          |
| 5   | **Scenario C**: 70hrs/week, irregular hours, 0 rest days, engagement drop => score ~85 (Critical)                                     | P0       | PENDING |          |
| 6   | Baseline calibration: <14 days data returns `baseline_ready: false` and `score: null`                                                 | P0       | PENDING |          |
| 7   | Exactly 14 days of data: baseline computed, first score generated                                                                     | P0       | PENDING |          |
| 8   | All factors at maximum: score = 100                                                                                                   | P1       | PENDING |          |
| 9   | All factors at zero: score = 0                                                                                                        | P1       | PENDING |          |
| 10  | Zero posts in a week: posting frequency factor does not divide by zero                                                                | P0       | PENDING |          |
| 11  | Zero engagement (new creator): engagement factor = 0 contribution                                                                     | P0       | PENDING |          |
| 12  | Historical risk scores stored as weekly snapshots                                                                                     | P1       | PENDING |          |
| 13  | `PUT /api/v2/wellness/risk-score/settings` adjusts sensitivity thresholds                                                             | P2       | PENDING |          |
| 14  | Score is idempotent (same data = same score on repeated calls)                                                                        | P1       | PENDING |          |
| 15  | 95%+ test coverage on scoring engine                                                                                                  | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E7-004: Wellness Dashboard UI

| #   | Criterion                                                                  | Priority | Status  | Evidence |
| --- | -------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `WellnessDashboard` renders as new tab in CreatorDashboard                 | P0       | PENDING |          |
| 2   | `WorkPatternHeatmap` displays 7x24 grid with color intensity               | P0       | PENDING |          |
| 3   | `BurnoutRiskGauge` shows correct level with color: green/yellow/orange/red | P0       | PENDING |          |
| 4   | `RestDayTracker` shows streak, work/rest ratio, weekly count               | P0       | PENDING |          |
| 5   | `SustainablePaceIndicator` shows current vs baseline posting frequency     | P1       | PENDING |          |
| 6   | Empty data state: onboarding message for new creators, no errors           | P0       | PENDING |          |
| 7   | Baseline not ready state: progress indicator with days remaining           | P0       | PENDING |          |
| 8   | API error state: error message with retry button                           | P1       | PENDING |          |
| 9   | ARIA labels on all components                                              | P0       | PENDING |          |
| 10  | Keyboard navigation for all interactive elements                           | P0       | PENDING |          |
| 11  | Responsive: renders correctly at 320px, 768px, 1024px, 1440px              | P1       | PENDING |          |
| 12  | Screen reader announces burnout risk level in plain language               | P1       | PENDING |          |
| 13  | Time period toggle (7d/30d/90d) refreshes data without full page reload    | P1       | PENDING |          |
| 14  | Dashboard defaults to 7-day view                                           | P1       | PENDING |          |
| 15  | All components tested with React Testing Library                           | P0       | PENDING |          |
| 16  | 85%+ test coverage on dashboard components                                 | P1       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E7-005: Sustainable Scheduling Assistant

| #   | Criterion                                                                                                 | Priority | Status  | Evidence |
| --- | --------------------------------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `GET /api/v2/wellness/schedule/recommendations` returns optimal posting frequency and best times          | P0       | PENDING |          |
| 2   | `GET /api/v2/wellness/buffer-depth` returns correct days of scheduled content                             | P0       | PENDING |          |
| 3   | `SustainableScheduler` component shows recommended vs current cadence                                     | P0       | PENDING |          |
| 4   | `CreativeBuffer` component shows buffer depth with threshold alert                                        | P0       | PENDING |          |
| 5   | `BatchCreationWindows` component shows productive hours                                                   | P1       | PENDING |          |
| 6   | Alert fires when buffer drops below creator-set threshold                                                 | P1       | PENDING |          |
| 7   | Integration with existing content scheduling (US-072) verified, no regressions                            | P0       | PENDING |          |
| 8   | Creator with zero scheduled content: buffer = 0, shows call-to-action                                     | P0       | PENDING |          |
| 9   | Creator with <14 days of data: shows generic best practices, not data-driven recommendations              | P1       | PENDING |          |
| 10  | Recommendations optimize for sustainability, never recommend increasing above historical sustainable peak | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E7-006: Creator Boundaries Controls

| #   | Criterion                                                             | Priority | Status  | Evidence |
| --- | --------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `PUT /api/v2/wellness/boundaries` saves boundary configuration        | P0       | PENDING |          |
| 2   | `GET /api/v2/wellness/boundaries` returns current settings            | P0       | PENDING |          |
| 3   | `BoundarySettings` component configures all boundary options          | P0       | PENDING |          |
| 4   | `CreatorAvailabilityStatus` shows available/creating/offline          | P1       | PENDING |          |
| 5   | Focus hours silence notifications correctly                           | P0       | PENDING |          |
| 6   | Notifications queued during focus hours and delivered when focus ends | P0       | PENDING |          |
| 7   | Auto-response sends via NOSTR DM during off-hours                     | P1       | PENDING |          |
| 8   | Auto-response cooldown: max 1 per sender per 24 hours                 | P1       | PENDING |          |
| 9   | DND mode batches notifications into digest on deactivation            | P1       | PENDING |          |
| 10  | Status visible on creator's public profile (when opted in)            | P1       | PENDING |          |
| 11  | Weekly engagement budget alerts at 80% and 100%                       | P2       | PENDING |          |
| 12  | Focus hours spanning midnight handled correctly                       | P1       | PENDING |          |
| 13  | Public availability status is opt-in (default: hidden)                | P0       | PENDING |          |
| 14  | Settings persist across sessions                                      | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E7-007: Wellness Pulse Check-Ins

| #   | Criterion                                                                                                | Priority | Status  | Evidence |
| --- | -------------------------------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `POST /api/v2/wellness/pulse` accepts valid pulse data (energy, motivation, stress: 1-5) and returns 201 | P0       | PENDING |          |
| 2   | `GET /api/v2/wellness/pulse/history` returns sorted pulse history                                        | P0       | PENDING |          |
| 3   | `WellnessPulseModal` appears once per 7 days, is dismissible                                             | P0       | PENDING |          |
| 4   | `WellnessTrend` component renders line chart of scores over time                                         | P0       | PENDING |          |
| 5   | `GET /api/v2/wellness/benchmark` returns anonymous aggregates with NO individual data                    | P0       | PENDING |          |
| 6   | Benchmark returns null when <10 opted-in creators                                                        | P0       | PENDING |          |
| 7   | Pulse is opt-in only; no prompt until creator enables                                                    | P0       | PENDING |          |
| 8   | `DELETE /api/v2/wellness/pulse` deletes all pulse history                                                | P0       | PENDING |          |
| 9   | Dismissing modal permanently opts out (until re-enabled)                                                 | P1       | PENDING |          |
| 10  | Two pulses in same week: second overwrites first                                                         | P1       | PENDING |          |
| 11  | Values outside 1-5 rejected with 400                                                                     | P1       | PENDING |          |
| 12  | No medical language in UI (factual trends only)                                                          | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E7-008: Wellness Resource Library

| #   | Criterion                                                        | Priority | Status  | Evidence |
| --- | ---------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `WellnessResources` component renders categorized resource cards | P0       | PENDING |          |
| 2   | Categories: Communities, Articles, Tools, Crisis Resources       | P0       | PENDING |          |
| 3   | Each card shows title, description, category, external link      | P0       | PENDING |          |
| 4   | Filterable by category                                           | P1       | PENDING |          |
| 5   | Links open in new tab                                            | P0       | PENDING |          |
| 6   | Minimum 3 resources per category (12 total)                      | P0       | PENDING |          |
| 7   | Crisis resources always shown at top regardless of filter        | P0       | PENDING |          |
| 8   | Mobile-responsive                                                | P1       | PENDING |          |
| 9   | Accessible (ARIA, keyboard nav, heading hierarchy)               | P1       | PENDING |          |
| 10  | No click tracking on resource links                              | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E7-009: Wellness Feature Integration Tests

| #   | Criterion                                                               | Priority | Status  | Evidence |
| --- | ----------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | E2E: Navigate to wellness dashboard, data renders with seeded data      | P0       | PENDING |          |
| 2   | E2E: Set boundary controls, notifications suppressed during focus hours | P0       | PENDING |          |
| 3   | E2E: Submit wellness pulse, trend chart updates                         | P1       | PENDING |          |
| 4   | Integration: Work pattern tracking captures content publish events      | P0       | PENDING |          |
| 5   | Integration: Burnout risk score updates when patterns change            | P0       | PENDING |          |
| 6   | E2E tests pass in Chromium                                              | P0       | PENDING |          |
| 7   | E2E tests pass in Firefox                                               | P1       | PENDING |          |
| 8   | E2E tests pass in WebKit                                                | P1       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E7-010: Wellness Feature Documentation

| #   | Criterion                                              | Priority | Status  | Evidence |
| --- | ------------------------------------------------------ | -------- | ------- | -------- |
| 1   | Mermaid architecture diagram: wellness data flow       | P0       | PENDING |          |
| 2   | Mermaid component interaction diagram                  | P1       | PENDING |          |
| 3   | CHANGELOG.md entry for wellness features               | P0       | PENDING |          |
| 4   | ADR: wellness data privacy model in `/docs/decisions/` | P0       | PENDING |          |
| 5   | CLAUDE.md updated if new patterns introduced           | P1       | PENDING |          |

**Story Status**: NOT STARTED

---

## EPIC-008: Content Shield (AI Protection)

### US-E8-001: Provenance Data Model & NOSTR Event Extension

| #   | Criterion                                                                                                                                                                            | Priority | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------- | -------- |
| 1   | `provenance_records` table created with correct columns (id, content_id, nostr_event_id, signature, relay_confirmations, creator_pubkey, content_hash, created_at)                   | P0       | PENDING |          |
| 2   | `content_fingerprints` table created with correct columns (id, content_id, creator_id, hash_type, hash_value, content_type, created_at)                                              | P0       | PENDING |          |
| 3   | `content_alerts` table created with correct columns (id, creator_id, content_id, detected_copy_url, detected_event_id, confidence, similarity_score, status, created_at, updated_at) | P0       | PENDING |          |
| 4   | RLS: provenance records readable by all, writable only by content owner                                                                                                              | P0       | PENDING |          |
| 5   | RLS: content_alerts readable/writable only by creator                                                                                                                                | P0       | PENDING |          |
| 6   | RLS: content_fingerprints readable by all (public hashes), writable only by content owner                                                                                            | P0       | PENDING |          |
| 7   | NOSTR event provenance tags defined in TypeScript types                                                                                                                              | P0       | PENDING |          |
| 8   | Types exported from `packages/shared/src/types/provenance.ts`                                                                                                                        | P0       | PENDING |          |
| 9   | Migration runs on clean database                                                                                                                                                     | P0       | PENDING |          |
| 10  | Migration runs on existing database                                                                                                                                                  | P0       | PENDING |          |
| 11  | Indexes on content_id, creator_id, hash_value                                                                                                                                        | P1       | PENDING |          |
| 12  | Provenance records are immutable (no UPDATE/DELETE via RLS)                                                                                                                          | P0       | PENDING |          |
| 13  | 95%+ test coverage on data access layer                                                                                                                                              | P1       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-002: Content Provenance Signing Service

| #   | Criterion                                                                               | Priority | Status  | Evidence |
| --- | --------------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `ProvenanceService.signContent()` signs content and creates provenance record           | P0       | PENDING |          |
| 2   | Provenance tags embedded in NOSTR events (pubkey, timestamp, content hash, relay list)  | P0       | PENDING |          |
| 3   | `GET /api/v2/shield/provenance/:contentId` returns full provenance chain                | P0       | PENDING |          |
| 4   | `GET /api/v2/shield/provenance/:contentId/certificate` returns DMCA-ready JSON          | P0       | PENDING |          |
| 5   | Certificate includes: content hash, signature, timestamp, relay confirmations, event ID | P0       | PENDING |          |
| 6   | Content with no NOSTR key returns 400 with clear error message                          | P0       | PENDING |          |
| 7   | Duplicate signing returns existing record (no duplicate creation)                       | P1       | PENDING |          |
| 8   | Content hash uses SHA-256 of normalized content                                         | P1       | PENDING |          |
| 9   | Both browser extension (Alby/nos2x) and manual key input paths work                     | P1       | PENDING |          |
| 10  | 95%+ test coverage on provenance service                                                | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-003: Content Fingerprinting Service

| #   | Criterion                                                                                            | Priority | Status  | Evidence |
| --- | ---------------------------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | SimHash generated for text content at publish time                                                   | P0       | PENDING |          |
| 2   | pHash generated for image content at publish time                                                    | P0       | PENDING |          |
| 3   | `POST /api/v2/shield/fingerprint` manual registration works                                          | P0       | PENDING |          |
| 4   | `GET /api/v2/shield/fingerprints/:creatorId` returns paginated registry                              | P0       | PENDING |          |
| 5   | `POST /api/v2/shield/compare` returns matches with correct similarity scores                         | P0       | PENDING |          |
| 6   | Similarity scoring: exact copy (>95%), derivative (70-95%), coincidental (<70%) correctly classified | P0       | PENDING |          |
| 7   | Batch fingerprinting job processes existing content                                                  | P1       | PENDING |          |
| 8   | SimHash consistent: same text => same hash (tested 3x)                                               | P0       | PENDING |          |
| 9   | pHash consistent: same image => same hash (tested 3x)                                                | P0       | PENDING |          |
| 10  | Short text (<50 chars) flagged as `low_confidence`                                                   | P1       | PENDING |          |
| 11  | Image <8x8 pixels: skipped with warning                                                              | P1       | PENDING |          |
| 12  | Content with both text and images: both fingerprints generated                                       | P1       | PENDING |          |
| 13  | Unicode text (emoji, CJK) handled correctly by SimHash                                               | P1       | PENDING |          |
| 14  | Comparison rate limit: 10/min/creator, returns 429 on exceed                                         | P1       | PENDING |          |
| 15  | 95%+ test coverage on fingerprinting service                                                         | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-004a: NOSTR Relay Content Scanner Job

| #   | Criterion                                                          | Priority | Status  | Evidence |
| --- | ------------------------------------------------------------------ | -------- | ------- | -------- |
| 1   | BullMQ job connects to configurable relay list (minimum 3 relays)  | P0       | PENDING |          |
| 2   | Subscribes to text note (kind:1) events                            | P0       | PENDING |          |
| 3   | Handles relay reconnection on disconnect                           | P0       | PENDING |          |
| 4   | Computes fingerprints for incoming content                         | P0       | PENDING |          |
| 5   | Compares against all creators' registered fingerprints             | P0       | PENDING |          |
| 6   | Creates `content_alerts` when match above threshold (default: 70%) | P0       | PENDING |          |
| 7   | Rate limiting: configurable RPM per relay (default: 60)            | P1       | PENDING |          |
| 8   | Skips events authored by the content owner (no self-alerts)        | P0       | PENDING |          |
| 9   | Retry with exponential backoff on relay connection failure         | P1       | PENDING |          |
| 10  | Malformed event: skip + log warning, continue scanning             | P1       | PENDING |          |
| 11  | Same copy on multiple relays: single alert, not duplicates         | P1       | PENDING |          |
| 12  | BullMQ concurrency = 1 (no overlapping runs)                       | P1       | PENDING |          |
| 13  | Default schedule: every 6 hours                                    | P1       | PENDING |          |
| 14  | 95%+ test coverage                                                 | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-004b: Alert Management API

| #   | Criterion                                                                                                                        | Priority | Status  | Evidence |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `GET /api/v2/shield/alerts?status=new` returns paginated alerts                                                                  | P0       | PENDING |          |
| 2   | `PUT /api/v2/shield/alerts/:id` updates status                                                                                   | P0       | PENDING |          |
| 3   | Valid transitions enforced: new->reviewed, reviewed->false_positive, reviewed->reported, reported->resolved, new->false_positive | P0       | PENDING |          |
| 4   | Invalid transition returns 400                                                                                                   | P0       | PENDING |          |
| 5   | Alert detail includes side-by-side comparison data                                                                               | P0       | PENDING |          |
| 6   | New alerts trigger NotificationCenter notification                                                                               | P1       | PENDING |          |
| 7   | Alert count badge shows unread count                                                                                             | P1       | PENDING |          |
| 8   | All endpoints scoped to authenticated creator (RLS)                                                                              | P0       | PENDING |          |
| 9   | 0 alerts: returns empty array                                                                                                    | P0       | PENDING |          |
| 10  | Pagination works with 500+ alerts                                                                                                | P1       | PENDING |          |
| 11  | 95%+ test coverage                                                                                                               | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-004c: DMCA Report Generator

| #   | Criterion                                                                                         | Priority | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `POST /api/v2/shield/alerts/:id/dmca-report` generates report                                     | P0       | PENDING |          |
| 2   | Report includes provenance proof (signature, hash, timestamp, relay confirmations)                | P0       | PENDING |          |
| 3   | Report includes copy evidence (URL/event ID, similarity score, comparison)                        | P0       | PENDING |          |
| 4   | Report includes DMCA-required legal fields (claimant, description, good faith, perjury statement) | P0       | PENDING |          |
| 5   | Export as JSON format                                                                             | P0       | PENDING |          |
| 6   | Export as PDF format                                                                              | P0       | PENDING |          |
| 7   | Rate limit: max 10 reports/creator/day, returns 429 on exceed                                     | P1       | PENDING |          |
| 8   | Report for content without provenance: generated with "partial provenance" flag                   | P1       | PENDING |          |
| 9   | Report includes Sovren disclaimer (tools, not legal advice)                                       | P0       | PENDING |          |
| 10  | Generated reports stored and accessible for 5 years                                               | P2       | PENDING |          |
| 11  | 95%+ test coverage                                                                                | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-005: Authenticity Verification Badge UI

| #   | Criterion                                                                                       | Priority | Status  | Evidence |
| --- | ----------------------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `AuthenticityBadge` renders in 3 states: verified (green), unverified (gray), disputed (orange) | P0       | PENDING |          |
| 2   | Badge click-through opens provenance chain viewer                                               | P0       | PENDING |          |
| 3   | Provenance viewer shows: pubkey, timestamp, content hash, relay confirmations, event link       | P0       | PENDING |          |
| 4   | Badge integrated into `FeedItem` component                                                      | P0       | PENDING |          |
| 5   | Badge integrated into content detail pages                                                      | P0       | PENDING |          |
| 6   | NIP-05 + provenance combined verification display                                               | P1       | PENDING |          |
| 7   | ARIA labels: screen reader announces badge state with creator name                              | P0       | PENDING |          |
| 8   | Badge compact in feed view, expandable on click                                                 | P1       | PENDING |          |
| 9   | Content pre-Shield: shows "unverified" (not "fake")                                             | P0       | PENDING |          |
| 10  | Content modified since signing: shows "disputed"                                                | P1       | PENDING |          |
| 11  | Loading state in provenance viewer on slow connection                                           | P1       | PENDING |          |
| 12  | 85%+ test coverage on badge components                                                          | P1       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-006: Content Shield Dashboard

| #   | Criterion                                                               | Priority | Status  | Evidence |
| --- | ----------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | `ShieldDashboard` renders as main Content Shield page                   | P0       | PENDING |          |
| 2   | Provenance registry overview: total signed, latest signatures           | P0       | PENDING |          |
| 3   | `FingerprintCoverage` shows percentage + count of fingerprinted content | P0       | PENDING |          |
| 4   | `AlertsFeed` shows recent alerts with side-by-side comparison           | P0       | PENDING |          |
| 5   | `DMCAReportButton` triggers one-click report generation                 | P0       | PENDING |          |
| 6   | Alert resolution workflow inline (review -> false_positive OR report)   | P0       | PENDING |          |
| 7   | Empty state: "All clear!" with Content Shield explanation               | P0       | PENDING |          |
| 8   | Responsive design (mobile, tablet, desktop)                             | P1       | PENDING |          |
| 9   | Accessible (ARIA, keyboard nav)                                         | P1       | PENDING |          |
| 10  | Alert feed defaults to "new" filter                                     | P1       | PENDING |          |
| 11  | 85%+ test coverage on dashboard components                              | P1       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-007: Provenance Auto-Signing Integration

| #   | Criterion                                                                | Priority | Status  | Evidence |
| --- | ------------------------------------------------------------------------ | -------- | ------- | -------- |
| 1   | Signing hooks into existing `POST /api/v1/content/publish` pipeline      | P0       | PENDING |          |
| 2   | Existing content without provenance: no errors (backward compatible)     | P0       | PENDING |          |
| 3   | Provenance tags present in NOSTR events on publish                       | P0       | PENDING |          |
| 4   | Browser extension key management works                                   | P1       | PENDING |          |
| 5   | Manual key input works                                                   | P1       | PENDING |          |
| 6   | Signing failure: content still publishes, error logged, creator notified | P0       | PENDING |          |
| 7   | Failed signings queued for retry (max 3 over 24 hours)                   | P1       | PENDING |          |
| 8   | Content published via API (not UI): auto-signing applies                 | P1       | PENDING |          |
| 9   | 95%+ test coverage on integration hooks                                  | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-008: Content Shield Integration Tests

| #   | Criterion                                                 | Priority | Status  | Evidence |
| --- | --------------------------------------------------------- | -------- | ------- | -------- |
| 1   | E2E: Publish content -> provenance badge appears in feed  | P0       | PENDING |          |
| 2   | E2E: Click badge -> provenance chain displayed            | P0       | PENDING |          |
| 3   | Integration: Fingerprint generated on publish             | P0       | PENDING |          |
| 4   | Integration: Copy detection finds known matching content  | P0       | PENDING |          |
| 5   | Integration: DMCA report contains correct provenance data | P0       | PENDING |          |
| 6   | E2E tests pass in Chromium                                | P0       | PENDING |          |
| 7   | E2E tests pass in Firefox                                 | P1       | PENDING |          |
| 8   | E2E tests pass in WebKit                                  | P1       | PENDING |          |
| 9   | No regressions in existing content publish test suite     | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

### US-E8-009: Content Shield Documentation

| #   | Criterion                                              | Priority | Status  | Evidence |
| --- | ------------------------------------------------------ | -------- | ------- | -------- |
| 1   | Mermaid diagram: provenance chain data flow            | P0       | PENDING |          |
| 2   | Mermaid diagram: copy detection scanner architecture   | P1       | PENDING |          |
| 3   | ADR: fingerprinting algorithm choices (SimHash, pHash) | P0       | PENDING |          |
| 4   | CHANGELOG.md entry for Content Shield features         | P0       | PENDING |          |

**Story Status**: NOT STARTED

---

## Cross-Epic Quality Gates

These gates must ALL PASS before Phase 7 is considered complete:

| #     | Gate                                                                           | Status  | Evidence |
| ----- | ------------------------------------------------------------------------------ | ------- | -------- |
| G-001 | All P0 criteria across both epics are PASS                                     | PENDING |          |
| G-002 | No P1 criteria are FAIL (PARTIAL acceptable with follow-up ticket)             | PENDING |          |
| G-003 | Wellness data privacy: RLS tests confirm no cross-creator leakage              | PENDING |          |
| G-004 | Content Shield backward compatibility: existing content unaffected             | PENDING |          |
| G-005 | Performance: dashboard LCP < 2s, API p99 < 500ms                               | PENDING |          |
| G-006 | Accessibility: axe-core returns 0 critical/serious violations on all new pages | PENDING |          |
| G-007 | Test coverage: backend services 95%+, frontend components 85%+                 | PENDING |          |
| G-008 | No new ESLint errors introduced                                                | PENDING |          |
| G-009 | All Mermaid diagrams render correctly on GitHub                                | PENDING |          |
| G-010 | CHANGELOG.md entries for both epics                                            | PENDING |          |
| G-011 | ADRs written for wellness privacy model and fingerprinting algorithms          | PENDING |          |
| G-012 | Feature branch passes CI/CD pipeline (lint, test, build)                       | PENDING |          |

---

## Summary Statistics

| Metric       | EPIC-007 | EPIC-008            | Total |
| ------------ | -------- | ------------------- | ----- |
| Stories      | 10       | 11 (incl. 004a/b/c) | 21    |
| DoD Criteria | 118      | 119                 | 237   |
| P0 Criteria  | 58       | 64                  | 122   |
| P1 Criteria  | 49       | 45                  | 94    |
| P2+ Criteria | 11       | 10                  | 21    |
| PASS         | 0        | 0                   | 0     |
| PARTIAL      | 0        | 0                   | 0     |
| FAIL         | 0        | 0                   | 0     |
| PENDING      | 118      | 119                 | 237   |
