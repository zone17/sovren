# Phase 1 Epics: Product Requirements & Definition of Done

**Date**: 2026-02-16
**Author**: Product Owner Agent
**Source PRD**: SOVREN_PRD_V2_CREATOR_EMPOWERMENT.md
**Epic Decomposition**: docs/plans/PRD_V2_EPIC_DECOMPOSITION.md
**Status**: Requirements Complete

---

## Table of Contents

1. [EPIC-007: Creator Wellness System](#epic-007-creator-wellness-system)
2. [EPIC-008: Content Shield / AI Protection](#epic-008-content-shield--ai-protection)
3. [EPIC-009: Multi-Platform Hub](#epic-009-multi-platform-hub)
4. [Cross-Cutting Requirements](#cross-cutting-requirements)
5. [Success Metrics](#success-metrics)

---

## EPIC-007: Creator Wellness System

**PRD Domain**: Domain 1 - Creator Wellness
**Team-Builder Tier**: standard
**Stories**: 10 (US-E7-001 through US-E7-010)
**Dependencies**: None (builds on existing analytics infrastructure)
**Estimated Duration**: 1 week

### Business Context

79-90% of creators experience burnout. Two-thirds report anxiety or depression (3x the national average). Only 4% of 8+ year creators describe mental health as "excellent." Sovren addresses this by giving creators visibility into their work patterns and tools to set sustainable boundaries.

### Privacy Rules (MANDATORY)

- **PR-001**: All wellness data (pulse check-ins, work patterns, burnout scores) is PRIVATE to the creator
- **PR-002**: Wellness data is NEVER shared with other users, used for platform metrics, sold to third parties, or used for advertising
- **PR-003**: Creator can delete ALL wellness data at any time (hard delete, not soft delete)
- **PR-004**: Anonymous benchmarking uses only k-anonymized aggregates (minimum group size: 10 creators) — no individual data ever leaves the creator's scope
- **PR-005**: Wellness features are opt-in only; no nagging, no dark patterns to increase engagement
- **PR-006**: RLS policies enforce that creators can only read/write their own wellness data — cross-creator access is blocked at the database level

### Existing Code Foundation

- Backend: `packages/backend/src/services/wellness/` — WellnessService, BurnoutScoringService, BoundaryService, ScheduleService (all with tests)
- Frontend: `packages/frontend/src/features/wellness/` — WellnessDashboard, BurnoutRiskGauge, WorkPatternHeatmap, BoundarySettings, SustainableScheduler, WellnessPulseModal, RestDayTracker, WellnessResources, WellnessTrend (with hooks and API layer)
- Shared types: No existing wellness types in shared package (needs creation)

---

### US-E7-001: Wellness Data Model & Migration

**Priority**: P0-CRITICAL | **PRD Story**: Foundation for US-201 through US-204

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `wellness_snapshots` table created with columns: id, creator_id, energy (1-5), motivation (1-5), stress (1-5), work_hours (decimal), created_at (timestamptz) | Migration runs without errors on clean and existing databases |
| AC-2 | `creator_work_patterns` table created with columns: id, creator_id, date, content_time_mins (int), engagement_time_mins (int), management_time_mins (int), total_hours (decimal), created_at | Migration runs without errors |
| AC-3 | RLS policies enforce creator_id = auth.uid() for both tables — creators can ONLY read/write their own data | Test: Creator A cannot read Creator B's wellness data |
| AC-4 | TypeScript types exported from `packages/shared/src/types/wellness.ts` | Import compiles without errors in both frontend and backend |
| AC-5 | Indexes on creator_id and created_at for both tables | Query performance acceptable for 90-day lookback queries |

#### Edge Cases

- EC-1: Migration on database with existing data — ensure no data loss and backward compatibility
- EC-2: Creator deletes account — wellness data must cascade delete (GDPR compliance)
- EC-3: Null/missing fields — energy, motivation, stress should have CHECK constraints (1-5 range)
- EC-4: Concurrent writes — creator submits two pulse check-ins simultaneously

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Migration runs without errors on clean DB | |
| Migration runs without errors on existing DB with data | |
| RLS policies tested (cross-creator access blocked) | |
| Types exported from shared package and importable | |
| Cascade delete tested on creator account deletion | |
| CHECK constraints validated (1-5 range for wellness scores) | |
| 95%+ test coverage on data access layer | |

---

### US-E7-002: Work Pattern Tracking API

**Priority**: P0-CRITICAL | **PRD Story**: Foundation for US-201

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `POST /api/v2/wellness/patterns` records work activity with type (content/engagement/management), duration_mins, and timestamp | Returns 201 with created pattern record |
| AC-2 | `GET /api/v2/wellness/patterns?period=7d\|30d\|90d` returns aggregated work patterns for the specified period | Response includes daily/weekly totals by activity type |
| AC-3 | `GET /api/v2/wellness/patterns/heatmap` returns hourly heatmap data (24 hours x 7 days matrix) | Each cell contains total minutes of tracked activity |
| AC-4 | Auto-tracking middleware logs content publish, DM sends, analytics page views as implicit work events | Events captured without user manually recording them |
| AC-5 | Zod validation schemas reject invalid payloads (negative durations, future timestamps > 1 hour, missing required fields) | 400 response with descriptive error message |
| AC-6 | Rate limiting: max 100 pattern records per creator per hour | 429 response when limit exceeded |

#### Edge Cases

- EC-1: Period with no data — return empty arrays, not errors
- EC-2: Timezone handling — all timestamps stored as UTC, client converts for display
- EC-3: Very long work sessions (>8 hours single record) — accept but flag for potential data quality issue
- EC-4: Auto-tracking during DND mode — still track (DND controls notifications, not analytics)
- EC-5: Rate limit race condition — two concurrent requests at limit boundary

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| All 3 endpoints return correct data shapes | |
| Auto-tracking captures content publish and DM events | |
| Zod validation rejects invalid payloads with descriptive errors | |
| Rate limiting enforced per creator | |
| Empty period returns empty arrays (not 404 or error) | |
| 95%+ test coverage on wellness routes | |

---

### US-E7-003: Burnout Risk Scoring Engine

**Priority**: P1-HIGH | **PRD Story**: US-201

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `GET /api/v2/wellness/risk-score` returns current burnout risk level (low/moderate/high/critical) with numeric score (0-100) | Response includes level, score, and per-factor breakdown |
| AC-2 | Scoring uses 5 weighted factors: work hours trend (0.25), posting frequency spike (0.20), engagement drop (0.20), hour regularity (0.15), rest day deficit (0.20) | Unit tests verify each factor's contribution |
| AC-3 | Thresholds: Low (0-25), Moderate (26-50), High (51-75), Critical (76-100) | All threshold boundaries produce correct classification |
| AC-4 | Baseline calibration: first 14 days of data establish personal baseline; no risk assessment before baseline is established | API returns `calibrating: true` with days remaining |
| AC-5 | Historical risk score snapshots stored weekly | Weekly snapshot job creates records |
| AC-6 | Creator can adjust sensitivity thresholds via `PUT /api/v2/wellness/risk-score/sensitivity` | Custom thresholds override defaults for that creator |

#### Algorithm Test Scenarios

| Scenario | Inputs | Expected Score | Expected Level |
|----------|--------|---------------|----------------|
| A: Healthy creator | 40 hrs/week, regular hours, 2 rest days, stable posting, stable engagement | ~15 | Low |
| B: Moderate risk | 60 hrs/week, 3x normal posting, stable engagement, regular hours, 1 rest day | ~40 | Moderate |
| C: Critical risk | 70 hrs/week, irregular hours, 0 rest days, engagement dropping 40%, posting 2x normal | ~85 | Critical |
| D: Calibrating | Only 7 days of data | N/A | Calibrating (no score) |
| E: Improving | Previously high, now decreasing hours and regular schedule | Decreasing trend | Low or Moderate |

#### Edge Cases

- EC-1: Creator with < 14 days of data — return calibrating status, never a misleading score
- EC-2: Creator who only posts sporadically (1-2 times/month) — baseline adapts to low-frequency creators
- EC-3: Creator takes 2-week vacation — don't spike burnout score from sudden zero activity
- EC-4: All factor values exactly at threshold boundaries — ensure deterministic classification
- EC-5: Creator with no engagement data (no followers yet) — skip engagement drop factor, reweight remaining factors

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Risk score algorithm produces correct results for all 5 test scenarios | |
| Baseline calibration period handled (no alerts before 14 days of data) | |
| Per-factor breakdown included in API response | |
| Sensitivity customization persists and applies correctly | |
| Unit tests cover all scoring edge cases with known inputs/outputs | |
| Weekly snapshot job creates historical records | |
| 95%+ test coverage on scoring engine | |

---

### US-E7-004: Wellness Dashboard UI

**Priority**: P1-HIGH | **PRD Story**: US-201

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `WellnessDashboard` component renders as a tab in existing CreatorDashboard | Tab visible and navigable |
| AC-2 | `WorkPatternHeatmap` displays 24h x 7d grid with color intensity based on tracked hours | Renders correctly with real data and empty state |
| AC-3 | `BurnoutRiskGauge` shows visual indicator: green (low), yellow (moderate), orange (high), red (critical) | Color and label match score level |
| AC-4 | `RestDayTracker` shows rest day streak count and work/rest ratio | Accurate calculation from pattern data |
| AC-5 | `SustainablePaceIndicator` compares current posting frequency to personal sustainable baseline | Shows clear delta (above/at/below sustainable pace) |
| AC-6 | All components handle empty data state gracefully (first-time user with no data) | Empty states show onboarding guidance, not errors |
| AC-7 | Responsive design: dashboard usable on mobile (320px+), tablet (768px+), desktop (1024px+) | Visual inspection at all breakpoints |
| AC-8 | Accessible: ARIA labels on all interactive elements, keyboard navigable, screen reader compatible | Lighthouse accessibility score >= 90 |

#### Edge Cases

- EC-1: Creator with no data (brand new) — show welcome/onboarding state explaining what will appear
- EC-2: Creator in calibration period (< 14 days) — show progress bar toward baseline completion
- EC-3: Large date ranges (90 days of heatmap data) — performance acceptable (< 2s render)
- EC-4: Data loading error — show error state with retry button, not blank screen

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Dashboard renders with real and empty data states | |
| All 5 sub-components render correctly | |
| All components tested with React Testing Library | |
| Accessible (ARIA labels, keyboard navigable) | |
| Integrates as tab in existing CreatorDashboard | |
| Responsive at mobile, tablet, and desktop breakpoints | |
| Error and loading states handled gracefully | |
| 85%+ test coverage on dashboard components | |

---

### US-E7-005: Sustainable Scheduling Assistant

**Priority**: P1-HIGH | **PRD Story**: US-202

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `GET /api/v2/wellness/schedule/recommendations` returns optimal posting frequency and best posting times based on creator's history | Response includes recommended cadence, best times, and confidence level |
| AC-2 | `GET /api/v2/wellness/buffer-depth` returns count of scheduled future content with days-ahead coverage | Accurate count from existing scheduling system |
| AC-3 | `SustainableScheduler` component shows recommended cadence vs current cadence with visual delta | Clear indication of over/under/at-pace |
| AC-4 | `CreativeBuffer` component visualizes content buffer depth with configurable threshold alert | Alert fires when buffer drops below threshold |
| AC-5 | `BatchCreationWindows` suggests productive hours based on creator's historical high-output times | Suggestions based on actual pattern data |
| AC-6 | Alert when content buffer drops below creator-set threshold | Notification delivered via existing notification system |
| AC-7 | Integrates with existing content scheduling (US-072) infrastructure without breaking it | All existing scheduling tests pass |

#### Edge Cases

- EC-1: Creator with no publishing history — recommend industry defaults, note low confidence
- EC-2: Creator with irregular schedule (no clear pattern) — explain that no strong pattern detected, suggest experimenting
- EC-3: Buffer depth calculation when scheduled content has mixed states (draft, scheduled, published) — only count "scheduled" status
- EC-4: Timezone changes — batch creation windows adjust to creator's current timezone

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Recommendations based on actual creator performance data | |
| Buffer depth accurately counts scheduled future content | |
| Integrates with existing scheduling without breaking it | |
| All existing scheduling tests continue to pass | |
| Productive hour suggestions based on real pattern data | |
| Buffer threshold alert triggers correctly | |
| 85%+ test coverage on scheduling components | |

---

### US-E7-006: Creator Boundaries Controls

**Priority**: P1-HIGH | **PRD Story**: US-203

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `PUT /api/v2/wellness/boundaries` saves boundary configuration (focus hours, DND, engagement budget) | Config persists across sessions |
| AC-2 | `GET /api/v2/wellness/boundaries` retrieves current boundary settings | Returns complete config or defaults |
| AC-3 | `BoundarySettings` component allows configuring focus hours (start/end time per day), weekly engagement budget (hours), DND mode (on/off) | All controls save and load correctly |
| AC-4 | `CreatorAvailabilityStatus` shows public-facing status (available/creating/offline) on creator profile | Status visible to other users |
| AC-5 | Auto-response template editor allows creating templates for off-hours DMs | Templates persist and can be edited/deleted |
| AC-6 | During focus hours: notifications silenced, auto-responses sent via NOSTR DM system | Notifications suppressed and auto-responses delivered |
| AC-7 | DND mode batches notifications for later delivery when DND is turned off | Batched notifications appear in chronological order |
| AC-8 | Extends existing NotificationSettings with boundary integration | Existing notification settings unaffected |

#### Edge Cases

- EC-1: Focus hours span midnight (e.g., 10 PM to 6 AM) — handle cross-day boundary correctly
- EC-2: Creator in multiple timezones (traveling) — focus hours based on configured timezone, not system timezone
- EC-3: DND mode active when urgent payment notification arrives — payment notifications bypass DND (configurable)
- EC-4: Auto-response to a bot/automated message — detect and skip auto-response to prevent loops
- EC-5: Engagement budget reached mid-conversation — warn but don't cut off active conversation

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Focus hours silence notifications correctly | |
| Auto-responses sent via existing NOSTR DM system | |
| Status visible on creator's public profile | |
| DND batches and delivers notifications on resume | |
| Extends NotificationSettings without breaking existing settings | |
| Cross-midnight focus hours handled correctly | |
| 85%+ test coverage on boundary components | |
| 95%+ test coverage on boundary service | |

---

### US-E7-007: Wellness Pulse Check-Ins

**Priority**: P2-MEDIUM | **PRD Story**: US-204

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `POST /api/v2/wellness/pulse` records pulse check-in with energy (1-5), motivation (1-5), stress (1-5) | Returns 201 with created record |
| AC-2 | `GET /api/v2/wellness/pulse/history` returns pulse history with date range support | Correct data returned for specified period |
| AC-3 | `WellnessPulseModal` appears weekly as a gentle, dismissible prompt | Modal dismissible; never appears more than once per week |
| AC-4 | `WellnessTrend` renders line chart of pulse scores over time | Chart renders with real data and empty state |
| AC-5 | `GET /api/v2/wellness/benchmark` returns anonymous aggregates (no individual data exposed) | Response contains only statistical aggregates |
| AC-6 | Opt-in only: pulse check-ins never appear until creator explicitly enables them | Default is disabled; enable via settings |
| AC-7 | Creator can delete all pulse data at any time | Hard delete removes all records; UI confirms data is gone |

#### Edge Cases

- EC-1: Creator opts out after collecting data — all existing pulse data deleted immediately (not just future collection stopped)
- EC-2: Benchmarking with < 10 creators in cohort — return "insufficient data" instead of potentially identifying aggregate
- EC-3: Creator submits pulse twice in one day — accept most recent, replace previous (not duplicate)
- EC-4: Pulse modal appearance during DND mode — respect DND, defer to next non-DND session

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Pulse data never leaves creator's own records | |
| Benchmarking uses only anonymized aggregates (k >= 10) | |
| Check-in prompt respects opt-out permanently | |
| Opt-out deletes existing data (hard delete) | |
| Weekly prompt never nags (max 1x per 7 days, dismissible) | |
| 85%+ test coverage on pulse components | |
| 95%+ test coverage on pulse API | |

---

### US-E7-008: Wellness Resource Library

**Priority**: P3-LOW | **PRD Story**: US-204

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `WellnessResources` component displays categorized resource cards | Resources render with title, description, category, and link |
| AC-2 | Categories: communities, articles, tools, crisis resources | Filter by category works correctly |
| AC-3 | Initial curated resources include at least 5 entries per category | 20+ resources total |
| AC-4 | Links open in new tab (external resources, not hosted on Sovren) | `target="_blank"` with `rel="noopener noreferrer"` |
| AC-5 | Crisis resources (hotlines, immediate help) prominently displayed | Crisis section always visible, not filterable away |

#### Edge Cases

- EC-1: External resource link becomes broken — no link validation needed for MVP, but UI handles 404 gracefully
- EC-2: Mobile layout — resource cards stack vertically on mobile

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Resources render with correct links | |
| Accessible and mobile-responsive | |
| Crisis resources always visible | |
| External links open in new tab with security attrs | |
| 85%+ test coverage on resource components | |

---

### US-E7-009: Wellness Feature Integration Tests

**Priority**: P1-HIGH

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | E2E test: Navigate to wellness dashboard, verify data renders | Playwright test passes in Chromium |
| AC-2 | E2E test: Set boundary controls, verify notifications suppressed during focus hours | Playwright test passes |
| AC-3 | E2E test: Submit wellness pulse, verify trend chart updates | Playwright test passes |
| AC-4 | Integration test: Work pattern tracking captures content publish events | Backend integration test passes |
| AC-5 | Integration test: Burnout risk score updates when patterns change | Backend integration test passes |

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| All E2E tests pass in Chromium | |
| All integration tests pass | |
| No regressions in existing test suite | |

---

### US-E7-010: Wellness Feature Documentation

**Priority**: P2-MEDIUM

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | Mermaid architecture diagram for wellness data flow | Renders in GitHub markdown |
| AC-2 | Mermaid component interaction diagram | Renders in GitHub markdown |
| AC-3 | CHANGELOG.md entry for wellness feature | Follows conventional commit format |
| AC-4 | ADR for wellness data privacy model | Documents privacy rules PR-001 through PR-006 |

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| All Mermaid diagrams render correctly in GitHub | |
| CHANGELOG entry follows conventional commit format | |
| ADR documents privacy model with rationale | |

---

## EPIC-008: Content Shield / AI Protection

**PRD Domain**: Domain 2 - Content Shield
**Team-Builder Tier**: standard
**Stories**: 11 (US-E8-001 through US-E8-009, with US-E8-004 split into 3: 004a, 004b, 004c)
**Dependencies**: None (builds on existing NOSTR infrastructure)
**Estimated Duration**: 1.5 weeks

### Business Context

AI clipper accounts outperform original creators. Consumer skepticism about content authenticity doubled from 18% to 32%. Platforms are implementing AI content restrictions. Sovren provides cryptographic proof of original authorship using NOSTR's native signing capabilities, plus perceptual fingerprinting to detect unauthorized copies across the relay network.

### Security Rules (MANDATORY)

- **SR-001**: Content fingerprints (perceptual hashes) are non-reversible — original content cannot be reconstructed from hashes
- **SR-002**: Content fingerprints are public (published to NOSTR for open verification by anyone)
- **SR-003**: Provenance signing uses creator's own NOSTR private key — Sovren never stores or has access to private keys
- **SR-004**: DMCA reports contain cryptographic proof but no sensitive personal data beyond what the creator explicitly includes
- **SR-005**: Alert data (detected copies) follows RLS — creators only see alerts for their own content
- **SR-006**: Relay scanner rate-limits requests to prevent relay bans and respect relay operators

### Existing Code Foundation

- Backend: `packages/backend/src/services/provenance/` — ProvenanceService, FingerprintService, AlertService, DmcaService (with partial tests)
- Frontend: `packages/frontend/src/features/content-shield/` — AuthenticityBadge, ShieldDashboard, AlertsFeed, DMCAReportButton, FingerprintCoverage, ProvenanceChainViewer (with hooks and API layer)
- Shared types: `packages/shared/src/types/provenance.ts` exists

---

### US-E8-001: Provenance Data Model & NOSTR Event Extension

**Priority**: P0-CRITICAL | **PRD Story**: Foundation for US-211 through US-214

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `provenance_records` table with columns: id, content_id, nostr_event_id, signature, relay_confirmations (jsonb), created_at | Migration runs on clean and existing DBs |
| AC-2 | `content_fingerprints` table with columns: id, content_id, hash_type (simhash/phash), hash_value, created_at | Migration runs without errors |
| AC-3 | `content_alerts` table with columns: id, creator_id, content_id, detected_copy_url, detected_event_id, confidence (decimal), similarity_score (decimal), status (new/reviewed/false_positive/reported/resolved), created_at | Migration runs without errors |
| AC-4 | NOSTR event tag extension for provenance: `["provenance", "<content_hash>", "<timestamp>", "<relay_list>"]` tag added to published events | Tag conforms to NIP standards |
| AC-5 | RLS policies: provenance_records readable by anyone (public verification), writable only by content creator; content_alerts scoped to creator_id | Cross-creator access blocked for alerts |
| AC-6 | TypeScript types in `packages/shared/src/types/provenance.ts` updated/extended | Types importable in both frontend and backend |

#### Edge Cases

- EC-1: Content published before Content Shield was active — no provenance record exists, but content should still display as "unverified" (not "disputed")
- EC-2: Multiple fingerprints for same content (text + image attachment) — support multiple fingerprints per content_id
- EC-3: NOSTR event with provenance tag rejected by some relays — store partial relay confirmations

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Migration runs without errors on clean and existing databases | |
| RLS policies tested (public read for provenance, creator-only for alerts) | |
| Types exported from shared package and importable | |
| Provenance tag format NIP-compliant | |
| 95%+ test coverage on data access layer | |

---

### US-E8-002: Content Provenance Signing Service

**Priority**: P0-CRITICAL | **PRD Story**: US-211

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `ProvenanceService.sign(content, creatorKey)` signs content hash with creator's NOSTR key and returns signed provenance record | Signature verifiable using creator's public key |
| AC-2 | Provenance tags embedded in NOSTR events: author pubkey, timestamp, content hash (SHA-256), relay list | Tags present in published event |
| AC-3 | `GET /api/v2/shield/provenance/:contentId` returns full provenance chain (author, timestamp, content hash, signature, relay confirmations) | Complete chain returned with all fields |
| AC-4 | Provenance certificate export in JSON format containing all fields needed for DMCA/legal use | Export includes: author pubkey, NIP-05 identity, content hash, signature, timestamps, relay list |
| AC-5 | Service hooks into content publish pipeline (auto-sign all new content without user action) | New published content automatically has provenance record |

#### Edge Cases

- EC-1: Creator's NOSTR key unavailable (browser extension not loaded) — queue signing for when key becomes available; mark content as "provenance pending"
- EC-2: Content edited after initial signing — create new provenance record with "supersedes" link to original
- EC-3: Relay connection failure during publish — still create provenance record locally; retry relay confirmation async
- EC-4: Very large content (>64KB) — hash the content, sign the hash (not the full content)
- EC-5: Content with binary attachments — hash text and binary parts separately, include both in provenance

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Content signed with creator's NOSTR key and provenance record created | |
| Provenance chain retrievable via API with correct data | |
| Certificate export contains all required fields for DMCA use | |
| Auto-signing works for new content without user intervention | |
| Edited content creates new provenance record with supersedes link | |
| 95%+ test coverage on provenance service | |

---

### US-E8-003: Content Fingerprinting Service

**Priority**: P1-HIGH | **PRD Story**: US-212

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | SimHash fingerprint generated for text content at publish time | Consistent hash for same text; similar hash for similar text |
| AC-2 | pHash fingerprint generated for image attachments at publish time | Consistent hash for same image; similar hash for resized/cropped versions |
| AC-3 | `POST /api/v2/shield/fingerprint` allows manual fingerprint registration (for pre-existing content) | Returns 201 with generated fingerprint record |
| AC-4 | `GET /api/v2/shield/fingerprints/:creatorId` returns creator's fingerprint registry with pagination | Paginated list with hash_type, content_id, created_at |
| AC-5 | `POST /api/v2/shield/compare` compares a hash against creator's registry and returns similarity scores | Returns array of matches sorted by similarity score |
| AC-6 | Batch fingerprinting job processes existing published content that lacks fingerprints | BullMQ job processes backlog without blocking normal operations |

#### Edge Cases

- EC-1: Very short text (< 50 characters) — generate fingerprint but flag as "low confidence" (short text produces unreliable SimHash)
- EC-2: Image formats not supported by pHash library — return unsupported format error, not silent failure
- EC-3: Content with no text and no images (e.g., metadata-only) — skip fingerprinting, not error
- EC-4: Hash collision — two different pieces of content produce same fingerprint (theoretically possible but rare; handle gracefully in comparison)
- EC-5: Batch job processes 10,000+ existing content pieces — chunked processing with progress tracking

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| SimHash generated for text content with consistent results | |
| pHash generated for image content with consistent results | |
| Comparison API returns correct similarity scores for known test pairs | |
| Batch job fingerprints existing content without errors | |
| Short text flagged as low-confidence fingerprint | |
| Unsupported image formats handled with clear error | |
| 95%+ test coverage on fingerprinting service | |

---

### US-E8-004a: NOSTR Relay Content Scanner Job

**Priority**: P1-HIGH | **PRD Story**: US-213

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | BullMQ scheduled job connects to configurable list of NOSTR relays (minimum 3 default relays) | Job runs on schedule and connects to relays |
| AC-2 | Relay subscription filters for text (kind 1) and image events; manages reconnection on disconnect | Automatic reconnection within 30 seconds |
| AC-3 | Content ingestion pipeline: receive events, extract text/image content, compute fingerprints | Fingerprints generated for incoming events |
| AC-4 | Comparison engine: compare incoming fingerprints against all registered creator fingerprints | Matches found for known test pairs |
| AC-5 | Similarity scoring: exact copy (>95%), derivative (70-95%), coincidental (<70%) | Correct classification for test data |
| AC-6 | `content_alerts` created when match found above configurable threshold (default: 70%) | Alert record created with correct metadata |
| AC-7 | Rate limiting: configurable requests-per-minute per relay (default: 30/min) | No relay bans during normal operation |

#### Edge Cases

- EC-1: Relay goes offline permanently — mark relay as unhealthy, skip in future scans, alert admin
- EC-2: Scanner finds creator's own cross-posted content — exclude creator's own pubkey from scan results
- EC-3: Very high volume relay (1000+ events/minute) — sample events rather than process all
- EC-4: Scanner job crashes mid-scan — resume from last checkpoint on restart
- EC-5: Multiple creators register similar fingerprints — alert routes to correct creator based on fingerprint ownership

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Scanner job runs on schedule and connects to at least 3 relays | |
| Fingerprint comparison returns correct similarity scores | |
| Alerts created for matches above threshold | |
| Rate limiting prevents relay bans | |
| Creator's own content excluded from scan results | |
| 95%+ test coverage on scanner job | |

---

### US-E8-004b: Alert Management API

**Priority**: P1-HIGH | **PRD Story**: US-213

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `GET /api/v2/shield/alerts?status=new\|reviewed\|resolved` returns paginated creator alerts | Correct RLS filtering — only creator's own alerts |
| AC-2 | `PUT /api/v2/shield/alerts/:id` updates alert status with valid transitions | Status transitions: new -> reviewed -> resolved/false_positive/reported |
| AC-3 | Alert detail includes side-by-side comparison data (original content hash, detected copy, similarity score, detected URL) | Complete comparison data in response |
| AC-4 | Integration with NotificationCenter for real-time new-alert notifications | Push notification delivered when scanner finds match |
| AC-5 | Alert count badge on Content Shield navigation item | Badge shows count of "new" status alerts |

#### Edge Cases

- EC-1: Invalid status transition (e.g., resolved -> new) — reject with 400 and valid transition message
- EC-2: Alert for content that has been deleted by creator — alert still visible but marked as "source deleted"
- EC-3: Hundreds of alerts from a mass-copy event — pagination handles large result sets efficiently
- EC-4: Concurrent status updates on same alert — last-write-wins with optimistic concurrency

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Alert CRUD operations work with correct RLS | |
| NotificationCenter shows new alerts in real-time | |
| Alert status transitions validated (no invalid transitions) | |
| Side-by-side comparison data complete and accurate | |
| 95%+ test coverage on alert management | |

---

### US-E8-004c: DMCA Report Generator

**Priority**: P1-HIGH | **PRD Story**: US-213

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | DMCA report template includes all legally required fields: creator identity, original work description, infringing work location, statement of good faith, signature | Template complete per DMCA requirements |
| AC-2 | Report populated with provenance proof: creator's NOSTR signature, original publication timestamp, relay confirmations | Cryptographic evidence included |
| AC-3 | Copy evidence included: detected content URL, similarity score, comparison screenshot or data | Evidence sufficient for legal action |
| AC-4 | `POST /api/v2/shield/alerts/:id/dmca-report` generates report from alert | Returns generated report in requested format |
| AC-5 | Export as JSON (machine-readable) and PDF (human-readable) | Both formats contain identical data |
| AC-6 | Rate limit: max 10 DMCA reports per creator per day | 429 response when limit exceeded |

#### Edge Cases

- EC-1: Alert has been marked as false_positive — prevent DMCA report generation, require status change first
- EC-2: Creator identity fields incomplete (no NIP-05) — generate report but warn about missing identity verification
- EC-3: Detected content URL is no longer accessible — include in report with "archived" note
- EC-4: PDF generation library failure — return JSON format as fallback with error message about PDF

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| DMCA report contains all legally required provenance data | |
| Report exportable as PDF and JSON | |
| Rate limiting prevents report spam | |
| False-positive alerts cannot generate DMCA reports | |
| 95%+ test coverage on report generator | |

---

### US-E8-005: Authenticity Verification Badge UI

**Priority**: P1-HIGH | **PRD Story**: US-214

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `AuthenticityBadge` renders in 3 states: verified original (green checkmark), unverified (gray), disputed (orange warning) | All 3 states visually distinct |
| AC-2 | Badge click-through opens provenance chain viewer with cryptographic proof | Chain shows author, timestamp, content hash, relay confirmations |
| AC-3 | Badge integrated into existing `FeedItem` component | Badge appears on all feed items |
| AC-4 | Badge integrated into content detail pages | Badge appears prominently on detail view |
| AC-5 | NIP-05 verification status combined with provenance display | Shows both NIP-05 identity and provenance status |
| AC-6 | Accessible: ARIA labels, screen reader announces verification status, keyboard focusable | Accessibility audit passes |

#### Edge Cases

- EC-1: Content from before Content Shield — display as "unverified" (not disputed)
- EC-2: Content with expired NIP-05 but valid provenance — show provenance as verified, NIP-05 as expired
- EC-3: Badge in compact view (feed item) vs expanded view (detail page) — different sizes but same semantics
- EC-4: Content by user not on Sovren (from NOSTR relay) — show as "external, unverified"

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Badge renders in all 3 states (verified/unverified/disputed) | |
| Click-through displays correct provenance chain data | |
| Badge integrates into FeedItem and content detail pages | |
| Accessible (ARIA labels, screen reader friendly) | |
| Pre-Content Shield content shows as "unverified" (not disputed) | |
| 85%+ test coverage on badge components | |

---

### US-E8-006: Content Shield Dashboard

**Priority**: P1-HIGH

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `ShieldDashboard` shows provenance registry overview: total signed content, unsigned content, coverage percentage | Accurate counts from database |
| AC-2 | `AlertsFeed` displays detected copies with side-by-side comparison (original vs copy) | Comparison shows key metadata (timestamps, similarity) |
| AC-3 | `DMCAReportButton` triggers one-click report generation from alert | Report generated and available for download |
| AC-4 | `FingerprintCoverage` shows how many content pieces are fingerprinted vs total | Percentage and progress bar display |
| AC-5 | Alert resolution workflow: review -> false_positive or report | Status transitions work from dashboard |
| AC-6 | Dashboard handles empty state (no alerts, no fingerprints) | Onboarding guidance shown |

#### Edge Cases

- EC-1: Dashboard with 500+ alerts — pagination and lazy loading for performance
- EC-2: Fingerprint coverage calculation when content has multiple types (text + image) — count content piece as fingerprinted if at least one fingerprint exists
- EC-3: Dashboard loading while scanner job is running — show "scan in progress" indicator

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Dashboard renders with real and empty data states | |
| Alerts feed shows detected copies with side-by-side comparison | |
| DMCA report generation works from dashboard | |
| Fingerprint coverage stats accurate | |
| Alert resolution workflow works end-to-end | |
| 85%+ test coverage on dashboard components | |

---

### US-E8-007: Provenance Auto-Signing Integration

**Priority**: P0-CRITICAL

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | Provenance signing hooks into existing `POST /api/v1/content/publish` pipeline | All new content auto-signed |
| AC-2 | Backward compatibility: existing content without provenance still renders and functions | No errors for pre-Content Shield content |
| AC-3 | Provenance tags added to NOSTR event creation in shared package | Tags present in published NOSTR events |
| AC-4 | Signing works with all key management methods: browser extension (Alby, nos2x) and manual key input | Both methods produce valid signatures |

#### Edge Cases

- EC-1: Key management extension not installed — publish content without provenance, log warning, notify creator
- EC-2: Signing fails due to extension timeout — retry once, then publish without provenance and queue for later signing
- EC-3: Publish endpoint called directly via API (not through UI) — still auto-sign if key available

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| All new content auto-signed without user intervention | |
| Existing content without provenance continues to work | |
| Provenance tags present in NOSTR events | |
| Both key management methods produce valid signatures | |
| Graceful degradation when key unavailable | |
| 95%+ test coverage on integration hooks | |

---

### US-E8-008: Content Shield Integration Tests

**Priority**: P1-HIGH

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| E2E: Publish content, verify provenance badge appears | |
| E2E: View provenance chain, verify cryptographic data | |
| Integration: Fingerprint generated on content publish | |
| Integration: Copy detection finds matching content | |
| Integration: DMCA report contains correct provenance data | |
| All tests pass in Chromium, Firefox, and WebKit | |
| No regressions in existing content publish test suite | |

---

### US-E8-009: Content Shield Documentation

**Priority**: P2-MEDIUM

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Mermaid diagram: provenance chain data flow | |
| Mermaid diagram: copy detection scanner architecture | |
| ADR: Content fingerprinting algorithm choices (SimHash, pHash) | |
| CHANGELOG entry follows conventional commit format | |

---

## EPIC-009: Multi-Platform Hub

**PRD Domain**: Domain 3 - Multi-Platform Hub
**Team-Builder Tier**: enterprise (Wave A) + standard (Wave B)
**Stories**: 12 (US-E9-001 through US-E9-012)
**Dependencies**: None (new feature domain; benefits from EPIC-008 provenance for cross-posted content but non-blocking)
**Estimated Duration**: 2 weeks
**Waves**: Wave A (publishing + repurposing: US-E9-001 to US-E9-006) and Wave B (inbox + analytics: US-E9-007 to US-E9-012)

### Business Context

Creators drown in multi-platform management. Editing fatigue averages 6+ hours per stream. Algorithm changes penalize multi-niche creators. Sovren eliminates the multi-platform burden by letting creators publish once and distribute everywhere, with platform-optimized formatting, a unified engagement inbox, and cross-platform analytics.

### Security Rules (MANDATORY)

- **SR-001**: OAuth tokens encrypted at rest using AES-256-GCM before storage in Supabase
- **SR-002**: OAuth state parameter validated to prevent CSRF attacks during OAuth flows
- **SR-003**: No token leakage in logs, error messages, or API responses — tokens never appear in any output
- **SR-004**: Token refresh happens automatically before expiry — creator never needs to re-authenticate unless revoked
- **SR-005**: Platform disconnection revokes tokens on the external platform AND deletes encrypted tokens from Sovren database
- **SR-006**: RLS policies ensure creators only access their own platform connections
- **SR-007**: Rate limiting on platform API calls to prevent quota exhaustion and account suspension
- **SR-008**: Cross-posted content includes backlink to Sovren original (drives traffic to owned platform)

### Supported Platforms (MVP)

| Platform | API Protocol | Auth Method | MVP Priority |
|----------|-------------|-------------|-------------|
| Mastodon | ActivityPub | OAuth 2.0 | P0 (open protocol, easiest) |
| Bluesky | AT Protocol | OAuth 2.0 | P0 (decentralized alignment) |
| X/Twitter | REST API v2 | OAuth 2.0 | P1 (largest audience) |
| YouTube | Data API v3 | OAuth 2.0 | P2 (complex, video-focused) |

### Existing Code Foundation

- Backend: No existing distribution service
- Frontend: No existing multi-platform feature module
- Shared types: No existing distribution types

---

### US-E9-001: Platform Connection Data Model

**Priority**: P0-CRITICAL | **PRD Story**: Foundation for US-221 through US-224

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `platform_connections` table with columns: id, creator_id, platform (enum: mastodon/bluesky/x/youtube), access_token_encrypted (bytea), refresh_token_encrypted (bytea), scopes (text[]), connected_at, expires_at, instance_url (for Mastodon), status (active/expired/revoked) | Migration runs on clean and existing DBs |
| AC-2 | `cross_posts` table with columns: id, content_id, platform, platform_post_id, status (queued/publishing/published/failed/retrying), scheduled_at, published_at, error_message, metrics_json (jsonb), retry_count | Migration runs without errors |
| AC-3 | `repurposed_content` table with columns: id, source_content_id, platform, repurposed_text, format_type (thread/summary/key-takeaways), approved (boolean), published (boolean), created_at | Migration runs without errors |
| AC-4 | AES-256-GCM encryption layer: encrypt before INSERT, decrypt on SELECT; encryption key from environment variable (never hardcoded) | Encrypted value in DB is not plaintext; decryption produces original token |
| AC-5 | RLS: creators only access their own connections, cross_posts, and repurposed_content | Cross-creator access blocked |
| AC-6 | TypeScript types in `packages/shared/src/types/distribution.ts` | Types importable in frontend and backend |

#### Edge Cases

- EC-1: Encryption key rotation — support key versioning (store key_version in row; decrypt with correct key version)
- EC-2: Creator connects same platform twice — upsert on (creator_id, platform, instance_url), not duplicate
- EC-3: Mastodon instances — same creator can connect to multiple Mastodon instances (different instance_url)
- EC-4: Migration on database with existing data — no data loss

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Migration runs without errors on clean and existing databases | |
| AES-256-GCM encryption layer encrypts/decrypts tokens correctly | |
| Encryption key sourced from env var, never hardcoded | |
| RLS policies tested (cross-creator access blocked) | |
| Key versioning supports future rotation | |
| Mastodon multi-instance handled correctly | |
| Types exported from shared package | |
| 95%+ test coverage on encryption and data access | |

---

### US-E9-002: OAuth Platform Connection Service

**Priority**: P0-CRITICAL | **PRD Story**: US-221

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `POST /api/v2/platforms/connect/:platform` initiates OAuth flow — generates state parameter, redirects to platform auth URL | Redirect URL correct per platform |
| AC-2 | `GET /api/v2/platforms/callback/:platform` handles OAuth callback — validates state parameter, exchanges code for tokens, encrypts and stores tokens | Tokens stored encrypted; state validated |
| AC-3 | `DELETE /api/v2/platforms/disconnect/:platform` revokes token on external platform AND deletes encrypted tokens from database | Both actions complete; connection removed |
| AC-4 | `GET /api/v2/platforms/status` returns all connected platforms with status (active/expired/error) and basic account info | Correct connection states returned |
| AC-5 | Token refresh scheduler: auto-refresh tokens before expiry (5 minutes before expiration) | Token refreshed without creator action |
| AC-6 | Platform-specific adapters: each platform (Mastodon, Bluesky, X, YouTube) has its own adapter implementing a common interface | Adapter interface enforced; minimum 2 adapters for MVP |

#### Edge Cases

- EC-1: OAuth callback with invalid state parameter — reject with 403, log potential CSRF attempt
- EC-2: Platform API returns error during token exchange — return clear error to creator with retry option
- EC-3: Token refresh fails (revoked by user on platform side) — mark connection as "revoked", notify creator
- EC-4: Concurrent OAuth flows for same platform — prevent with mutex/lock on (creator_id, platform)
- EC-5: OAuth callback received for unknown creator session — reject, log suspicious activity
- EC-6: Platform OAuth scope changes — detect reduced scopes and warn creator of limited functionality
- EC-7: Mastodon instance URL validation — verify instance is running Mastodon before initiating OAuth

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| OAuth connect/disconnect works for at least 2 platforms (Mastodon, Bluesky) | |
| Tokens stored encrypted in database | |
| State parameter validated on callback (CSRF protection) | |
| Token refresh scheduler auto-refreshes before expiry | |
| Platform status endpoint returns correct connection states | |
| Invalid state parameter rejected with 403 | |
| 95%+ test coverage on OAuth service | |

---

### US-E9-003: Cross-Platform Publishing Queue

**Priority**: P0-CRITICAL | **PRD Story**: US-221

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | BullMQ job queue configured for cross-platform publishing with named queue `cross-platform-publish` | Queue registered and processing |
| AC-2 | `POST /api/v2/distribute/publish` accepts content_id and target platforms, creates jobs per platform | Jobs created and queued |
| AC-3 | Platform adapters format content per platform requirements: X (280 char limit, thread splitting), Bluesky (300 char limit, facets), Mastodon (500 char limit, content warning), YouTube (title, description, tags) | Content formatted correctly per platform |
| AC-4 | Retry logic: exponential backoff (1m, 5m, 15m, 1h) with max 4 retries; dead letter queue for permanent failures | Failed jobs retry with backoff; dead letter queue captures permanent failures |
| AC-5 | `GET /api/v2/distribute/status/:contentId` returns cross-post status per platform | Status includes: queued, publishing, published, failed, retrying |
| AC-6 | Scheduled publishing: jobs can be delayed to publish at specific times per platform | Scheduled jobs execute at configured time |
| AC-7 | Published cross-posts include backlink to Sovren original | Backlink present in cross-posted content |

#### Edge Cases

- EC-1: Platform API rate limit hit — respect rate limit headers, delay job, do not retry immediately
- EC-2: Content exceeds platform character limit even after formatting — truncate with "..." and backlink, or split into thread
- EC-3: Platform connection expired between queue and publish — refresh token before publish; if refresh fails, move to dead letter queue
- EC-4: Creator disconnects platform while jobs are queued — cancel pending jobs for that platform
- EC-5: Image attachment not supported on target platform — publish text-only with note about missing media
- EC-6: BullMQ worker crash during publishing — idempotent publishing (check if post exists before creating)
- EC-7: Scheduled publish time is in the past by the time job processes — publish immediately with log

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Content queued and published to at least 2 platforms | |
| Retry logic handles transient failures with exponential backoff | |
| Dead letter queue captures permanent failures | |
| Per-platform formatting applied correctly | |
| Scheduled publishing works at configured times | |
| Backlink to Sovren original included | |
| Idempotent publishing prevents duplicates | |
| 95%+ test coverage on publishing queue | |

---

### US-E9-004: Content Repurposing Engine

**Priority**: P1-HIGH | **PRD Story**: US-222

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `POST /api/v2/distribute/repurpose` generates platform-optimized versions from source content | Returns array of repurposed versions per target platform |
| AC-2 | Long-form to thread converter: splits by paragraphs/sections, adds numbering (1/N), respects platform char limits | Thread segments are correctly numbered and within limits |
| AC-3 | Long-form to summary converter: extracts key takeaways (3-5 bullet points) | Summary captures main points of original |
| AC-4 | Image resizing: produces platform-optimal dimensions (X: 1200x675, YouTube: 1280x720, etc.) | Images resized correctly per platform |
| AC-5 | Rule-based content adaptation for MVP (platform-specific headline/hook formatting) | Hooks follow platform norms (e.g., X uses punchy openers) |
| AC-6 | `GET /api/v2/distribute/repurposed/:contentId` previews all repurposed versions | All versions returned with format_type and platform |
| AC-7 | Creator approval required: repurposed content saved as draft until explicitly approved | No repurposed content publishes without creator approval |
| AC-8 | Backlink injection: all repurposed versions include link to Sovren original | Link present in every repurposed version |

#### Edge Cases

- EC-1: Very short content (< 100 chars) — skip repurposing, it already fits all platforms
- EC-2: Content with code blocks — preserve code formatting in thread conversion (use code block syntax per platform)
- EC-3: Content with many images — include first image in summary, all images in full posts where platform supports
- EC-4: Content in non-English language — rule-based adaptation is language-agnostic (no NLP assumptions)

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Long-form to thread conversion produces correctly numbered segments | |
| Summary extraction captures key takeaways | |
| Image resizing produces correct dimensions per platform | |
| Repurposed content saved as draft until creator approves | |
| Backlinks present in all repurposed versions | |
| Short content handled gracefully (skip repurposing) | |
| 95%+ test coverage on repurposing engine | |

---

### US-E9-005: Cross-Platform Publisher UI

**Priority**: P1-HIGH | **PRD Story**: US-221

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `packages/frontend/src/features/multi-platform/` feature module created with barrel exports | Clean imports from feature module |
| AC-2 | `PlatformConnector` component shows connect/disconnect for each supported platform | All 4 platforms displayed with correct status |
| AC-3 | `DistributionPanel` allows selecting target platforms and previewing per-platform formatting | Preview matches actual formatting output |
| AC-4 | `CrossPostQueue` shows scheduled and completed cross-posts with real-time status | Status updates without page refresh |
| AC-5 | `RepurposePreview` shows side-by-side preview of original vs repurposed formats per platform | All repurposed versions displayed |
| AC-6 | Integration with content editor: "Distribute" step added after publish | Seamless flow from publish to distribute |
| AC-7 | Platform status indicators: connected (green), token expiring (yellow), error (red), disconnected (gray) | Visual indicators match actual status |

#### Edge Cases

- EC-1: No platforms connected — show onboarding guidance to connect first platform
- EC-2: Platform connection lost while using DistributionPanel — show error state with reconnect button
- EC-3: Very long content preview — truncate preview with "..." and scroll-to-view option
- EC-4: Mobile view of DistributionPanel — stack platform previews vertically

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Platform connector shows connect/disconnect for each platform | |
| Distribution panel previews content per platform correctly | |
| Cross-post queue shows scheduled/completed posts with status | |
| Repurpose preview shows side-by-side comparison | |
| Integration with content editor is seamless | |
| All components tested with React Testing Library | |
| 85%+ test coverage on UI components | |

---

### US-E9-006: Wave A Integration Tests & Security Audit

**Priority**: P0-CRITICAL

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | E2E: Connect platform, publish content, verify cross-post appears | Playwright test passes |
| AC-2 | Integration: OAuth flow completes and tokens stored encrypted | Token in DB is encrypted ciphertext |
| AC-3 | Integration: Publishing queue retries on transient failure | Retry observed with exponential backoff |
| AC-4 | Security: Token storage encryption verified (AES-256-GCM) | Encrypted value not readable as plaintext |
| AC-5 | Security: OAuth state parameter prevents CSRF | Callback with wrong state returns 403 |
| AC-6 | Security: No token leakage in logs or error messages | Grep for token values in log output returns zero matches |

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| All E2E and integration tests pass | |
| Security audit confirms encrypted storage | |
| Security audit confirms CSRF protection | |
| Security audit confirms no token leakage | |
| No regressions in existing test suite | |
| 95%+ test coverage on new code | |

---

### US-E9-007: Unified Inbox Backend

**Priority**: P1-HIGH | **PRD Story**: US-223

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `GET /api/v2/inbox/messages?platform=all\|x\|youtube\|nostr\|mastodon\|bluesky&status=unread\|all` returns aggregated messages | Messages from all connected platforms in unified format |
| AC-2 | Platform polling service fetches new comments, DMs, mentions from connected platforms on schedule | New messages appear within polling interval |
| AC-3 | `POST /api/v2/inbox/reply/:messageId` routes reply to correct platform | Reply posted on correct platform via correct adapter |
| AC-4 | `PUT /api/v2/inbox/batch` supports batch actions: mark_read, archive | Batch operations affect all selected messages |
| AC-5 | Message normalization: each platform's message format converted to unified schema (id, platform, type, sender, content, timestamp, read, archived) | Consistent schema regardless of source platform |
| AC-6 | Polling frequency respects platform rate limits (configurable per platform) | No rate limit violations |

#### Edge Cases

- EC-1: Platform rate limit reached during polling — back off and resume at next scheduled interval
- EC-2: Reply to deleted message — return error with "original message not found" context
- EC-3: Message contains platform-specific formatting (e.g., X mentions, YouTube timestamps) — preserve in normalized form
- EC-4: Very high message volume (1000+/day) — pagination with cursor-based navigation
- EC-5: Platform connection expires between polls — skip platform, notify creator to reconnect
- EC-6: Duplicate messages from same platform event — deduplicate by platform_message_id

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Aggregated inbox returns messages from connected platforms | |
| Reply routing sends response to correct platform | |
| Batch actions work correctly | |
| Message normalization produces consistent schema | |
| Deduplication prevents duplicate messages | |
| 95%+ test coverage on inbox service | |

---

### US-E9-008: Cross-Platform Analytics Backend

**Priority**: P1-HIGH | **PRD Story**: US-224

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `GET /api/v2/analytics/cross-platform/overview` returns aggregate follower/subscriber counts and total engagement across platforms | Accurate totals from all connected platforms |
| AC-2 | `GET /api/v2/analytics/cross-platform/comparison/:contentId` returns same-content performance on different platforms | Side-by-side metrics (views, likes, replies, shares) per platform |
| AC-3 | `GET /api/v2/analytics/cross-platform/roi` returns engagement-per-hour-invested per platform | Platforms ranked by ROI metric |
| AC-4 | Platform metrics polling: follower count, post engagement, subscriber count fetched on schedule | Metrics updated within polling interval |
| AC-5 | Historical metrics stored for trend analysis (daily snapshots) | Trend data available for 30/60/90 day periods |

#### Edge Cases

- EC-1: Platform doesn't expose certain metrics (e.g., Mastodon doesn't have "views") — show "N/A" for unavailable metrics
- EC-2: Content not cross-posted to all platforms — comparison only shows platforms where content was posted
- EC-3: ROI calculation with zero hours invested — show "infinite" or handle gracefully
- EC-4: Metrics API returns stale data — show last-updated timestamp

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Overview endpoint returns aggregate metrics across platforms | |
| Content comparison shows same-content performance | |
| ROI metric calculated correctly per platform | |
| Historical metrics stored and retrievable for trend analysis | |
| Unavailable metrics shown as "N/A" (not zero) | |
| 95%+ test coverage on analytics service | |

---

### US-E9-009: Unified Inbox UI

**Priority**: P1-HIGH | **PRD Story**: US-223

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `UnifiedInbox` displays all messages with platform badge icons | Messages show source platform icon |
| AC-2 | Filter bar: filter by platform, read/unread, and search by content | Filters apply correctly |
| AC-3 | Reply-in-place: compose reply inline, routed to correct platform | Reply appears on source platform |
| AC-4 | Batch action toolbar: mark read, archive, template reply for multi-selected messages | Batch operations work on selections |
| AC-5 | Template manager: create, edit, delete response templates | Templates persist and are usable in replies |
| AC-6 | Real-time updates via polling or WebSocket for new messages | New messages appear without manual refresh |

#### Edge Cases

- EC-1: No connected platforms — show onboarding to connect first platform
- EC-2: Reply fails (platform error) — show error with retry option, don't lose draft
- EC-3: Very long message thread — collapsible thread view
- EC-4: Filter returns zero results — show "no messages match filters" (not error)

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Inbox displays messages with correct platform badges | |
| Filter bar works across all filter types | |
| Reply-in-place correctly routes to source platform | |
| Batch actions work on multi-selected messages | |
| Template manager CRUD operations work | |
| Real-time updates without manual refresh | |
| 85%+ test coverage on inbox UI components | |

---

### US-E9-010: Cross-Platform Analytics UI

**Priority**: P1-HIGH | **PRD Story**: US-224

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `CrossPlatformDashboard` shows aggregate metrics: total followers, total engagement, growth trends | Accurate totals displayed |
| AC-2 | `PlatformComparison` shows side-by-side performance per platform with charts | Visual comparison clear and accurate |
| AC-3 | `PlatformROI` ranks platforms by engagement-per-hour-invested | Rankings displayed with explanation |
| AC-4 | `AudienceOverlap` shows estimated overlap between platforms | Visualization makes overlap intuitive |
| AC-5 | Integrates as tab in existing analytics dashboard | Tab navigation works |

#### Edge Cases

- EC-1: Only one platform connected — show single-platform view with prompt to connect more
- EC-2: Platform with zero engagement — show platform in comparison but with zero values (not hidden)
- EC-3: Audience overlap estimation with insufficient data — show "insufficient data" label

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Dashboard renders aggregate metrics from all connected platforms | |
| Platform comparison shows side-by-side performance | |
| ROI ranking displays platforms ordered by engagement/hour | |
| Integrates as tab in existing analytics dashboard | |
| Single-platform gracefully handled | |
| 85%+ test coverage on analytics UI components | |

---

### US-E9-011: Wave B Integration Tests

**Priority**: P1-HIGH

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| E2E: Navigate to unified inbox, verify multi-platform messages | |
| E2E: Reply to message, verify correct platform routing | |
| E2E: Navigate to analytics, verify aggregate data renders | |
| Integration: Inbox polling fetches new messages | |
| Integration: Analytics metrics aggregate correctly | |
| All E2E tests pass in Chromium and Firefox | |
| No regressions in existing test suite | |

---

### US-E9-012: Multi-Platform Documentation

**Priority**: P2-MEDIUM

#### Definition of Done

| Criterion | Status |
|-----------|--------|
| Mermaid diagram: cross-platform publishing queue architecture | |
| Mermaid diagram: unified inbox message flow | |
| ADR: Platform adapter abstraction pattern | |
| ADR: OAuth token storage encryption approach | |
| CHANGELOG entry follows conventional commit format | |

---

## Cross-Cutting Requirements

### Data Privacy Requirements

| Requirement | Applies To | Enforcement |
|-------------|-----------|-------------|
| Wellness data is PRIVATE and never shared | EPIC-007 | RLS + application-level checks |
| OAuth tokens encrypted at rest (AES-256-GCM) | EPIC-009 | Encryption layer before INSERT |
| Content fingerprints are public (for open verification) | EPIC-008 | Published to NOSTR |
| All RLS policies enforce creator_id scoping | All 3 epics | Database-level enforcement |
| Creator can delete all their data at any time | All 3 epics | Hard delete cascades |
| No sensitive data in logs or error messages | EPIC-009 | Log sanitization middleware |

### Accessibility Requirements

| Requirement | Standard |
|-------------|---------|
| All interactive elements have ARIA labels | WCAG 2.1 AA |
| Keyboard navigation for all features | WCAG 2.1 AA |
| Screen reader compatibility | WCAG 2.1 AA |
| Color contrast ratios meet minimum thresholds | WCAG 2.1 AA (4.5:1 for text) |
| Lighthouse accessibility score >= 90 | Per-page measurement |

### Performance Requirements

| Requirement | Target |
|-------------|--------|
| Dashboard initial render | < 2 seconds |
| API response time (p95) | < 500ms |
| Heatmap/chart render (90 days of data) | < 2 seconds |
| Cross-platform publish queue throughput | >= 100 jobs/minute |
| Relay scanner events processed | >= 500 events/minute |
| Inbox polling latency | < 30 seconds for new messages |

### Testing Requirements

| Level | Coverage Target | Applies To |
|-------|----------------|-----------|
| Unit tests (services, utilities) | 95%+ | All backend services |
| Unit tests (components, hooks) | 85%+ | All frontend components |
| Integration tests | 95%+ on new code | API endpoints, data flows |
| E2E tests | Key user flows | Critical paths per epic |
| Security tests | All security rules | OAuth, encryption, RLS |

---

## Success Metrics

### EPIC-007: Creator Wellness

| Metric | Target | Measurement |
|--------|--------|-------------|
| Wellness feature adoption rate | 60% of active creators | Tracked via feature usage analytics |
| Average creator work hours per week | Stabilize at < 45 hrs | Aggregated from work pattern tracking |
| Burnout risk score distribution | < 20% in "high risk" category | Aggregated from burnout scoring |
| Creator retention at 6 months | 70% (up from industry avg of 40%) | Cohort analysis |
| Rest day compliance rate | 2+ rest days/week for 60% of creators | Aggregated from pattern tracking |

### EPIC-008: Content Shield

| Metric | Target | Measurement |
|--------|--------|-------------|
| Content with provenance signing | 100% of new content | Auto-signing coverage |
| AI copy detection rate | 80%+ of copies on NOSTR network | Scanner detection rate |
| Time from detection to creator alert | < 24 hours | Alert latency tracking |
| DMCA report generation | 1-click for 100% of detected copies | Report generation success rate |
| Fingerprint coverage | 100% of published content | Fingerprint registry coverage |

### EPIC-009: Multi-Platform Hub

| Metric | Target | Measurement |
|--------|--------|-------------|
| Platform connection adoption | 50% of creators connect 2+ platforms | Connection count analytics |
| Time saved per creator per week | 5+ hours on distribution | Self-reported + activity comparison |
| Cross-platform engagement increase | 30% more total engagement | Aggregate analytics |
| Unified inbox response time improvement | 40% faster | Response latency analytics |
| Content repurposing usage | 30% of published content repurposed | Repurposing API usage |

---

## Appendix: Story Dependency Map

```
EPIC-007:
  US-E7-001 (Data Model) → US-E7-002 (Patterns API) → US-E7-003 (Burnout Score) → US-E7-004 (Dashboard UI)
  US-E7-001 → US-E7-006 (Boundaries)                                              → US-E7-005 (Scheduling)
  US-E7-001 → US-E7-007 (Pulse)
  (No deps)  → US-E7-008 (Resources)
  US-E7-004 + US-E7-005 + US-E7-006 → US-E7-009 (Integration Tests)
  All → US-E7-010 (Documentation)

EPIC-008:
  US-E8-001 (Data Model) → US-E8-002 (Signing) → US-E8-007 (Auto-Sign Integration)
  US-E8-001 → US-E8-003 (Fingerprinting) → US-E8-004a (Scanner) → US-E8-004b (Alerts) → US-E8-004c (DMCA)
  US-E8-002 → US-E8-005 (Badge UI)
  US-E8-003 + US-E8-004 → US-E8-006 (Dashboard)
  US-E8-005 + US-E8-006 → US-E8-008 (Integration Tests)
  All → US-E8-009 (Documentation)

EPIC-009 Wave A:
  US-E9-001 (Data Model) → US-E9-002 (OAuth) → US-E9-003 (Publishing Queue)
  US-E9-003 → US-E9-004 (Repurposing)
  US-E9-002 + US-E9-003 → US-E9-005 (Publisher UI)
  US-E9-003 + US-E9-005 → US-E9-006 (Wave A Tests + Security)

EPIC-009 Wave B:
  US-E9-002 → US-E9-007 (Inbox Backend) → US-E9-009 (Inbox UI)
  US-E9-002 → US-E9-008 (Analytics Backend) → US-E9-010 (Analytics UI)
  US-E9-009 + US-E9-010 → US-E9-011 (Wave B Tests)
  All → US-E9-012 (Documentation)
```
