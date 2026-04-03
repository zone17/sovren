---
date: 2026-03-31
topic: quality-sprint-backlog-burndown
---

# Quality Sprint: Backlog Burndown

## Problem Frame

Sovren's closed alpha is functionally ready for crypto-native creators, but the codebase carries accumulated quality debt that weakens the investor story, clutters CI, and slows future development. This sprint clears all remaining maintenance items before growth features begin.

## Requirements

**Filesystem Hygiene**

- R1. Delete all Finder duplicate files (files with " 2" or " 3" in the name) from the base repo. These are untracked macOS artifacts that pollute grep results and confuse tooling.

**Dependency Security**

- R2. Triage and merge Dependabot PR #194 (35 production dependency bumps). Review each bump for breaking changes before merging. Revert any that break CI.
- R3. Close or merge the 6 stale dependabot PRs (#148-152, #166). Close any superseded by #194. Rebase and merge any still-relevant ones.

**CI Green on Main**

- R4. Fix the DB migration failure (`20260323000003_fix_creator_id_text_to_uuid.sql`). The migration fails because `platform_connections.creator_id` has RLS policy dependencies. Use `DROP ... CASCADE` or drop policies before column change, then re-create.

**Email Compliance**

- R5. Configure email routing for dmca@sovren.app, privacy@sovren.app, abuse@sovren.app. Generate required DNS records (MX or forwarding). User applies DNS changes manually.

**Type Safety**

- R6. Reduce @ts-nocheck from 45 to <40 (clean 6+ more files). Priority targets: route files, wellness services, remaining NOSTR services. File-by-file approach per established pattern.

**Production Readiness**

- R7. Replace WebhookService.makeHttpRequest stub with a real HTTP client (fetch/undici). The current implementation returns hardcoded `{status: 200}` for all webhook deliveries. Must support timeouts, error handling, and retry-compatible responses.

## Success Criteria

- Zero Finder duplicate files in packages/
- Dependabot PR #194 merged or closed with documented reasoning per bump
- All 6 stale dependabot PRs resolved (merged or closed)
- DB migration validation passes in CI (main goes green on that job)
- Email routing DNS records generated and documented
- @ts-nocheck count < 40 (ratchet updated)
- WebhookService.makeHttpRequest makes real HTTP requests with proper error handling
- All existing tests continue to pass

## Scope Boundaries

- No growth features (email signup, fiat on-ramp, creator migration) — deferred to next sprint
- No new features — this is pure quality/maintenance
- Email routing: we generate DNS records + docs, user applies them to domain provider
- DB migration fix should not change application logic — schema-only

## Key Decisions

- **Quality before growth**: Solidify the codebase before building on top of it. Growth features start next sprint on a clean foundation.
- **File-by-file @ts-nocheck**: Bulk removal proven to fail (documented pattern). Continue tiered file-by-file approach.
- **Close stale dependabot PRs**: PRs older than 2 weeks are likely superseded by #194. Close with comment rather than attempting rebase.

## Squad Assignment Strategy

Two squads work in parallel with zero file overlap:

- **Squad A**: Infrastructure + Dependencies (R1, R2, R3, R4, R5) — filesystem, npm, CI, DNS
- **Squad B**: Code Quality (R6, R7) — TypeScript type safety, service implementation

## Outstanding Questions

### Deferred to Planning

- [Affects R4][Needs research] What RLS policies depend on `platform_connections.creator_id`? Need to inspect the migration and dependent policies to determine CASCADE safety.
- [Affects R5][Technical] Which email forwarding service to use — Cloudflare Email Routing, ImprovMX, or simple MX forwarding? Depends on domain provider capabilities.
- [Affects R6][Technical] Which 6+ files are the best targets for @ts-nocheck removal? Need error-count triage similar to the approach used in PR #212.
- [Affects R7][Needs research] Should WebhookService use Node.js native `fetch` (Node 18+) or `undici` directly? Need to check the project's Node version and existing HTTP patterns.

## Next Steps

`/ce:plan` for structured implementation planning with squad assignments and team-builder configs.
