# Architect Review: PRD v2.0 Creator Empowerment Platform

**Reviewer**: Principal Software Architect
**Date**: 2026-02-12
**Documents Reviewed**:
- `SOVREN_PRD_V2_CREATOR_EMPOWERMENT.md` (v2.0 PRD)
- `docs/plans/PRD_V2_EPIC_DECOMPOSITION.md` (54 implementation stories)
- `CLAUDE.md` (project context and standards)
- `PROJECT_ROADMAP_2025.md` (completion status)
- Existing codebase: backend services, routes, DI container, database schema, shared types

**Verdict**: **APPROVE WITH CHANGES**

---

## 1. Technical Feasibility Assessment

### Domain 1: Creator Wellness System (EPIC-007) -- GREEN

**Feasibility**: Straightforward CRUD + analytics on top of existing infrastructure.

**Strengths**:
- Data model is simple (two new tables: `wellness_snapshots`, `creator_work_patterns`)
- Frontend integrates as a tab in existing `CreatorDashboard` -- clean extension point
- Burnout risk scoring is deterministic (pattern analysis), not ML -- appropriate for MVP
- Work pattern auto-tracking via middleware is a clean approach that leverages the existing Express middleware chain

**Concerns**:
- The auto-tracking middleware (US-E7-002) that logs "content publish, DM sends, analytics views as implicit work events" needs careful design to avoid becoming a performance bottleneck on hot paths. Recommend async event emission via existing `EventBusService` rather than synchronous middleware.
- "Anonymous benchmarking" (US-E7-007) aggregating across creators requires careful privacy engineering. The decomposition says "aggregates only" but the implementation story should specify minimum cohort sizes (e.g., n >= 50) to prevent de-anonymization.

**Estimate accuracy**: 1 week is realistic for a standard tier team.

---

### Domain 2: Content Shield (EPIC-008) -- GREEN

**Feasibility**: Builds naturally on existing NOSTR event signing infrastructure. Cryptographic provenance is a well-understood pattern.

**Strengths**:
- Provenance signing hooks into existing content publish pipeline -- minimal disruption
- NIP-compliant event tag extension is the right approach for NOSTR interoperability
- Fingerprinting (SimHash for text, pHash for images) uses proven algorithms
- Three-table design (`provenance_records`, `content_fingerprints`, `content_alerts`) is clean and normalized

**Concerns**:
- **Content fingerprint scanning** (US-E8-004) is the highest-complexity story in this epic. Scanning the NOSTR relay network for matching fingerprints is computationally expensive and architecturally complex. The decomposition allocates 4 hours -- this is underestimated. The scanner needs:
  - A relay subscription strategy (which relays? how many? subscription management)
  - A batch comparison engine (comparing incoming events against all of a creator's fingerprints)
  - Rate limiting to avoid being blocked by relays
  - This is closer to 8-12 hours and may warrant its own story split
- **pHash for images** requires a native module dependency (sharp or similar). This needs to be validated against the Docker multi-architecture build (amd64 + arm64 noted in CLAUDE.md).
- The DMCA report generator should be a separate utility, not embedded in the alert handler.

**Estimate accuracy**: 1 week is tight if scanner complexity is not addressed. Recommend 1.5 weeks.

---

### Domain 3: Multi-Platform Hub (EPIC-009) -- YELLOW

**Feasibility**: Achievable but carries the highest technical risk of all six domains due to external API dependencies and OAuth complexity.

**Strengths**:
- Correctly elevated to enterprise tier for Wave A (OAuth tokens are security-sensitive)
- Two-wave approach (publishing first, inbox/analytics second) is good risk management
- Platform adapter pattern already exists in `social-media-integration-service.ts` (types and interface defined for `SocialPlatformAdapter`)
- ioredis is already installed -- BullMQ can be added as a dependency

**Concerns**:
- **BullMQ is not installed** and is not in `package.json`. This is a new infrastructure dependency that needs:
  - Redis configuration for BullMQ (separate DB or namespace from existing ioredis usage)
  - Worker process management (in-process or separate worker container?)
  - Dashboard for monitoring (Bull Board or similar)
  - Dead letter queue handling
  - This infrastructure setup is missing as a story. **Add US-E9-000: BullMQ Infrastructure Setup** as a P0-CRITICAL prerequisite.
- **Platform API rate limits and costs** are listed as an open question (PRD Section 11, Q1) but the decomposition proceeds as if all APIs are available. Specifically:
  - X/Twitter API v2 requires a paid tier ($100/month minimum) for posting via API
  - YouTube Data API has a 10,000 unit daily quota (each upload costs 1,600 units -- only ~6 uploads/day free)
  - Bluesky AT Protocol is permissive but unstable (beta API)
  - Threads API has limited availability for third-party posting
  - **Recommendation**: Story US-E9-002 (OAuth Platform Connection Service) should include a discovery phase to validate actual API availability before implementing all 5 platform adapters. Start with Bluesky and Mastodon (free, open protocols) and X/YouTube as optional paid integrations.
- **Unified Inbox polling** (US-E9-007) will hit API rate limits quickly across 5 platforms for thousands of creators. The decomposition mentions "polling frequency configuration" but does not address the aggregate rate limit problem. At 1,000 creators with 5 platforms polled every 5 minutes, that is 1,000 * 5 / 5 = 1,000 API calls/minute. This requires a centralized rate-limit-aware polling scheduler -- another infrastructure story not accounted for.
- **Content Repurposing Engine** (US-E9-004) mentions "AI headline/hook suggestions" -- what AI model? This implies an LLM API integration (OpenAI, Anthropic, or local model). The decomposition does not specify this dependency or its cost.
- The `repurposed_content` table in US-E9-001 is listed but not in PRD Section 8.3's table list -- inconsistency between PRD and decomposition.

**Estimate accuracy**: 2 weeks is underestimated. Recommend 3 weeks total (1.5 weeks Wave A, 1.5 weeks Wave B) given infrastructure setup and platform API validation.

---

### Domain 4: Creator Network (EPIC-010) -- YELLOW

**Feasibility**: Achievable but underestimates the complexity of several features.

**Strengths**:
- Good dependency identification (needs EPIC-008 provenance for collaborative content attribution)
- NOSTR encrypted group messaging for circles is the right approach for decentralization
- Service marketplace with Lightning escrow leverages existing payment infrastructure

**Concerns**:
- **NOSTR encrypted group messages** (NIP-28 public channels or NIP-104 group DMs) are not fully standardized. The decomposition (US-E10-002) says "Circle discussion feed (NOSTR encrypted group messages)" but does not specify which NIP. NIP-28 is for public channels (not encrypted). Truly encrypted group messaging on NOSTR is still experimental. This is a significant underestimation. **Recommendation**: Start with a Supabase-backed group chat with NOSTR identity verification, then migrate to pure NOSTR messaging when the protocol matures.
- **Lightning escrow** (US-E10-005, marketplace) is described as "creates Lightning escrow invoice" but Lightning payments are push-only and near-instant -- there is no native escrow mechanism. The escrow would need to be custodial (Sovren holds funds temporarily) or use hold invoices (HODL invoices). This contradicts the non-custodial philosophy in PRD Section 8.4. **This is a design conflict that needs resolution before implementation.**
- **Revenue splitting** (US-E10-004, collaborative content) with "automated Lightning payment splitting based on configured ratios" implies the platform receives the payment and splits it. This is custodial behavior. If Sovren is not meant to hold funds, this needs a multi-party payment scheme (e.g., multiple Lightning invoices per payment) or a trusted intermediary. **This is another custodial design conflict.**
- **US-E10-006** (Creator Network UI) at 5 hours for 9 components across 4 sub-features (circles, mentorship, collaboration, marketplace) is significantly underestimated. This is closer to 12-16 hours of frontend work. Recommend splitting into 2-3 frontend stories.

**Estimate accuracy**: 1 week is underestimated. Recommend 2 weeks.

---

### Domain 5: Business Manager (EPIC-011) -- GREEN

**Feasibility**: Primarily CRUD operations with no external dependencies. Lowest risk domain.

**Strengths**:
- Minimal tier is appropriate for mostly form-based CRUD features
- Contract templates with red flag analysis is a rules-based system, not ML
- Invoice generation with embedded Lightning payment links integrates cleanly with existing infrastructure
- Tax categorization leveraging existing transaction history is straightforward

**Concerns**:
- **Minimal tier lacks a frontend agent** -- the decomposition acknowledges this (US-E11-006 note) but does not resolve it. The UI story lists 7 components for 5 hours of work. Given that minimal tier has architect + backend + QA only, the frontend will need a follow-up run or tier promotion. **Recommendation**: Promote to `standard` tier. The UI is not trivial CRUD -- the Red Flag Report, Revenue Mix donut chart, and Expense Tracker require real frontend engineering.
- **PDF export** (US-E11-002 for contracts, US-E11-003 for invoices) requires a PDF generation library. This is not mentioned in the tech stack. Options: `pdf-lib` (pure JS), `puppeteer` (Chrome-based). The Docker image size constraint (<150MB per CLAUDE.md) makes puppeteer impractical. Recommend `pdf-lib` but this needs a story for the shared utility.
- **BTC-to-USD conversion** (US-E11-005) needs a currency API. The `CurrencyService` already exists in the DI container (`TYPES.CurrencyService`) -- but is it implemented or just a placeholder? If placeholder, this is a hidden dependency.

**Estimate accuracy**: 1 week is realistic if promoted to standard tier.

---

### Domain 6: Income Stabilizer (EPIC-012) -- YELLOW

**Feasibility**: Revenue forecasting is achievable with the stated "simple regression" approach, but several stories have hidden complexity.

**Strengths**:
- Standard tier is appropriate
- Revenue forecasting with linear regression is a pragmatic MVP choice
- Non-custodial emergency fund (tracking only) avoids custodial risk
- Builds on existing `PerformancePredictionViewer` and `GrowthForecastingChart`

**Concerns**:
- **Subscriber health scoring** (US-E12-003) requires access to per-subscriber engagement data. The current schema tracks payments and invoices but not per-subscriber content engagement (views, comments, time-spent). **Where does engagement data per subscriber come from?** The `subscriber_health` table references `engagement_trend` but the data source is not identified. This may require new instrumentation or a new table (`subscriber_activity_log`). **Missing dependency on analytics instrumentation.**
- **Emergency fund tracking** (US-E12-004) is described as non-custodial ("Sovren records allocations but never holds funds. Creator's wallet is the source of truth.") But the implementation includes `POST /api/v2/income/emergency-fund/withdraw` -- if Sovren never holds funds, what does "withdraw" mean? The balance is purely informational, and the creator moves funds in their own wallet. The API should only record that a withdrawal happened (bookkeeping), not trigger any actual payment. **The story description is ambiguous and could lead to custodial implementation by mistake.** Needs explicit clarification.
- **Forecast accuracy tracking** (US-E12-002) -- "compare predictions to actuals, log accuracy score" -- requires a scheduled job to retroactively evaluate past predictions. This batch job infrastructure is the same BullMQ dependency as EPIC-009. If EPIC-012 runs after EPIC-009, BullMQ will already exist. But if the execution order changes, this becomes a hidden dependency.
- **Weekly forecast digest email** (US-E12-002) -- the existing `EmailService` is listed as a transient service in the DI container, but is it implemented with an actual email provider (SendGrid, etc.) or is it a stub? If stub, email functionality is a hidden dependency.

**Estimate accuracy**: 1 week is realistic if the subscriber engagement data source is resolved.

---

## 2. Epic Dependency Review

### Dependency Graph Assessment

The proposed dependency graph:
```
EPIC-007 (Wellness) → EPIC-008 (Shield) → EPIC-010 (Network) → EPIC-011 (Business) → EPIC-012 (Income)
EPIC-009 (Platform) runs parallel to EPIC-008 and EPIC-010
```

### Issues Found

**Issue 1: EPIC-008 does not depend on EPIC-007**

The decomposition states EPIC-008's dependency is "None (builds on existing NOSTR infrastructure)" which is correct. But the dependency diagram (lines 14-37 of decomposition) shows EPIC-007 → EPIC-008 with an arrow. Content Shield has zero dependency on Creator Wellness. **These two epics can run in parallel** from the start, which shortens the critical path by 1 week.

**Corrected parallel lanes**:
- Lane 1: EPIC-007 (Wellness) in parallel with EPIC-008 (Shield) -- both start immediately
- Lane 2: EPIC-009 (Platform) starts after security prereqs (no dependency on 007 or 008)
- Lane 3: EPIC-010 (Network) depends on EPIC-008 (provenance for collab content)
- Lane 4: EPIC-011 (Business) depends on EPIC-007 (wellness data in business health) + EPIC-009 (cross-platform analytics)
- Lane 5: EPIC-012 (Income) depends on EPIC-011 (revenue breakdown)

**Issue 2: EPIC-009 has no dependency on EPIC-007 or EPIC-008**

The diagram shows EPIC-009 depending on EPIC-007 (via left branch). But the decomposition text for EPIC-009 says "Dependencies: None (new feature domain, but benefits from EPIC-008 provenance for cross-posted content)". This is a soft dependency (nice-to-have), not a blocking one. **EPIC-009 can start immediately after security prereqs**, not after EPIC-007.

**Issue 3: Missing dependency -- EPIC-009 requires BullMQ infrastructure**

As noted in the feasibility section, BullMQ is not installed. A new story US-E9-000 should be the first story in EPIC-009 and potentially shared with EPIC-012.

**Issue 4: EPIC-011 dependency on EPIC-009 is soft**

EPIC-011 (Business Manager) lists EPIC-009 (cross-platform analytics for revenue diversification) as a dependency. But the Revenue Diversification Planner (US-E11-004) categorizes revenue by type (subscriptions, tips, sponsorships) -- it does not need cross-platform analytics data. Cross-platform metrics would be a nice enhancement but are not blocking. **EPIC-011 can start after EPIC-007 only.**

### Corrected Dependency Graph

```
                    ┌─────────────┐   ┌─────────────┐
           ┌───────┤  EPIC-007   │   │  EPIC-008   ├───────┐
           │       │  Wellness   │   │   Shield    │       │
           │       └──────┬──────┘   └──────┬──────┘       │
           │              │                 │              │
           │       ┌──────▼──────┐   ┌──────▼──────┐       │
           │       │  EPIC-011   │   │  EPIC-010   │       │
           │       │  Business   │   │  Network    │       │
           │       └──────┬──────┘   └─────────────┘       │
           │              │                                │
           │       ┌──────▼──────┐                         │
           │       │  EPIC-012   │                         │
           │       │   Income    │                         │
           │       └─────────────┘                         │
           │                                               │
           │       ┌─────────────┐                         │
           └──────►│  EPIC-009   │◄────────────────────────┘
                   │  Platform   │  (soft dep, can start immediately)
                   └─────────────┘
```

**New critical path**: Security Prereqs → [EPIC-007 || EPIC-008 || EPIC-009 Wave A] → EPIC-010 → [EPIC-011 || EPIC-009 Wave B] → EPIC-012

This allows 3 epics to start in parallel after security fixes, reducing the overall timeline by ~2 weeks.

---

## 3. Architecture Extension Review

### Backend Package Structure -- APPROVED

The proposed structure adds:
- `backend/src/services/wellness/`
- `backend/src/services/provenance/`
- `backend/src/services/distribution/`
- `backend/src/services/community/`
- `backend/src/services/finance/`

This follows the existing flat-service pattern. However, I note the current backend has both flat services (e.g., `lightning-payment-service.ts`) and directory-based services (`services/content/`, `services/lightning/`, `services/payment/`, `services/user/`). The PRD proposes directory-based groupings, which is the preferred pattern for v2.0.

**Issue**: The proposed `routes/v2/` directory for new endpoints is correct and follows semantic versioning. However, the decomposition stories define API paths as `/api/v2/wellness/...`, `/api/v2/shield/...`, etc. but the existing route registration pattern (in `routes/index.ts` or `app.ts`) needs to be verified. The `v1/` routes are registered in `routes/v1/index.ts` -- a similar `routes/v2/index.ts` barrel export should be created.

**Issue**: New services need DI registration. The `container/types.ts` currently has 29 service tokens across 5 phases. Adding 5 new service domains means ~15-20 new service tokens. The decomposition does not include a story for DI container extension. **Add a cross-cutting story: "Register v2 services in DI container" as a dependency for all backend API stories.**

### Frontend Package Structure -- APPROVED

The proposed structure adds 6 new feature modules:
- `frontend/src/features/wellness/`
- `frontend/src/features/content-shield/`
- `frontend/src/features/multi-platform/`
- `frontend/src/features/creator-network/`
- `frontend/src/features/business/`
- `frontend/src/features/income/`

This follows the existing feature-based architecture pattern exactly. Each module will have its own `components/`, `services/`, `types/`, and `index.ts` barrel export.

**Issue**: The PRD's navigation update (Section 5.1) adds 4 new top-level nav items (Distribute, Community, Business, Content Shield). The existing navigation likely has 6-7 items. Adding 4 more could create UX issues on mobile. The decomposition does not include a story for navigation architecture redesign. **Recommend a US-E7-000: Navigation Architecture Update story that runs first.**

### Shared Types -- APPROVED WITH CHANGES

New types proposed:
- `shared/src/types/wellness.ts`
- `shared/src/types/provenance.ts`
- `shared/src/types/distribution.ts`
- `shared/src/types/community.ts`
- `shared/src/types/finance.ts`

This follows the existing pattern. However, `finance.ts` is shared between EPIC-011 (Business Manager) and EPIC-012 (Income Stabilizer). The decomposition shows US-E12-001 adding types to the same `finance.ts` file. This creates a merge conflict risk if EPIC-011 and EPIC-012 overlap in execution. **Recommendation**: Use separate files `finance-business.ts` and `finance-income.ts`, or ensure EPIC-011 completes before EPIC-012 begins (which the dependency graph already requires).

### Database Schema -- APPROVED WITH CONCERNS

PRD Section 8.3 proposes 12 new tables. The decomposition expands this to ~20 tables total (including sub-tables like `creator_work_patterns`, `contract_templates`, `expenses`, `revenue_forecasts`, `subscriber_health`, `income_milestones`).

**Concerns**:
1. **No migration framework identified**: The existing codebase uses raw `.sql` files in `database/` rather than a migration tool (Knex, Prisma, TypeORM). Adding 20 tables via raw SQL is risky for ordering and rollback. Recommend adopting a migration runner or at minimum a numbered migration file convention.
2. **Missing indexes on foreign keys**: The table definitions in the decomposition specify columns but not indexes. Every `creator_id` foreign key needs an index for RLS policy performance. This should be explicit in each data model story.
3. **JSONB columns**: Several tables use `JSONB` for flexible data (`goals_json`, `line_items_json`, `metrics_json`, `portfolio_urls`). This is fine for MVP but should have documented JSON schemas for type safety. Each JSONB column should have a corresponding Zod schema in the shared types.

---

## 4. Tier Selection Review

| Epic | Proposed Tier | Recommended Tier | Reasoning |
|------|--------------|-----------------|-----------|
| P1 Security Fixes | minimal | minimal | Correct -- focused backend work |
| EPIC-007: Wellness | standard | standard | Correct -- new frontend domain + backend APIs |
| EPIC-008: Shield | standard | standard | Correct -- crypto signing is sensitive but within team capability |
| EPIC-009 Wave A: Platform Publishing | enterprise | enterprise | **Correct** -- OAuth tokens, external APIs, security audit needed |
| EPIC-009 Wave B: Platform Inbox/Analytics | standard | standard | Correct -- builds on Wave A infrastructure |
| EPIC-010: Creator Network | standard | **enterprise** | **Change** -- Lightning escrow is security-sensitive (custodial payment handling). Payment splitting also involves holding/routing funds. Needs security-audit agent. |
| EPIC-011: Business Manager | minimal | **standard** | **Change** -- 7 UI components including charts (Revenue Mix donut, Red Flag Report) require real frontend work. Minimal tier has no frontend agent. |
| EPIC-012: Income Stabilizer | standard | standard | Correct -- forecasting algorithms + dashboard UI |

**Net impact**: Two tier upgrades. EPIC-010 minimal → enterprise adds security-audit and code-review agents for the payment splitting logic. EPIC-011 minimal → standard adds frontend and security-audit agents.

---

## 5. Complexity Hotspots

### Hotspot 1: NOSTR Relay Content Scanner (US-E8-004)

**Allocated**: 4 hours
**Actual estimate**: 10-16 hours

Scanning the NOSTR relay network for content matching creator fingerprints requires:
- Relay connection management (connect to N relays, manage subscriptions)
- Content ingestion pipeline (receive events, extract content, compute fingerprints)
- Comparison engine (compare incoming fingerprints against all registered creator fingerprints)
- Alert generation with confidence scoring
- Job scheduling (BullMQ or cron)
- Rate limiting to avoid relay bans

This is essentially building a lightweight NOSTR indexer. Recommend splitting into 3 sub-stories:
1. Relay subscription manager
2. Fingerprint comparison engine
3. Alert generation and notification

### Hotspot 2: Lightning Payment Splitting (US-E10-004)

**Allocated**: 3 hours
**Actual estimate**: 8-12 hours

Automated Lightning payment splitting for collaborative content involves:
- Intercepting incoming payments (modifying the payment receipt flow)
- Computing splits based on content-specific configuration
- Generating outgoing payments to co-authors
- Handling partial failures (what if one co-author's wallet is offline?)
- Atomicity concerns (all splits succeed or none?)
- This is de facto custodial -- Sovren receives, holds briefly, and redistributes

This needs a thorough design phase (ADR) before any implementation.

### Hotspot 3: Cross-Platform OAuth Management (US-E9-002)

**Allocated**: 4 hours
**Actual estimate**: 8-10 hours

Each platform has a different OAuth flow:
- X/Twitter: OAuth 2.0 with PKCE
- YouTube: Google OAuth 2.0 with restricted scopes
- Bluesky: AT Protocol authentication (not traditional OAuth)
- Mastodon: OAuth 2.0 but each instance has a different auth server
- Threads: Meta OAuth 2.0 with limited API access

Building 5 platform-specific OAuth adapters, token refresh logic, scope management, and secure storage in 4 hours is not feasible. Recommend starting with 2 platforms (Mastodon + Bluesky as free/open) and adding others incrementally.

### Hotspot 4: Creator Network UI (US-E10-006)

**Allocated**: 5 hours for 9 components
**Actual estimate**: 12-16 hours

Nine distinct components spanning four sub-features (circles, mentorship, collaboration, marketplace) with navigation integration. Each component needs its own state management, loading/error states, empty states, and responsive design. This should be split into 3-4 frontend stories aligned with the backend features.

### Hotspot 5: Unified Inbox Real-Time Updates (US-E9-009)

**Allocated**: 3 hours
**Actual estimate**: 6-8 hours

The story mentions "Real-time updates via WebSocket for new messages" but the existing architecture uses Supabase Realtime (`supabase-realtime-service.ts`). The inbox aggregates messages from 5 external platforms. Real-time would require either:
- Webhooks from each platform (only some support this)
- Frequent polling + push via Supabase Realtime to the frontend
- A custom WebSocket layer

This architectural decision is missing from the decomposition.

---

## 6. Missing Technical Requirements

### Missing Requirement 1: Job Queue Infrastructure (BullMQ Setup)

The decomposition relies on BullMQ for cross-platform publishing (EPIC-009), content scanning (EPIC-008), and forecasting batch jobs (EPIC-012). But BullMQ is not installed and there is no story for setting it up.

**Recommended story**: US-E0-001: Job Queue Infrastructure -- Install BullMQ, configure Redis namespaces, create worker process management, add Bull Board monitoring, integrate with Docker Compose.

### Missing Requirement 2: DI Container Extension for v2 Services

The DI container (`container/types.ts`) needs new service tokens, bindings, and lifetime configurations for all v2 services. No story accounts for this.

**Recommended story**: US-E0-002: DI Container v2 Extension -- Add service tokens for all v2 services (Wellness, Provenance, Distribution, Community, Finance), create binding files (`wellness.bindings.ts`, etc.), update SERVICE_LIFETIMES and SERVICE_DEPENDENCIES.

### Missing Requirement 3: Navigation Architecture Update

Adding 4 top-level nav items breaks the existing navigation UX. No story addresses the navigation redesign needed to accommodate v2.0 features.

**Recommended story**: US-E0-003: Navigation Redesign -- Restructure top-level nav to accommodate 11+ items (grouped navigation, collapsible sections, mobile hamburger redesign).

### Missing Requirement 4: v2 API Route Registration

The v1 routes are registered via `routes/v1/index.ts` and mounted in `app.ts`. New v2 routes need:
- `routes/v2/index.ts` barrel export
- Registration in `app.ts` under `/api/v2` prefix
- v2-specific middleware (if any)

### Missing Requirement 5: Email Service Implementation

Multiple stories reference email functionality (forecast digest, overdue invoice notifications, re-engagement campaigns). The `EmailService` token exists in the DI container, but whether it is fully implemented with an actual email provider (SendGrid, Resend, etc.) is unclear from the codebase. If it is a stub, email delivery is a hidden prerequisite.

### Missing Requirement 6: PDF Generation Utility

Contract export (US-E11-002) and invoice export (US-E11-003) require PDF generation. No library is in `package.json` for this. Recommend `pdf-lib` (pure JS, small footprint, compatible with Docker size constraints).

### Missing Requirement 7: Currency Conversion API Integration

Tax Prep (US-E11-005) and Income Stabilizer (US-E12) need BTC/USD conversion rates at time of receipt. The `CurrencyService` token exists but implementation status is unknown. If not implemented, this needs a story for integrating a free API (CoinGecko, Kraken).

---

## 7. Risk Register

### Risk 1: External Platform API Availability and Cost -- HIGH

**Description**: The Multi-Platform Hub assumes all 5 platform APIs support posting and reading engagement data. X/Twitter API v2 requires paid access for posting ($100+/month). Threads API has limited third-party support. YouTube quota limits constrain uploads.

**Impact**: EPIC-009 Wave A could be blocked if APIs are not available or affordable.

**Mitigation**: Validate API access and costs in a 1-day spike before starting EPIC-009. Start with free/open protocols (Mastodon, Bluesky) and add paid platforms as optional.

**Owner**: Architect / Product Owner

### Risk 2: Lightning Payment Custodial Design Conflicts -- HIGH

**Description**: Payment splitting (collaborative content) and escrow (marketplace) require Sovren to hold funds temporarily, contradicting the non-custodial philosophy stated in PRD Section 8.4.

**Impact**: Could create regulatory/legal exposure if Sovren becomes a money transmitter. Could also undermine user trust ("I thought Sovren never holds my funds").

**Mitigation**: Design review (ADR) for payment splitting and escrow patterns. Consider: (a) hold invoices with timeout-based release, (b) multi-party payment schemes, (c) explicit user consent for temporary custodial holding, (d) defer marketplace escrow to Phase 10 while design is resolved.

**Owner**: Architect / Security

### Risk 3: NOSTR Protocol Limitations for Group Messaging -- MEDIUM

**Description**: Encrypted group messaging on NOSTR is not standardized. NIP-28 is public channels (not encrypted). NIP-104 group DMs are experimental.

**Impact**: Creator Circles (EPIC-010) messaging may not work as described, or may require a centralized fallback.

**Mitigation**: Implement Supabase-backed group chat with NOSTR identity for v2.0 MVP. Plan migration to pure NOSTR when group encryption NIPs mature.

**Owner**: Backend Team

### Risk 4: Content Scanner Relay Load -- MEDIUM

**Description**: The NOSTR relay content scanner (EPIC-008) will maintain persistent connections to multiple relays and process incoming events. At scale, this creates significant load on both Sovren infrastructure and NOSTR relays.

**Impact**: Performance degradation, potential relay bans, high infrastructure costs.

**Mitigation**: Start with creator-initiated scans (manual "Scan Now" button) rather than continuous scanning. Add opt-in background scanning later with configurable scan frequency and relay selection.

**Owner**: Backend Team

### Risk 5: Scope Creep from 54 Stories -- MEDIUM

**Description**: 54 implementation stories across 6 domains is a large scope. The decomposition targets 8 weeks (with parallelism) but realistic estimates push toward 12-14 weeks.

**Impact**: Delivery timeline doubles, team fatigue, quality degradation on later epics.

**Mitigation**: Strict P0/P1 prioritization. Ship EPIC-007 and EPIC-008 (P0 domains) first. Defer P2/P3 stories in each epic to a "polish" phase. Accept that some features will ship as MVP (e.g., 2 platforms instead of 5 for Multi-Platform Hub).

**Owner**: Product Owner / Team Lead

---

## 8. Recommended Corrections

### Corrections to PRD v2.0

| Section | Issue | Correction |
|---------|-------|------------|
| 8.2 | `routes/v2/` directory exists in architecture but route registration pattern not specified | Add note: "v2 routes registered via `routes/v2/index.ts` barrel and mounted at `/api/v2` prefix in `app.ts`" |
| 8.3 | Missing tables that decomposition adds (`creator_work_patterns`, `contract_templates`, `expenses`, `revenue_forecasts`, `subscriber_health`, `income_milestones`, `repurposed_content`, `service_orders`) | Sync PRD Section 8.3 with full table list from decomposition |
| 8.4 | "Emergency fund is non-custodial" but marketplace escrow and payment splitting require custodial holding | Add paragraph addressing custodial edge cases and the design approach for temporary fund holding |
| 8.5 | Missing: BullMQ as new infrastructure dependency, Redis namespace strategy | Add subsection: "New infrastructure: BullMQ job queue (backed by existing ioredis), worker process management, Bull Board monitoring" |
| 11 | Open question about emergency fund custody (Q4) does not address payment splitting custody | Expand Q4 to include collaborative content payment splitting and marketplace escrow custody |

### Corrections to Epic Decomposition

| Epic | Issue | Correction |
|------|-------|------------|
| Dependency graph | EPIC-008 shown as dependent on EPIC-007 -- it is not | Remove arrow from EPIC-007 → EPIC-008. Both start in parallel. |
| Dependency graph | EPIC-009 shown dependent on EPIC-007 -- it is not | Remove left-branch dependency. EPIC-009 starts after security prereqs only. |
| EPIC-009 | Missing BullMQ infrastructure story | Add US-E9-000: BullMQ Infrastructure Setup (P0-CRITICAL, 3-4 hours) |
| EPIC-009 | Missing AI/LLM dependency for content repurposing | Add note to US-E9-004: specify which AI service (OpenAI, local model, or rule-based) for content adaptation |
| EPIC-010 | Tier is `standard` but involves Lightning escrow | Promote to `enterprise` for security audit of payment flows |
| EPIC-010 | US-E10-006 (9 components, 5 hours) is underestimated | Split into US-E10-006a (Circles + Mentorship UI, 5h), US-E10-006b (Collaboration + Marketplace UI, 5h), US-E10-006c (Navigation integration, 2h) |
| EPIC-011 | Tier is `minimal` but has 7 UI components | Promote to `standard` for frontend agent |
| EPIC-011 | Missing PDF generation dependency | Add note to US-E11-002 and US-E11-003: "Requires pdf-lib or equivalent. Add to package.json." |
| EPIC-012 | US-E12-003 subscriber health scoring requires per-subscriber engagement data not in current schema | Add subtask: "Validate or create subscriber_activity_log table for engagement tracking" |
| EPIC-012 | US-E12-004 emergency fund "withdraw" endpoint is ambiguous re: custodial behavior | Reword: "Record withdrawal event (bookkeeping only -- no fund movement). Creator manages funds in their own wallet." |
| All epics | Missing cross-cutting story for DI container v2 registration | Add US-E0-002 as prerequisite for all backend API stories |
| All epics | Missing cross-cutting story for v2 route registration | Add US-E0-003 as prerequisite for first v2 route implementation |
| Execution plan | Total duration 8 weeks | Revise to 10-12 weeks with corrected parallelism |
| Story count | 54 stories | Revise to ~62 stories (adding infrastructure, navigation, DI, split UI stories) |

### Updated Story Counts

| Epic | Original | Added | Revised Total |
|------|----------|-------|---------------|
| Infrastructure (new) | 0 | 4 (BullMQ, DI, routes, navigation) | 4 |
| EPIC-007 | 10 | 0 | 10 |
| EPIC-008 | 9 | 1 (scanner split) | 10 |
| EPIC-009 | 12 | 1 (BullMQ) | 13 |
| EPIC-010 | 9 | 2 (UI split) | 11 |
| EPIC-011 | 7 | 0 | 7 |
| EPIC-012 | 7 | 1 (engagement data) | 8 |
| **Total** | **54** | **9** | **63** |

---

## Summary

The PRD v2.0 and epic decomposition are **well-structured and generally sound**. The six feature domains directly address validated creator pain points, and the decomposition into 54 implementation stories (revised to ~63) provides actionable work items.

**Key strengths**:
- Feature-domain mapping to research-backed pain points is excellent
- Architecture extensions follow existing monorepo patterns
- Phased delivery with clear gates is well-designed
- Privacy-first approach for wellness data is commendable

**Key changes required before execution**:
1. Fix dependency graph (EPIC-007/008/009 can all start in parallel)
2. Add infrastructure prerequisite stories (BullMQ, DI container, v2 routes, navigation)
3. Promote EPIC-010 to enterprise and EPIC-011 to standard tier
4. Resolve custodial design conflict for payment splitting and marketplace escrow
5. Validate external platform API availability before committing to 5-platform support
6. Split underestimated stories (US-E8-004 scanner, US-E10-006 UI, US-E9-002 OAuth)
7. Revise timeline from 8 weeks to 10-12 weeks

None of these changes block the start of work. The security prerequisite fixes and EPIC-007/EPIC-008 can begin immediately while the dependency graph and tier corrections are applied.
