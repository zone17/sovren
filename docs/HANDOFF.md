# Sovren Project Handoff — 2026-03-30

## What This Project Is

Sovren is a decentralized creator monetization platform built on NOSTR + Bitcoin Lightning. React 18 frontend, Node.js/Express backend, Supabase (PostgreSQL), monorepo with npm workspaces.

**Current state: Closed alpha ready for crypto-native creators.**

## What Just Happened (Sprint March 28-30, 2026)

A massive production readiness sprint executed the full CE loop multiple times:

1. **12-agent audit** found 8 P0, 12 P1, 36+ P2, 17+ P3 across security, frontend, backend, a11y, performance, product/UX
2. **14-unit remediation** across 6 phases executed by 5 parallel agents in 2 worktrees (Squad A + Squad B)
3. **CE Review** caught 1 P0 (NOSTR content hash mismatch) + 5 P1 before merge — all fixed
4. **5-wave re-review** (19 agents) validated fixes: PM 5.8→7.8, Creator 4→7, New User 3→7, WCAG 56%→78%
5. **12-layer CI fix** — actions/cache SHA, ESLint config, npm audit, Trivy, test exclusions, lint errors, test fixes
6. **CE Review enforcement hook** built — deterministic gate blocks `gh pr merge` without `/ce:review`
7. **Full legal compliance** — Terms, Privacy, Content Policy pages with DMCA, CSAM, COPPA, CCPA, GDPR
8. **Retroactive review** of 3 unreviewed PRs found 3 P1 IDOR bypasses — all fixed

**8 PRs merged:** #192, #193, #195, #196, #197, #198, #199, #200

## Repository Layout

```
/Users/fp/Desktop/Sovren          # Base repo — always on main
/Users/fp/Desktop/Sovren-squad-a  # Squad A worktree — feature work
/Users/fp/Desktop/Sovren-squad-b  # Squad B worktree — feature work
```

**Rule: Base repo stays on main forever. All work happens in worktrees.**

## Key File Locations

| File                                                                                        | Purpose                                       |
| ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `CLAUDE.md`                                                                                 | Project rules, architecture, commands         |
| `docs/solutions/patterns/critical-patterns.md`                                              | 26 P1-class patterns (MANDATORY reading)      |
| `docs/solutions/patterns/common-solutions.md`                                               | 135+ P2/P3 patterns                           |
| `docs/plans/2026-03-28-001-fix-full-production-readiness-roadmap-plan.md`                   | Main sprint plan (completed)                  |
| `docs/plans/2026-03-30-001-feat-ce-review-enforcement-hook-plan.md`                         | Hook enforcement plan (completed)             |
| `docs/legal/compliance-checklist-2026-03-28.md`                                             | 29-item legal compliance checklist            |
| `docs/solutions/security-issues/sovren-pra2-jwt-cookie-buffer-wcag-remediation-20260328.md` | Sprint compound doc                           |
| `ci/ts-nocheck-baseline.txt`                                                                | @ts-nocheck ratchet baseline                  |
| `packages/frontend/src/seed/demo-creators.ts`                                               | 8 demo creator profiles for Discover fallback |

## What's Working

- **JWT in HttpOnly cookies** (not localStorage) — SameSite=Strict, Secure in prod/staging
- **NOSTR auth** — kind 22242, createSignatureMessage, timestamp in seconds
- **Buffer.from eliminated** — browser-native hex utils in shared/utils/hex.ts
- **Lightning receipt auth** — authenticate + IDOR on all 6 handlers
- **Token refresh revocation** — old token revoked, role re-read from DB
- **8 demo creators** on Discover page (fallback when API down)
- **5-step onboarding** — Lightning optional, keyboard accessible cards
- **Legal pages** — /terms, /privacy, /help, /content-policy (production-grade, statute citations)
- **Comparison table** — "Why Sovren" vs Patreon/YouTube/Substack on homepage
- **Button 44px** — systemic touch target fix across entire app
- **Skip navigation** — Layout pages have skip-to-main-content
- **Page titles** — useDocumentTitle hook on all pages
- **CE Review enforcement hook** — blocks `gh pr merge` without review (branch-scoped gate)

## What's NOT Working / Known Issues

### Backend Not Running

The backend at `localhost:3001` is not running. This blocks ALL authenticated workflows. Two paths to fix:

1. **Demo mode**: Set `VITE_DEMO_MODE=true` in `packages/frontend/.env` — uses localStorage auth (already implemented in AuthContext.tsx)
2. **Real backend**: `cd packages/backend && npm run dev` — needs Supabase credentials in `.env`

### @ts-nocheck Debt

~140 files with `@ts-nocheck` (was 170, reduced to ~78 in Squad B branch pending merge). Target: <50 for investor milestone.

### TypeScript Errors

`npm run type-check` (root tsc --noEmit) shows ~937 errors. Mostly `@shared/types/` path resolution and stale imports. Per-package type-check works.

### Duplicate Files

~187 macOS Finder duplicates (` 2.ts`, ` 3.ts`) — Squad B is deleting these (branch pending merge).

### CI Flakiness

- Lint/TypeCheck pass on one parallel run, fail on the other (GitHub Actions cache issue)
- Integration tests + DB migration validation need Docker/Supabase (non-blocking in test-gate)
- Some snapshot tests stale from button height change

### Linear Sync

- TaskCreate → Linear: WORKS (subject field fixed)
- TaskUpdate → Linear: IMPROVED (branch-scoped mappings, Squad A branch pending merge)
- Git sync: requires Linear IDs in branch names (e.g., `feat/squad-a/FRE-12-feature-slug`)

## Enforcement Hooks (All Active)

| Hook                      | Event                  | Behavior                                                                                   |
| ------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `security-gate-bash.sh`   | PreToolUse[Bash]       | Blocks destructive commands, enforces /watch-ci gate, enforces CE Review gate before merge |
| `security-gate-files.sh`  | PreToolUse[Edit/Write] | Blocks .env, credentials writes                                                            |
| `branch-discipline.sh`    | PreToolUse[Bash]       | Blocks commits/push on main                                                                |
| `clear-review-gate.sh`    | PostToolUse            | Clears CE Review gate when /ce:review runs                                                 |
| `post-git-actions.sh`     | PostToolUse[Bash]      | Sets /watch-ci + review gates after push/PR/merge                                          |
| `task-sync-linear.sh`     | PostToolUse            | Creates Linear issues from tagged tasks                                                    |
| `phase-detect-context.sh` | UserPromptSubmit       | Detects CE phase, injects branch context                                                   |

## CE Workflow (Mandatory)

```
Plan → Work → Review → Compound
```

- `/ce:plan` before any non-trivial work
- `/ce:work` to execute plans
- `/ce:review` before EVERY merge (hook-enforced)
- `/ce:compound` after every sprint to document learnings

## Scores After Sprint

| Metric           | Before     | After         |
| ---------------- | ---------- | ------------- |
| PM               | 5.8/10     | 7.8/10        |
| Creator (Maya)   | 4/10       | 7/10          |
| New User (Sarah) | 3/10       | 7/10          |
| WCAG AA          | 56%        | ~78%          |
| Troll Resilience | 7.5/10     | 3/10 (harder) |
| Security         | 3 CRITICAL | All resolved  |
| QA               | 63%        | 87%           |

## Remaining Backlog (Prioritized)

### P1 — Unlocks Alpha

1. **Run backend with demo mode** — Set `VITE_DEMO_MODE=true` or start real backend. Unlocks 5/6 UAT workflows.
2. **Merge pending Squad A + B branches** — patterns, stats, onboarding, duplicates, @ts-nocheck. Run `/ce:review` first.

### P2 — Quality

3. **@ts-nocheck < 50** — Investor milestone. Continue tier-by-tier removal.
4. **TypeScript errors** — Fix @shared/ path aliases in root tsconfig, clean up stale imports.
5. **Snapshot test updates** — `vitest --update-snapshots` for button height changes.
6. **Content Policy route** — created in PR #199 but may need route verification on main.

### P3 — Growth Features

7. **Email signup** — Supabase email auth (verification, password reset, session management).
8. **Fiat on-ramp** — Strike/River API integration for credit card → Lightning conversion.
9. **Creator migration tool** — Import from Patreon/Substack/Medium.
10. **Real creator onboarding** — Recruit 10-50 crypto-native creators for alpha.

## Credentials & Config

- **Supabase**: Project ref `pgxpjiarfmsammhwesfx` — credentials in `packages/backend/.env` (gitignored)
- **Linear**: Team `FRE` (Freedom Philosophy) — API key in `~/.config/claude-sync/.env`
- **Telegram**: Bot configured, allowlist locked — token in `~/.claude/channels/telegram/.env`
- **GitHub**: `zone17/sovren` — PRs use squash merge via merge queue
- **Vercel**: Project `prj_D4MFowe8dliwfyYpJEU9SAE5e448` — auto-deploys on main (currently canceled)

## Patterns to Follow

1. **Branch naming**: `{type}/{squad}/{ticket}-{slug}` (e.g., `feat/squad-a/SOV-123-feature`)
2. **Commits**: Conventional format (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`)
3. **Domain-grouped agents**: Non-overlapping file ownership = zero merge conflicts
4. **Merge conflicts**: When resolving rebases with "take theirs", VERIFY route registrations survived
5. **CE Review before merge**: Hook blocks `gh pr merge` unless `/ce:review` ran (any mode)
6. **Post-remediation re-audit**: Always re-audit after bulk fixes — prior sprints found P0s in the fixes
7. **@ts-nocheck removal**: Tiered — security-critical first. Never add `as any`. Track via CI ratchet.
8. **NOSTR events**: kind 22242, content from createSignatureMessage, timestamp in seconds
9. **Buffer replacement**: `Array.from(new Uint8Array(x), b => b.toString(16).padStart(2, '0')).join('')`

## Quick Start for Next Session

```bash
# 1. Check branch
cd /Users/fp/Desktop/Sovren && git branch --show-current  # should be main

# 2. Read memory
cat ~/.claude/projects/-Users-fp/memory/MEMORY.md

# 3. Check pending work
ls ~/.claude/metrics/.review-pending-*  # any pending review gates?
gh pr list --repo zone17/sovren         # any open PRs?

# 4. Start dev server
npm run dev  # frontend on :3000

# 5. Check CI
gh run list --limit 3 --repo zone17/sovren
```
