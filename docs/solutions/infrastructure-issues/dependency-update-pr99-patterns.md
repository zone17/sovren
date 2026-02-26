---
title: Dependency Update Patterns — PR #99 (65+ Packages, Docker, Actions)
date: '2026-02-26'
category: infrastructure-issues
tags: [dependencies, npm, docker, github-actions, react-query, nostr-tools, supabase]
module: monorepo
severity: P1/P2
symptoms:
  - 1541 test failures after npm update (React 19 hoisting)
  - Slack notifications silently fail after action version bump
  - Cryptographic library version fragmentation across workspaces
  - npm lockfile keeps stale per-workspace resolutions
related_prs: ['#99']
---

# Dependency Update Patterns — PR #99

## Problem Statement

Updating 65+ dependencies across an npm workspaces monorepo surfaced 4 non-obvious failure modes. Each was invisible at the time of the change and would have caused production issues without detection.

## Root Causes & Solutions

### 1. React 19 Hoisting via Transitive Peer Dependencies

**Symptom:** After `npm update`, frontend tests went from passing to **1,541 failures** with:

```
Objects are not valid as a React child
```

**Root cause:** Radix UI and other packages declared `peerDependencies: { "react": "^18 || ^19" }`. When npm resolved transitive dependencies, it hoisted React 19.2.4 to `node_modules/react/` at root, while the frontend's `package.json` still declared `^18.3.1`. Two React instances coexisted — hooks broke silently.

**Fix:** Add explicit overrides in root `package.json`:

```json
"overrides": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

**Detection:** Run tests immediately after `npm update`. React version conflicts manifest as mass test failures, not build errors.

**Prevention:** Always add override pins for framework packages (React, Vue, Angular) when the ecosystem has split peer dependency ranges across major versions.

---

### 2. Slack GitHub Action v2 Silent Parameter Rename

**Symptom:** No error during CI. Deployment and rollback Slack notifications **silently stopped working**.

**Root cause:** `slackapi/slack-github-action@v2` renamed the `webhook-url` input to `webhook`. The action accepts unknown inputs without error — it simply ignores them. The `ci.yml` was already on v2 with `webhook:`, but `backend-deployment.yml` and `automated-rollback.yml` still used `webhook-url`.

**Broken (v1 param on v2 action):**

```yaml
uses: slackapi/slack-github-action@v2
with:
  webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }} # silently ignored
```

**Fixed:**

```yaml
uses: slackapi/slack-github-action@v2
with:
  webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Detection:** 4 of 8 review agents flagged this independently. Manual testing would NOT catch it — the action succeeds with exit code 0 even when no webhook is called.

**Prevention:** When bumping GitHub Action major versions, always check the action's release notes for renamed inputs. Search the repo for ALL usages of the action (`grep -r "uses: slackapi/slack-github-action"`) — partial migration across workflow files is the common failure mode.

---

### 3. npm Workspace Version Fragmentation via Lockfile Staleness

**Symptom:** After aligning all 4 `package.json` files to `nostr-tools: ^2.23.1`, the lockfile still resolved backend and frontend to `2.23.0` while root/shared got `2.23.1`.

**Root cause:** npm's lockfile preserves per-workspace resolutions even when the declared range changes. `npm install` and `npm update` do not force re-resolution of workspace packages if the existing resolved version still satisfies the range (`^2.23.1` is satisfied by 2.23.1, but the stale 2.23.0 was from the old `^2.23.0` range and npm didn't re-resolve).

**Fix:** Add an override to root `package.json` to force a single version:

```json
"overrides": {
  "nostr-tools": "2.23.1"
}
```

Then delete the lockfile and regenerate: `rm package-lock.json && npm install`.

**Why this matters for nostr-tools specifically:** Version fragmentation in a cryptographic library that handles event signing and verification can cause events signed by one workspace to fail verification in another (recall PR #92 P1: `id: ''` made `verifyEvent` always fail).

**Prevention:** For security-critical libraries (crypto, auth, payment), always use npm overrides to pin a single version across all workspaces. Verify with:

```bash
grep -B1 '"version":' package-lock.json | grep -A1 'nostr-tools'
```

---

### 4. Dead Code Migration — Modifying Code Nobody Imports

**Symptom:** 4 of 8 review agents independently flagged that `packages/frontend/src/queries/queryClient.ts` is **never imported** anywhere. The entire Phase 1 migration (cacheTime → gcTime, keepPreviousData → placeholderData) modified dead code.

**Root cause:** The real `QueryClient` lives in `main.tsx` (lines 22-37) with different configuration. The `queryClient.ts` file was an earlier implementation that was never wired in. No grep or import analysis was done before modifying it.

**Detection method:**

```bash
# Check if a module is imported anywhere
grep -rn "from.*queries/queryClient" packages/frontend/src/ --include="*.ts" --include="*.tsx"
# Returns nothing → dead code
```

**Prevention:** Before modifying any file in a dependency migration:

1. Verify it has at least one importer
2. For config/singleton files, trace the import chain to the app entry point
3. If dead, either delete it or skip modification — don't create a false sense of coverage

---

## Investigation Timeline

| Step | Action                                              | Result                                       |
| ---- | --------------------------------------------------- | -------------------------------------------- |
| 1    | Phase 1: Migrate React Query APIs in queryClient.ts | Committed (later found to be dead code)      |
| 2    | Phase 2: `npm update` for 65+ packages              | React 19 hoisted → 1,541 test failures       |
| 3    | Add React 18 overrides                              | Tests recovered to 2,613 pass                |
| 4    | Phase 3a-c: Supabase, Tiptap, Docker/Actions        | All clean                                    |
| 5    | Push PR #99, run 8-agent review                     | Found P1 Slack, P2 nostr-tools, P2 dead code |
| 6    | Fix P1 + P2s, regenerate lockfile                   | All resolved                                 |
| 7    | Merge to main                                       | Commit 18afcb8                               |

## Cross-References

- **common-solutions.md #37**: Math.random in crypto context
- **common-solutions.md #38**: Fire-and-forget async in cleanup
- **critical-patterns.md #9**: NOSTR verifyEvent requires computed ID (related to nostr-tools version sensitivity)
- **critical-patterns.md #10a**: Cross-package dedup (related to nostr-tools override pattern)
- PR #92: `isValidSignature()` P1 — nostr-tools version sensitivity precedent
- PR #98: @shared/\* import convention — related monorepo consistency work
