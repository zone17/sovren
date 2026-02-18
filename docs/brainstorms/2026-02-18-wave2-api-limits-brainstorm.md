---
topic: Wave 2 API Rate Limits Resolution
date: 2026-02-18
status: decided
participants: [user, claude]
related_epics: [EPIC-009-B, EPIC-010, EPIC-011, EPIC-012]
---

# Wave 2 API Rate Limits Resolution

## Context

PRD v2.0 Section 11 listed 6 open questions. During Phase 1 implementation, 5 were resolved via ADRs and implementation decisions. The remaining question — **multi-platform API rate limits and costs** — directly impacts EPIC-009 Wave B (Unified Inbox + Cross-Platform Analytics).

## What We're Deciding

How Sovren handles per-platform API constraints for continuous inbox polling, analytics fetching, and cross-posting across X/Twitter, YouTube, Bluesky, Mastodon, and Threads.

## Research Findings

### Per-Platform Rate Limits (as of Feb 2026)

| Platform  | Read Limits                                                   | Write Limits          | Cost                      | Source                                                                                     |
| --------- | ------------------------------------------------------------- | --------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| X/Twitter | Free: NO reads. Basic ($200/mo): 15K reads/mo, 15-min windows | Free: 1,500 tweets/mo | $200/mo minimum for reads | [X API Rate Limits](https://docs.x.com/x-api/fundamentals/rate-limits)                     |
| YouTube   | 10,000 units/day free. Comments.list = 1 unit                 | Higher cost per unit  | Free (10K units/day)      | [YouTube Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)  |
| Bluesky   | 5,000 pts/hr, 35K pts/day, 3K calls/5min                      | Same pool             | Free                      | [Bluesky Rate Limits](https://docs.bsky.app/docs/advanced-guides/rate-limits)              |
| Mastodon  | 300 req/5min per authenticated user                           | 30 media/30min        | Free (per-instance)       | [Mastodon Rate Limits](https://docs.joinmastodon.org/api/rate-limits/)                     |
| Threads   | 500 search/7 days; 5M embed req/24h                           | Part of general pool  | Free                      | [Threads API Docs](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api) |

### Critical Finding

X/Twitter is the **only platform requiring a paid tier** ($200/mo Basic) for any read access. All other platforms offer generous free tiers that easily accommodate Sovren's use case.

## Key Decisions

### Decision 1: X/Twitter — Creator BYOK (Bring Your Own Key)

**Choice**: Creator provides their own X API key (Basic tier, $200/mo) for read access.

**Rationale**:

- Zero platform cost to Sovren (no scaling problem)
- Creators who pay get full inbox + analytics for X
- Creators who don't pay still get **write-only** (post to X via Sovren, no inbox polling)
- Encrypted storage in existing `platform_connections` table (AES-256 + RLS)
- Aligns with Sovren's decentralization ethos (creator owns their API access)

**UX Flow**:

1. Creator connects X account via OAuth (gets write access)
2. Sovren prompts: "For full inbox and analytics, enter your X API key (requires Basic plan, $200/mo)"
3. If key provided: full inbox + analytics enabled
4. If skipped: write-only mode, badge shows "Upgrade for full X integration"

### Decision 2: Adaptive Polling Frequency

**Choice**: 5-minute polling when creator session is active, 30-minute when idle.

**Rate Budget** (per creator, worst case: 16 hrs active + 8 hrs idle):

- Active: 192 polls/day + Idle: 16 polls/day = **208 polls/day**

| Platform  | Daily Capacity  | Polls/Day | Headroom  |
| --------- | --------------- | --------- | --------- |
| X/Twitter | ~500/day        | 208       | 59% spare |
| YouTube   | 10,000/day      | 208       | 98% spare |
| Bluesky   | 35,000/day      | 208       | 99% spare |
| Mastodon  | ~86,400/day     | 208       | 99% spare |
| Threads   | ~714/day (est.) | 208       | 71% spare |

All platforms fit comfortably with room for analytics queries.

**Implementation**: Existing BullMQ `inbox-poll` queue (3 workers, fixed 30s backoff) will be adapted:

- Add `poll_interval` field to `platform_connections` table
- BullMQ repeatable job per creator-platform pair
- Session activity tracked via last API request timestamp
- Switch interval when session transitions active <-> idle

### Decision 3: Threads API Verification Needed

**Choice**: Implement Threads inbox polling with standard endpoints. Verify that the 500/7-day limit applies only to search queries (not user timeline/reply reads) during EPIC-009B implementation.

**Mitigation**: If Threads general API is more restrictive than expected, fall back to 15-min fixed polling for Threads only.

## Summary of All 6 PRD Open Questions (Final Status)

| #   | Question                    | Decision                                                       | Reference          |
| --- | --------------------------- | -------------------------------------------------------------- | ------------------ |
| 1   | Multi-platform API limits   | BYOK for X ($200/mo creator-paid), adaptive 5min/30min polling | This brainstorm    |
| 2   | Fingerprinting scope        | Text (SimHash) + Images (pHash) from day one. Video deferred   | ADR-020            |
| 3   | Creator Circle size         | Flexible 5-20 via max_members. Organic growth                  | Epic decomposition |
| 4   | Emergency fund custody      | Non-custodial bookkeeping only                                 | ADR-021            |
| 5   | Revenue forecasting model   | Simple linear regression (OLS). ML deferred                    | Epic decomposition |
| 6   | Contract template licensing | Legal-reviewed templates + red flag analyzer                   | Epic decomposition |

## Impact on Wave 2 Epics

### EPIC-009 Wave B (Unified Inbox + Analytics)

- Add BYOK X API key flow to platform connection settings
- Implement adaptive polling via BullMQ repeatable jobs
- Write-only fallback for X creators without API key
- Verify Threads endpoint limits during implementation

### EPIC-010 (Creator Network)

- No API limit impact (NOSTR-native, no external platform polling)

### EPIC-011 (Business Manager)

- No API limit impact (internal data only)

### EPIC-012 (Income Stabilizer)

- Cross-platform analytics (US-E12 subscriber health) uses same polling infrastructure
- Rate budgets already account for analytics queries alongside inbox polling

## Open Questions (for implementation)

1. Should Sovren validate the creator's X API key on entry (test read call) or defer to first use?
2. Threads API: confirm whether `GET /user/threads` and `GET /user/replies` count against the 500/7-day search limit or have separate limits

## Next Step

Run `/workflows:plan` to create Wave 2 implementation plan incorporating these decisions.
