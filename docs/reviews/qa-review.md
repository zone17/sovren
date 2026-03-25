# QA Review: PRD v2.0 Epic Decomposition Implementation Readiness

**Reviewer**: E2E Testing Specialist / QA
**Date**: 2026-02-12
**Document Reviewed**: `docs/plans/PRD_V2_EPIC_DECOMPOSITION.md`
**Cross-Referenced**: `SOVREN_PRD_V2_CREATOR_EMPOWERMENT.md`, `CLAUDE.md`, `jest.config.elite.ts`, `playwright.config.ts`
**Stories Reviewed**: 54 / 54

---

## 1. Story Quality Scorecard

### EPIC-007: Creator Wellness System (10 stories)

| Rating           | Count | Stories                                                          |
| ---------------- | ----- | ---------------------------------------------------------------- |
| Ready            | 6     | US-E7-001, US-E7-002, US-E7-004, US-E7-007, US-E7-008, US-E7-010 |
| Needs Refinement | 3     | US-E7-003, US-E7-005, US-E7-006                                  |
| Not Ready        | 1     | US-E7-009                                                        |

**Common Issues**:

- US-E7-003 (Burnout Risk Scoring): DoD says "reasonable results against test data" but no test data specification or expected scoring ranges are provided. An agent cannot validate "reasonable" without quantified thresholds.
- US-E7-005 (Scheduling Assistant): Subtask "Connect to existing content scheduling (US-072) infrastructure" is vague. Which service? Which API? The agent needs exact file paths or service names to integrate.
- US-E7-006 (Boundaries Controls): "Auto-responses send via existing NOSTR DM system" — does not specify which NOSTR service handles DMs or how to hook into it. The existing messaging is in US-009; exact integration point needed.
- US-E7-009 (Integration Tests): This is a test story with no DoD at all. It has subtasks but no acceptance criteria for the tests themselves (e.g., what pass rate? what coverage? what browsers?).

---

### EPIC-008: Content Shield (9 stories)

| Rating           | Count | Stories                                               |
| ---------------- | ----- | ----------------------------------------------------- |
| Ready            | 5     | US-E8-001, US-E8-002, US-E8-005, US-E8-007, US-E8-009 |
| Needs Refinement | 3     | US-E8-003, US-E8-004, US-E8-006                       |
| Not Ready        | 1     | US-E8-008                                             |

**Common Issues**:

- US-E8-003 (Fingerprinting): No specification for which SimHash/pHash libraries to use. No accuracy thresholds for similarity matching. An agent would need to make arbitrary library choices.
- US-E8-004 (AI Copy Detection): "Scheduled job: scan NOSTR relay network" — this is a significant infrastructure story hiding inside a feature story. Needs clarity on: which relays? How often? Rate limits? Job queue technology (BullMQ like EPIC-009, or cron?). The DMCA report generator is also a separate concern that could be its own subtask with template specification.
- US-E8-006 (Shield Dashboard): No DoD section at all.
- US-E8-008 (Integration Tests): No DoD section. Same issue as US-E7-009.

---

### EPIC-009: Multi-Platform Hub (12 stories)

| Rating           | Count | Stories                                                          |
| ---------------- | ----- | ---------------------------------------------------------------- |
| Ready            | 6     | US-E9-001, US-E9-002, US-E9-003, US-E9-005, US-E9-008, US-E9-012 |
| Needs Refinement | 4     | US-E9-004, US-E9-006, US-E9-007, US-E9-010                       |
| Not Ready        | 2     | US-E9-009, US-E9-011                                             |

**Common Issues**:

- US-E9-004 (Repurposing Engine): "AI headline/hook suggestions per platform norms" — which AI service? Local model? External API? This needs a technology decision before implementation can start.
- US-E9-006 (Wave A Tests): Security audit subtasks are embedded in a QA story. These should either be separate stories or the agent assignment needs both `qa` and `security-audit` agents with clear ownership of each subtask.
- US-E9-007 (Unified Inbox Backend): "Polling frequency configuration per platform (respect rate limits)" — no specification of what the rate limits are for each platform. Agent will need to research X API, YouTube API, etc. rate limits. This is research work hidden in an implementation story.
- US-E9-009 (Unified Inbox UI): "Real-time updates via WebSocket for new messages" — is there existing WebSocket infrastructure? The decomposition doesn't mention it. If this is new infrastructure, it's underestimated at 3 hours.
- US-E9-010 (Cross-Platform Analytics UI): "AudienceOverlap component — estimated overlap between platforms" — the backend (US-E9-008) does not include an audience overlap endpoint. Frontend depends on data that doesn't exist in the spec.
- US-E9-011 (Wave B Integration Tests): No subtasks, no DoD. Completely empty story — just a title.

---

### EPIC-010: Creator Network (9 stories)

| Rating           | Count | Stories                                        |
| ---------------- | ----- | ---------------------------------------------- |
| Ready            | 4     | US-E10-001, US-E10-002, US-E10-003, US-E10-009 |
| Needs Refinement | 4     | US-E10-004, US-E10-005, US-E10-006, US-E10-008 |
| Not Ready        | 1     | US-E10-007                                     |

**Common Issues**:

- US-E10-004 (Collaborative Content): "Revenue splitting in Lightning payment flow (auto-split incoming payments)" — this is the most technically complex subtask in the entire decomposition. Splitting Lightning payments requires either keysend, multi-path payments, or backend-mediated splits. No technical approach specified. This subtask alone could take 4+ hours.
- US-E10-005 (Creator Marketplace): "Lightning-based escrow for service payments" — escrow contradicts the non-custodial design principle stated in EPIC-012. If Sovren holds funds in escrow, it is custodial. This needs a design decision: is escrow custodial or simulated?
- US-E10-006 (Creator Network UI): 9 components in 5 hours is aggressive (33 minutes per component including tests). Several components (CircleFeed, MarketplaceBrowser) have complex state management needs.
- US-E10-007 (Integration Tests): No subtasks, no DoD. Empty story.
- US-E10-008 (Lightning Payment Split Tests): Good subtasks but no DoD specifying pass criteria.

---

### EPIC-011: Business Manager (7 stories)

| Rating           | Count | Stories                                        |
| ---------------- | ----- | ---------------------------------------------- |
| Ready            | 4     | US-E11-001, US-E11-002, US-E11-003, US-E11-004 |
| Needs Refinement | 2     | US-E11-005, US-E11-006                         |
| Not Ready        | 1     | US-E11-007                                     |

**Common Issues**:

- US-E11-005 (Tax Preparation): "BTC-to-USD conversion rate recording at time of each payment receipt" — which exchange rate API? CoinGecko? Coinbase? This is an external dependency that needs specification.
- US-E11-006 (Business Manager UI): The note acknowledges the minimal tier doesn't include a frontend agent. This is a structural problem — the story exists but the team can't execute it without scope expansion. Decision needed before execution.
- US-E11-007 (Tests & Docs): No subtasks, no DoD. Combines testing and documentation in one story, making it hard for a single agent to own.

---

### EPIC-012: Income Stabilizer (7 stories)

| Rating           | Count | Stories                                        |
| ---------------- | ----- | ---------------------------------------------- |
| Ready            | 4     | US-E12-001, US-E12-003, US-E12-004, US-E12-005 |
| Needs Refinement | 2     | US-E12-002, US-E12-006                         |
| Not Ready        | 1     | US-E12-007                                     |

**Common Issues**:

- US-E12-002 (Revenue Forecasting): "Forecasting algorithm: linear regression on subscriber revenue + seasonal adjustment + content pipeline factor" — no specification of what the seasonal adjustment or content pipeline factor calculations look like. An agent implementing this would need to invent the algorithm. At minimum, provide the regression formula or reference a known approach.
- US-E12-006 (Income Stabilizer UI): "Build on existing PerformancePredictionViewer and GrowthForecastingChart" — good cross-reference, but 7 components in 5 hours is aggressive (43 minutes each).
- US-E12-007 (Tests & Docs): Has subtasks (good) but combines integration tests, E2E tests, Mermaid diagrams, and CHANGELOG into one 2-hour story. This is at least 3-4 hours of work.

---

## 2. Definition of Done Audit

### Rating Scale

- **Strong**: DoD is testable, specific, measurable, covers happy path + errors
- **Adequate**: DoD is testable but missing edge cases or error handling criteria
- **Weak**: DoD is vague, not measurable, or incomplete
- **Missing**: No DoD section exists

### Per-Story DoD Assessment

| Story      | DoD Rating   | Issue                                                                                             |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------- |
| US-E7-001  | **Strong**   | Clear: migration runs, RLS tested, types exported                                                 |
| US-E7-002  | **Strong**   | Good: correct data shapes, auto-tracking works, 95%+ coverage target                              |
| US-E7-003  | **Weak**     | "Reasonable results" is not measurable. Need: specific score ranges for test scenarios            |
| US-E7-004  | **Strong**   | Clear: renders with real/empty states, RTL tested, accessible, integrates as tab                  |
| US-E7-005  | **Adequate** | Testable but missing: error state handling, empty data (new creator with no history)              |
| US-E7-006  | **Adequate** | Mostly specific but "correctly" is vague for notification silencing. Need: specific test scenario |
| US-E7-007  | **Strong**   | Excellent privacy-focused DoD: data isolation, anonymized benchmarks, opt-out respected           |
| US-E7-008  | **Adequate** | Simple but sufficient for a static resource page                                                  |
| US-E7-009  | **Missing**  | No DoD at all                                                                                     |
| US-E7-010  | **Missing**  | No DoD — subtasks serve as implicit DoD but no acceptance criteria                                |
| US-E8-001  | **Missing**  | No DoD section. Has detailed subtasks but no "when is this done?" criteria                        |
| US-E8-002  | **Missing**  | No DoD section                                                                                    |
| US-E8-003  | **Missing**  | No DoD section                                                                                    |
| US-E8-004  | **Missing**  | No DoD section                                                                                    |
| US-E8-005  | **Missing**  | No DoD section                                                                                    |
| US-E8-006  | **Missing**  | No DoD section                                                                                    |
| US-E8-007  | **Missing**  | No DoD section                                                                                    |
| US-E8-008  | **Missing**  | No DoD section                                                                                    |
| US-E8-009  | **Missing**  | No DoD section                                                                                    |
| US-E9-001  | **Missing**  | No DoD section                                                                                    |
| US-E9-002  | **Missing**  | No DoD section                                                                                    |
| US-E9-003  | **Missing**  | No DoD section                                                                                    |
| US-E9-004  | **Missing**  | No DoD section                                                                                    |
| US-E9-005  | **Missing**  | No DoD section                                                                                    |
| US-E9-006  | **Missing**  | No DoD section                                                                                    |
| US-E9-007  | **Missing**  | No DoD section                                                                                    |
| US-E9-008  | **Missing**  | No DoD section                                                                                    |
| US-E9-009  | **Missing**  | No DoD section                                                                                    |
| US-E9-010  | **Missing**  | No DoD section                                                                                    |
| US-E9-011  | **Missing**  | No DoD, no subtasks                                                                               |
| US-E9-012  | **Missing**  | No DoD section                                                                                    |
| US-E10-001 | **Missing**  | No DoD section                                                                                    |
| US-E10-002 | **Missing**  | No DoD section                                                                                    |
| US-E10-003 | **Missing**  | No DoD section                                                                                    |
| US-E10-004 | **Missing**  | No DoD section                                                                                    |
| US-E10-005 | **Missing**  | No DoD section                                                                                    |
| US-E10-006 | **Missing**  | No DoD section                                                                                    |
| US-E10-007 | **Missing**  | No DoD, no subtasks                                                                               |
| US-E10-008 | **Missing**  | No DoD section                                                                                    |
| US-E10-009 | **Missing**  | No DoD section                                                                                    |
| US-E11-001 | **Missing**  | No DoD section                                                                                    |
| US-E11-002 | **Missing**  | No DoD section                                                                                    |
| US-E11-003 | **Missing**  | No DoD section                                                                                    |
| US-E11-004 | **Missing**  | No DoD section                                                                                    |
| US-E11-005 | **Missing**  | No DoD section                                                                                    |
| US-E11-006 | **Missing**  | No DoD section                                                                                    |
| US-E11-007 | **Missing**  | No DoD, no subtasks                                                                               |
| US-E12-001 | **Missing**  | No DoD section                                                                                    |
| US-E12-002 | **Missing**  | No DoD section                                                                                    |
| US-E12-003 | **Missing**  | No DoD section                                                                                    |
| US-E12-004 | **Missing**  | No DoD section                                                                                    |
| US-E12-005 | **Missing**  | No DoD section                                                                                    |
| US-E12-006 | **Missing**  | No DoD section                                                                                    |
| US-E12-007 | **Missing**  | No DoD section                                                                                    |

### Critical Finding

**Only EPIC-007 stories have per-story Definitions of Done.** EPIC-008 through EPIC-012 (44 of 54 stories, 81%) have NO per-story DoD at all. They rely entirely on subtask checklists as implicit acceptance criteria.

The document does include a **global DoD for all epics** (at the bottom), which covers:

- All P0/P1 stories implemented and tested
- Migrations run without errors
- Feature module follows existing patterns
- Mermaid diagrams created
- CHANGELOG updated
- Zero ESLint errors, TypeScript strict
- 95%+ test coverage on services, 85%+ on components
- No regressions
- ADR for architectural decisions

This global DoD is good but insufficient. Each story needs its own testable completion criteria so QA agents know exactly what to verify.

---

## 3. Estimate Validation

### Methodology

Estimates are assessed against agent execution speed: agents write code faster than humans but need clear instructions. Ambiguous stories take longer for agents because they must research and make decisions. Well-specified stories execute close to or under the estimate.

### EPIC-007: Creator Wellness System

**Total Estimated**: 25 hours | **Likely Actual**: 28-32 hours

| Story     | Estimated | Likely | Variance | Reason                                                            |
| --------- | --------- | ------ | -------- | ----------------------------------------------------------------- |
| US-E7-001 | 2h        | 2h     | On track | Well-specified migration work                                     |
| US-E7-002 | 3h        | 3h     | On track | Clear CRUD API + middleware hook                                  |
| US-E7-003 | 3h        | 5h     | +67%     | Algorithm design not specified; agent must invent scoring weights |
| US-E7-004 | 4h        | 5h     | +25%     | 6 components + dashboard integration + responsive                 |
| US-E7-005 | 4h        | 5h     | +25%     | Integration with existing scheduler adds unknown complexity       |
| US-E7-006 | 3h        | 3h     | On track | Straightforward settings CRUD + notification hooks                |
| US-E7-007 | 2h        | 2h     | On track | Simple modal + chart                                              |
| US-E7-008 | 1h        | 1h     | On track | Static content page                                               |
| US-E7-009 | 2h        | 3h     | +50%     | No DoD means agent must determine test scope                      |
| US-E7-010 | 1h        | 1h     | On track | Documentation only                                                |

---

### EPIC-008: Content Shield

**Total Estimated**: 24 hours | **Likely Actual**: 30-36 hours

| Story     | Estimated | Likely | Variance | Reason                                                                                   |
| --------- | --------- | ------ | -------- | ---------------------------------------------------------------------------------------- |
| US-E8-001 | 3h        | 3h     | On track | Clear data model                                                                         |
| US-E8-002 | 3h        | 4h     | +33%     | Cryptographic signing integration with NOSTR events is non-trivial                       |
| US-E8-003 | 3h        | 5h     | +67%     | Library selection + accuracy thresholds unspecified                                      |
| US-E8-004 | 4h        | 7h     | +75%     | NOSTR relay scanning + job queue + DMCA generation — this is 3 stories compressed into 1 |
| US-E8-005 | 3h        | 3h     | On track | UI components with clear mockable data                                                   |
| US-E8-006 | 3h        | 4h     | +33%     | Alert resolution workflow adds UI state complexity                                       |
| US-E8-007 | 2h        | 3h     | +50%     | Integration with existing publish pipeline requires careful backward compat testing      |
| US-E8-008 | 2h        | 3h     | +50%     | No DoD; agent must determine what to test                                                |
| US-E8-009 | 1h        | 1h     | On track | Documentation only                                                                       |

**Significant Risk**: US-E8-004 is the highest-risk story. It combines: scheduled job infrastructure, NOSTR relay network scanning, similarity scoring, alert creation, alert management API, DMCA report generation, and notification integration. This should be split into 2-3 stories.

---

### EPIC-009: Multi-Platform Hub

**Total Estimated**: 38 hours | **Likely Actual**: 50-60 hours

| Story     | Estimated | Likely | Variance | Reason                                                                          |
| --------- | --------- | ------ | -------- | ------------------------------------------------------------------------------- |
| US-E9-001 | 3h        | 3h     | On track | Clear data model with encryption layer                                          |
| US-E9-002 | 4h        | 6h     | +50%     | 4 different OAuth flows (X, YouTube, Bluesky, Mastodon) — each is unique        |
| US-E9-003 | 4h        | 6h     | +50%     | BullMQ setup + 4 platform adapters + retry logic                                |
| US-E9-004 | 4h        | 6h     | +50%     | AI service selection unspecified; image resizing is its own domain              |
| US-E9-005 | 4h        | 5h     | +25%     | 5 complex components with platform-specific previews                            |
| US-E9-006 | 3h        | 4h     | +33%     | Combined QA + security scope                                                    |
| US-E9-007 | 4h        | 6h     | +50%     | Platform polling + message normalization is complex; rate limit research needed |
| US-E9-008 | 3h        | 4h     | +33%     | Platform API metrics polling is fragile; error handling not specified           |
| US-E9-009 | 3h        | 4h     | +33%     | WebSocket infrastructure may not exist; real-time adds complexity               |
| US-E9-010 | 3h        | 4h     | +33%     | AudienceOverlap component depends on missing backend endpoint                   |
| US-E9-011 | 2h        | 3h     | +50%     | No subtasks = agent must define test scope from scratch                         |
| US-E9-012 | 1h        | 1h     | On track | Documentation only                                                              |

**Significant Risk**: This is the most underestimated epic. OAuth integration with 4 different platforms, each with unique APIs, token formats, and rate limits, is notoriously time-consuming. The 38-hour estimate is optimistic; 50-60 hours is more realistic. Consider splitting Wave A into two team-builder runs: one for OAuth + publishing core, one for repurposing + UI.

---

### EPIC-010: Creator Network

**Total Estimated**: 25 hours | **Likely Actual**: 32-38 hours

| Story      | Estimated | Likely | Variance | Reason                                                      |
| ---------- | --------- | ------ | -------- | ----------------------------------------------------------- |
| US-E10-001 | 3h        | 3h     | On track | Standard data model                                         |
| US-E10-002 | 3h        | 4h     | +33%     | NOSTR encrypted group messaging adds crypto complexity      |
| US-E10-003 | 3h        | 3h     | On track | CRUD with matching algorithm                                |
| US-E10-004 | 3h        | 6h     | +100%    | Lightning payment splitting is significantly underestimated |
| US-E10-005 | 3h        | 5h     | +67%     | Escrow design contradiction needs resolution first          |
| US-E10-006 | 5h        | 7h     | +40%     | 9 components in 5 hours is unrealistic                      |
| US-E10-007 | 2h        | 3h     | +50%     | No subtasks                                                 |
| US-E10-008 | 2h        | 2h     | On track | Well-defined payment tests                                  |
| US-E10-009 | 1h        | 1h     | On track | Documentation only                                          |

**Significant Risk**: US-E10-004 (Collaborative Content) depends on EPIC-008 provenance AND introduces Lightning payment splitting — both are technically challenging. The 3-hour estimate should be 6-8 hours minimum.

---

### EPIC-011: Business Manager

**Total Estimated**: 21 hours | **Likely Actual**: 25-30 hours

| Story      | Estimated | Likely | Variance | Reason                                                 |
| ---------- | --------- | ------ | -------- | ------------------------------------------------------ |
| US-E11-001 | 2h        | 2h     | On track | Standard data model                                    |
| US-E11-002 | 3h        | 4h     | +33%     | Red flag analyzer rule engine needs specification      |
| US-E11-003 | 3h        | 3h     | On track | CRUD with Lightning invoice integration                |
| US-E11-004 | 2h        | 2h     | On track | Straightforward calculation endpoints                  |
| US-E11-005 | 3h        | 4h     | +33%     | Exchange rate API integration unspecified              |
| US-E11-006 | 5h        | 7h     | +40%     | Team tier mismatch — no frontend agent in minimal tier |
| US-E11-007 | 2h        | 3h     | +50%     | No subtasks; combined test + docs                      |

---

### EPIC-012: Income Stabilizer

**Total Estimated**: 20 hours | **Likely Actual**: 26-32 hours

| Story      | Estimated | Likely | Variance | Reason                                                                  |
| ---------- | --------- | ------ | -------- | ----------------------------------------------------------------------- |
| US-E12-001 | 2h        | 2h     | On track | Standard data model                                                     |
| US-E12-002 | 4h        | 6h     | +50%     | Regression algorithm unspecified; forecast accuracy tracking is complex |
| US-E12-003 | 3h        | 4h     | +33%     | Churn scoring algorithm needs specification                             |
| US-E12-004 | 2h        | 2h     | On track | Simple tracking CRUD                                                    |
| US-E12-005 | 2h        | 2h     | On track | Straightforward milestones                                              |
| US-E12-006 | 5h        | 7h     | +40%     | 7 components with chart integrations                                    |
| US-E12-007 | 2h        | 4h     | +100%    | Combines tests + diagrams + CHANGELOG; underestimated                   |

### Estimate Summary

| Epic      | Estimated | Likely Range | Variance         |
| --------- | --------- | ------------ | ---------------- |
| EPIC-007  | 25h       | 28-32h       | +12% to +28%     |
| EPIC-008  | 24h       | 30-36h       | +25% to +50%     |
| EPIC-009  | 38h       | 50-60h       | +32% to +58%     |
| EPIC-010  | 25h       | 32-38h       | +28% to +52%     |
| EPIC-011  | 21h       | 25-30h       | +19% to +43%     |
| EPIC-012  | 20h       | 26-32h       | +30% to +60%     |
| **Total** | **153h**  | **191-228h** | **+25% to +49%** |

---

## 4. Test Strategy Assessment

### Existing Test Infrastructure

| Component                     | Status     | Count                                                                                                                                  |
| ----------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Jest unit tests (backend)     | Mature     | ~80+ test files                                                                                                                        |
| Jest unit tests (frontend)    | Mature     | ~60+ test files                                                                                                                        |
| Jest integration tests        | Mature     | ~12 integration test files                                                                                                             |
| Jest E2E tests (backend-only) | Good       | 3 E2E workflow tests                                                                                                                   |
| Playwright config             | Configured | Full config with 10 projects (Chromium, Firefox, WebKit, Mobile Safari, iPad, Mobile Chrome, Galaxy Tab, High DPI, Dark Mode, Slow 3G) |
| Playwright E2E tests          | Not found  | 0 actual test files in `packages/frontend/e2e/`                                                                                        |
| Security tests                | Referenced | Referenced in npm scripts but not audited                                                                                              |
| Accessibility tests           | Referenced | Referenced in npm scripts but not audited                                                                                              |

**Key Finding**: The Playwright configuration is comprehensive (10 browser/device projects, setup/cleanup lifecycle, video/screenshot/trace on failure), but there are **zero actual Playwright E2E test files** in the `e2e/` directory. The infrastructure is ready but empty.

### Test Types Needed Per Epic

#### EPIC-007: Creator Wellness

| Test Type         | Stories                                               | Notes                                                                          |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Unit tests        | US-E7-002, US-E7-003, US-E7-005, US-E7-006, US-E7-007 | Burnout scoring algorithm needs extensive unit tests with known inputs/outputs |
| Integration tests | US-E7-002, US-E7-003, US-E7-005                       | Auto-tracking middleware, burnout score recalculation on pattern change        |
| E2E (Playwright)  | US-E7-004, US-E7-005, US-E7-006                       | Dashboard rendering, boundary controls, scheduling assistant                   |
| Accessibility     | US-E7-004, US-E7-008                                  | Dashboard and resource library ARIA compliance                                 |

#### EPIC-008: Content Shield

| Test Type         | Stories                                    | Notes                                                                      |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| Unit tests        | US-E8-002, US-E8-003, US-E8-004            | Cryptographic signing, fingerprint generation, similarity scoring          |
| Integration tests | US-E8-002, US-E8-003, US-E8-004, US-E8-007 | Provenance chain creation, fingerprint-on-publish, copy detection workflow |
| E2E (Playwright)  | US-E8-005, US-E8-006                       | Badge rendering, shield dashboard, DMCA report generation UI               |
| Security tests    | US-E8-002, US-E8-007                       | Signing integrity, key management, backward compatibility                  |

**Special consideration**: US-E8-004 (AI Copy Detection) needs a test NOSTR relay or relay mock to test scanning without hitting real relays.

#### EPIC-009: Multi-Platform Hub

| Test Type                     | Stories                                    | Notes                                                       |
| ----------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| Unit tests                    | US-E9-003, US-E9-004, US-E9-007, US-E9-008 | Platform adapters, repurposing logic, message normalization |
| Integration tests             | US-E9-002, US-E9-003, US-E9-006            | OAuth flow, publishing queue with retry, token refresh      |
| E2E (Playwright)              | US-E9-005, US-E9-009, US-E9-010            | Platform connector UI, unified inbox, analytics dashboard   |
| Security tests                | US-E9-001, US-E9-002, US-E9-006            | Token encryption, OAuth CSRF, no token leakage              |
| **New infrastructure needed** | US-E9-002                                  | Mock OAuth servers for X, YouTube, Bluesky, Mastodon        |
| **New infrastructure needed** | US-E9-003                                  | BullMQ test configuration with in-memory Redis or mock      |
| **New infrastructure needed** | US-E9-007                                  | Platform API response mocks for inbox polling               |

**Special consideration**: This epic has the highest test infrastructure cost. Mock OAuth servers for 4 platforms and a BullMQ test harness are prerequisite work not captured in any story.

#### EPIC-010: Creator Network

| Test Type                     | Stories                                        | Notes                                                                 |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| Unit tests                    | US-E10-002, US-E10-003, US-E10-004, US-E10-005 | Circle logic, mentorship matching, revenue splitting                  |
| Integration tests             | US-E10-004, US-E10-005, US-E10-008             | Lightning payment splitting, escrow hold/release                      |
| E2E (Playwright)              | US-E10-006                                     | Circle browser, mentorship dashboard, marketplace                     |
| Security tests                | US-E10-002                                     | NOSTR encrypted group message verification                            |
| **New infrastructure needed** | US-E10-004                                     | Lightning payment splitting test harness (mock multi-output payments) |

**Special consideration**: US-E10-008 (Lightning Payment Split Tests) is well-defined with edge cases. This is one of the better test stories in the decomposition.

#### EPIC-011: Business Manager

| Test Type                     | Stories                                        | Notes                                                                       |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| Unit tests                    | US-E11-002, US-E11-003, US-E11-004, US-E11-005 | Red flag rules, invoice calculations, revenue breakdown, tax categorization |
| Integration tests             | US-E11-003, US-E11-005                         | Invoice-Lightning payment link generation, BTC-USD conversion               |
| E2E (Playwright)              | US-E11-006                                     | Contract library, invoice dashboard, tax summary                            |
| **New infrastructure needed** | US-E11-005                                     | Mock currency conversion API (rate snapshots for deterministic tests)       |

#### EPIC-012: Income Stabilizer

| Test Type                     | Stories                                        | Notes                                                                          |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| Unit tests                    | US-E12-002, US-E12-003, US-E12-004, US-E12-005 | Forecasting algorithm, churn scoring, fund allocation, milestone detection     |
| Integration tests             | US-E12-002, US-E12-003, US-E12-004             | Forecast refresh job, churn updates on engagement change, fund auto-allocation |
| E2E (Playwright)              | US-E12-006                                     | Revenue forecast chart, subscriber health, emergency fund dashboard            |
| **New infrastructure needed** | US-E12-002                                     | Time-series test data factory for deterministic forecast testing               |

### Coverage Targets Per Epic

Per the existing `jest.config.elite.ts` and `CLAUDE.md`:

- Services/repositories/store: **95% minimum**
- Global: **85% minimum**
- New code: **95%+ required**

These targets are already defined and should apply to all v2.0 code. No changes needed to coverage configuration.

### Missing Test Infrastructure (Pre-Requisite Work)

The following test infrastructure is **not captured in any story** but is required:

1. **Mock OAuth Server Suite** (EPIC-009): Mock implementations for X, YouTube, Bluesky, and Mastodon OAuth flows. Without these, OAuth integration tests cannot be reliable.

2. **BullMQ Test Harness** (EPIC-009): In-memory job queue for testing cross-platform publishing without Redis dependency.

3. **NOSTR Relay Mock** (EPIC-008, EPIC-010): Mock relay for testing provenance publishing, copy detection scanning, and encrypted group messaging without live relays.

4. **Lightning Payment Split Mock** (EPIC-010): Extension to existing `createMockLightningService()` to support multi-output payment splitting.

5. **Currency Conversion Mock** (EPIC-011): Mock API returning deterministic BTC/USD rates for tax calculation tests.

6. **Time-Series Data Factory** (EPIC-012): Test data generator for creating realistic revenue/subscriber time-series data for forecast testing.

7. **Playwright E2E Test Scaffolding**: The Playwright config exists but has zero test files. Page Object Model classes, test fixtures, and authentication setup need to be created before any E2E story can execute.

**Recommendation**: Add a new story (or modify the pre-requisite section) to create this shared test infrastructure before team-builder execution begins. Estimated: 4-6 hours.

---

## 5. Implementation Readiness Verdict

### EPIC-007: Creator Wellness System — NEEDS MINOR FIXES

**Readiness: 80%**

Strengths:

- Best DoD coverage of all epics (7 of 10 stories have per-story DoD)
- Clear data model and API specifications
- Reasonable estimates for most stories
- Good integration test story (US-E7-009) with specific E2E scenarios

Required Fixes:

1. US-E7-003: Replace "reasonable results" with specific score thresholds for test scenarios
2. US-E7-005: Specify exact integration point for existing content scheduling
3. US-E7-006: Specify which NOSTR DM service handles auto-responses
4. US-E7-009: Add a DoD section with pass criteria, browser targets, and coverage goals

---

### EPIC-008: Content Shield — NEEDS MINOR FIXES

**Readiness: 70%**

Strengths:

- Clear provenance chain design
- Good separation of signing, fingerprinting, and detection concerns
- Provenance auto-signing integration (US-E8-007) is well-scoped

Required Fixes:

1. **All 9 stories need per-story DoD sections** (currently none)
2. US-E8-003: Specify fingerprinting library and similarity thresholds
3. US-E8-004: Split into 2-3 smaller stories (scanner job, alert management, DMCA generation)
4. US-E8-004: Specify job queue technology and relay scanning strategy
5. US-E8-008: Add DoD and specify browser targets for E2E tests

---

### EPIC-009: Multi-Platform Hub — NOT READY

**Readiness: 50%**

Strengths:

- Good wave-based splitting (A: publishing, B: inbox/analytics)
- Enterprise tier correctly identified for OAuth security
- BullMQ specified for job queue

Critical Gaps:

1. **All 12 stories need per-story DoD sections** (currently none)
2. US-E9-002: OAuth flows for 4 platforms in 4 hours is significantly underestimated
3. US-E9-004: AI service for content repurposing not specified
4. US-E9-007: Rate limits per platform not specified — this is research work hidden in implementation
5. US-E9-009: WebSocket infrastructure assumption not verified
6. US-E9-010: AudienceOverlap component depends on backend endpoint that doesn't exist in US-E9-008
7. US-E9-011: Completely empty story (no subtasks, no DoD)
8. Missing: No story for mock OAuth server test infrastructure
9. Missing: No story for BullMQ test harness setup
10. Estimates need +50% adjustment across the board

---

### EPIC-010: Creator Network — NEEDS MINOR FIXES

**Readiness: 65%**

Strengths:

- Good data model design
- US-E10-008 (Lightning Payment Split Tests) is one of the best test stories in the decomposition
- Reasonable scope per story (except US-E10-006)

Required Fixes:

1. **All 9 stories need per-story DoD sections** (currently none)
2. US-E10-004: Specify Lightning payment splitting technical approach (keysend? backend-mediated?)
3. US-E10-005: Resolve escrow custodial vs. non-custodial contradiction
4. US-E10-006: Increase estimate from 5h to 7-8h or reduce component count
5. US-E10-007: Add subtasks and DoD

---

### EPIC-011: Business Manager — NEEDS MINOR FIXES

**Readiness: 70%**

Strengths:

- Clean CRUD feature set — well-suited for agent execution
- Good separation of concerns (contracts, invoices, revenue, tax)
- Minimal tier is appropriate for backend scope

Required Fixes:

1. **All 7 stories need per-story DoD sections** (currently none)
2. US-E11-005: Specify exchange rate API provider
3. US-E11-006: Resolve team tier mismatch (minimal tier has no frontend agent)
4. US-E11-007: Split into separate test and documentation stories, add subtasks

---

### EPIC-012: Income Stabilizer — NEEDS MINOR FIXES

**Readiness: 70%**

Strengths:

- Good non-custodial design clearly documented for emergency fund
- Builds on existing analytics components (referenced by name)
- US-E12-007 has specific subtasks (better than other epics' test stories)

Required Fixes:

1. **All 7 stories need per-story DoD sections** (currently none)
2. US-E12-002: Specify regression algorithm formula or approach reference
3. US-E12-006: Increase estimate from 5h to 7h
4. US-E12-007: Increase estimate from 2h to 4h (covers tests + diagrams + CHANGELOG)

---

## 6. Recommended Changes

### Priority 1: Fix Before Any Execution (Blocking)

#### 6.1 Add Per-Story DoD to EPIC-008 through EPIC-012

44 of 54 stories (81%) lack per-story Definitions of Done. This is the single biggest gap in the decomposition. Without story-level DoD, agents cannot verify their own work, and QA agents cannot know what to test.

**Action**: For each story without a DoD, add a section following this template:

```markdown
**Definition of Done**:

- [ ] [Specific testable criterion 1]
- [ ] [Specific testable criterion 2]
- [ ] [Error handling criterion]
- [ ] Tests pass with [coverage target]
```

**Effort**: 2-3 hours to add DoDs to all 44 stories.

#### 6.2 Split US-E8-004 (AI Copy Detection Scanner)

This 4-hour story contains 3 distinct features:

1. NOSTR relay scanning job (infrastructure + scheduled task)
2. Alert management API (CRUD + notification integration)
3. DMCA report generator (template + provenance data assembly)

**Action**: Split into US-E8-004a (Scanner Job, 3h), US-E8-004b (Alert API, 2h), US-E8-004c (DMCA Generator, 2h).

#### 6.3 Resolve EPIC-009 Gaps

- Add `AudienceOverlap` endpoint to US-E9-008 backend spec
- Add subtasks and DoD to US-E9-011
- Verify WebSocket infrastructure exists or add it to US-E9-009 estimate
- Specify AI service for content repurposing in US-E9-004

#### 6.4 Resolve EPIC-010 Custodial Contradiction

US-E10-005 (Creator Marketplace) specifies "Lightning-based escrow" which is custodial. EPIC-012 and PRD section 8.4 state "Sovren never holds creator funds." These are in direct conflict.

**Action**: Choose one:

- Option A: Multi-sig escrow (non-custodial but complex, add 4+ hours)
- Option B: Honor-system escrow (track allocations, not hold funds — simpler but weaker protection)
- Option C: Remove escrow from MVP, use direct payment with dispute resolution

### Priority 2: Fix Before Epic Execution (Recommended)

#### 6.5 Add Shared Test Infrastructure Story

Add a new pre-requisite story (between P1 security fixes and EPIC-007):

```markdown
#### US-PRE-002: Shared Test Infrastructure for v2.0

**Priority**: P0-CRITICAL
**Agent**: qa
**Dependencies**: None
**Estimated Time**: 5 hours

**Subtasks**:

- [ ] Create Playwright Page Object Model base classes and auth fixtures
- [ ] Create mock OAuth server factory for platform integration tests
- [ ] Extend createMockLightningService() with multi-output payment splitting
- [ ] Create BullMQ in-memory test harness
- [ ] Create NOSTR relay mock for provenance and encrypted messaging tests
- [ ] Create mock currency conversion API
- [ ] Create time-series test data factory for forecast testing
- [ ] Verify Playwright e2e/ directory has global-setup.ts and global-teardown.ts

**Definition of Done**:

- [ ] All mock services have TypeScript interfaces matching production services
- [ ] Playwright auth setup creates and stores authenticated sessions
- [ ] All mocks are importable from @test-utils/ path
- [ ] README in test-utils/ documents all available mocks
```

#### 6.6 Increase EPIC-009 Estimates

Current total: 38 hours. Recommended: 55-60 hours.

Specific adjustments:

- US-E9-002: 4h -> 6h (4 different OAuth flows)
- US-E9-003: 4h -> 6h (BullMQ + 4 platform adapters)
- US-E9-004: 4h -> 6h (AI service selection + image processing)
- US-E9-007: 4h -> 6h (rate limit research + polling infrastructure)

#### 6.7 Specify Algorithm Details

Three stories require algorithmic specification before agents can implement them:

1. **US-E7-003** (Burnout Risk Scoring): Provide scoring weights, thresholds for low/moderate/high/critical, and at least 3 test scenarios with expected outputs.

2. **US-E12-002** (Revenue Forecasting): Specify the regression formula, seasonal adjustment calculation, and how "content pipeline factor" is quantified.

3. **US-E12-003** (Subscriber Health): Specify churn probability calculation inputs, weights, and threshold for "at-risk" classification.

#### 6.8 Fix EPIC-011 Team Tier Mismatch

US-E11-006 (Business Manager UI) has 7 components and is assigned to a `minimal` tier team-builder run that does not include a frontend agent. Options:

- **Option A** (Recommended): Promote EPIC-011 to `standard` tier. Cost: ~$3 more.
- **Option B**: Run a follow-up `/team-builder minimal` for frontend only.
- **Option C**: Have the backend agent build simple CRUD forms (acceptable quality but slower).

### Priority 3: Nice to Have

#### 6.9 Add Error Handling to Subtask Lists

Most subtask lists cover only happy paths. The following stories would benefit from explicit error-handling subtasks:

- US-E9-002: "Handle OAuth token revocation by platform"
- US-E9-003: "Handle platform API downtime gracefully (queue retry, user notification)"
- US-E10-004: "Handle co-author key unavailable for signing"
- US-E11-003: "Handle Lightning invoice expiration before payment"
- US-E12-002: "Handle insufficient data for forecast (< 2 weeks of history)"

#### 6.10 Cross-Reference PRD Acceptance Criteria

Several implementation stories are not explicitly linked to PRD acceptance criteria:

- US-E7-001, US-E7-002, US-E7-003 have no PRD Story reference
- US-E8-001 has no PRD Story reference
- US-E9-001 has no PRD Story reference
- US-E10-001 has no PRD Story reference
- US-E11-001 has no PRD Story reference
- US-E12-001 has no PRD Story reference

These are all data model stories, which is understandable (they don't map to user-facing stories), but it would be helpful to note "Supports: US-2XX" for traceability.

---

## Appendix: Story-by-Story Quick Reference

| Story ID   | Epic | Priority | DoD?     | Estimate OK?  | Verdict          |
| ---------- | ---- | -------- | -------- | ------------- | ---------------- |
| US-E7-001  | 007  | P0       | Strong   | Yes           | Ready            |
| US-E7-002  | 007  | P0       | Strong   | Yes           | Ready            |
| US-E7-003  | 007  | P1       | Weak     | Under by 67%  | Needs Refinement |
| US-E7-004  | 007  | P1       | Strong   | Under by 25%  | Ready            |
| US-E7-005  | 007  | P1       | Adequate | Under by 25%  | Needs Refinement |
| US-E7-006  | 007  | P1       | Adequate | OK            | Needs Refinement |
| US-E7-007  | 007  | P2       | Strong   | OK            | Ready            |
| US-E7-008  | 007  | P3       | Adequate | OK            | Ready            |
| US-E7-009  | 007  | P1       | Missing  | Under by 50%  | Not Ready        |
| US-E7-010  | 007  | P2       | Missing  | OK            | Ready            |
| US-E8-001  | 008  | P0       | Missing  | OK            | Ready            |
| US-E8-002  | 008  | P0       | Missing  | Under by 33%  | Ready            |
| US-E8-003  | 008  | P1       | Missing  | Under by 67%  | Needs Refinement |
| US-E8-004  | 008  | P1       | Missing  | Under by 75%  | Needs Refinement |
| US-E8-005  | 008  | P1       | Missing  | OK            | Ready            |
| US-E8-006  | 008  | P1       | Missing  | Under by 33%  | Needs Refinement |
| US-E8-007  | 008  | P0       | Missing  | Under by 50%  | Ready            |
| US-E8-008  | 008  | P1       | Missing  | Under by 50%  | Not Ready        |
| US-E8-009  | 008  | P2       | Missing  | OK            | Ready            |
| US-E9-001  | 009  | P0       | Missing  | OK            | Ready            |
| US-E9-002  | 009  | P0       | Missing  | Under by 50%  | Ready            |
| US-E9-003  | 009  | P0       | Missing  | Under by 50%  | Ready            |
| US-E9-004  | 009  | P1       | Missing  | Under by 50%  | Needs Refinement |
| US-E9-005  | 009  | P1       | Missing  | Under by 25%  | Ready            |
| US-E9-006  | 009  | P0       | Missing  | Under by 33%  | Needs Refinement |
| US-E9-007  | 009  | P1       | Missing  | Under by 50%  | Needs Refinement |
| US-E9-008  | 009  | P1       | Missing  | Under by 33%  | Ready            |
| US-E9-009  | 009  | P1       | Missing  | Under by 33%  | Not Ready        |
| US-E9-010  | 009  | P1       | Missing  | Under by 33%  | Needs Refinement |
| US-E9-011  | 009  | P1       | Missing  | Under by 50%  | Not Ready        |
| US-E9-012  | 009  | P2       | Missing  | OK            | Ready            |
| US-E10-001 | 010  | P0       | Missing  | OK            | Ready            |
| US-E10-002 | 010  | P1       | Missing  | Under by 33%  | Ready            |
| US-E10-003 | 010  | P1       | Missing  | OK            | Ready            |
| US-E10-004 | 010  | P1       | Missing  | Under by 100% | Needs Refinement |
| US-E10-005 | 010  | P2       | Missing  | Under by 67%  | Needs Refinement |
| US-E10-006 | 010  | P1       | Missing  | Under by 40%  | Needs Refinement |
| US-E10-007 | 010  | P1       | Missing  | Under by 50%  | Not Ready        |
| US-E10-008 | 010  | P0       | Missing  | OK            | Needs Refinement |
| US-E10-009 | 010  | P2       | Missing  | OK            | Ready            |
| US-E11-001 | 011  | P0       | Missing  | OK            | Ready            |
| US-E11-002 | 011  | P1       | Missing  | Under by 33%  | Ready            |
| US-E11-003 | 011  | P1       | Missing  | OK            | Ready            |
| US-E11-004 | 011  | P1       | Missing  | OK            | Ready            |
| US-E11-005 | 011  | P2       | Missing  | Under by 33%  | Needs Refinement |
| US-E11-006 | 011  | P1       | Missing  | Under by 40%  | Needs Refinement |
| US-E11-007 | 011  | P1       | Missing  | Under by 50%  | Not Ready        |
| US-E12-001 | 012  | P0       | Missing  | OK            | Ready            |
| US-E12-002 | 012  | P0       | Missing  | Under by 50%  | Needs Refinement |
| US-E12-003 | 012  | P1       | Missing  | Under by 33%  | Ready            |
| US-E12-004 | 012  | P1       | Missing  | OK            | Ready            |
| US-E12-005 | 012  | P2       | Missing  | OK            | Ready            |
| US-E12-006 | 012  | P1       | Missing  | Under by 40%  | Needs Refinement |
| US-E12-007 | 012  | P1       | Missing  | Under by 100% | Not Ready        |

### Summary Counts

| Verdict          | Count  | Percentage |
| ---------------- | ------ | ---------- |
| Ready            | 27     | 50%        |
| Needs Refinement | 20     | 37%        |
| Not Ready        | 7      | 13%        |
| **Total**        | **54** | **100%**   |

### Overall Assessment

The epic decomposition is a strong foundation with good architecture and clear story structure. The **primary gap is missing Definitions of Done** in 81% of stories (EPIC-008 through EPIC-012). The secondary gap is **underestimated time** for algorithmically complex stories and multi-platform OAuth integration.

**Before starting team-builder execution**, the following must be addressed:

1. Add per-story DoD to all 44 stories missing them (~2-3 hours of refinement work)
2. Split US-E8-004 into 2-3 stories
3. Resolve escrow custodial contradiction in EPIC-010
4. Add shared test infrastructure pre-requisite story
5. Increase EPIC-009 estimates by ~50%

Once these 5 items are resolved, all epics move to **READY** status and team-builder execution can begin.
