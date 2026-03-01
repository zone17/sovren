---
title: 'Vite Rollup treeshake moduleSideEffects:false strips entire React app'
category: build-errors
severity: P1
module: frontend/vite-config
tags: [vite, rollup, treeshake, production-build, blank-page, ci-e2e]
symptoms:
  - 'Production build JS chunks are 1 byte (empty)'
  - 'Blank white page in production / CI preview'
  - 'E2E tests timeout waiting for page elements'
  - "Build succeeds (no errors) but app doesn't render"
  - 'CSS generates correctly but all JS chunks are empty'
root_cause: 'rollupOptions.treeshake.moduleSideEffects set to false'
date: 2026-03-01
prs: ['#112', '#113', '#114', '#115', '#116']
related_patterns: ['common-solutions#26', 'common-solutions#64', 'common-solutions#62']
---

# Vite Rollup treeshake: moduleSideEffects:false Strips Entire React App

## Problem

Production build produces a blank white page. Build completes with zero errors ("3123 modules transformed"), dist directory exists, index.html is correct, CSS is fine — but **every JS chunk is 1 byte (empty)**. The app never renders.

## Symptoms

- `npm run build` succeeds with no warnings
- `dist/assets/js/*.js` files are all 1 byte
- Entry file only contains the modulepreload polyfill (~711 bytes)
- CSS file is normal size (~139kb)
- `vite preview` serves a blank white page
- Playwright E2E tests timeout on any element selector
- Local dev server (`npm run dev`) works perfectly (masks the issue)

## Root Cause

```typescript
// vite.config.ts — rollupOptions
treeshake: {
  moduleSideEffects: false,    // THE BUG
  propertyReadSideEffects: false,
  unknownGlobalSideEffects: false,
},
```

`moduleSideEffects: false` tells Rollup that **no module has side effects**. This means:

1. `import './index.css'` — Rollup thinks this is dead code (no named exports used), removes it
2. `import React from 'react'` — If React is only used in JSX (which compiles to `React.createElement`), Rollup may drop it
3. `ReactDOM.createRoot(root).render(<App />)` — The entire render call chain gets tree-shaken because Rollup believes none of the imported modules produce side effects
4. All `manualChunks` packages (react, redux, router, etc.) are considered side-effect-free and emptied

The result: every chunk becomes empty, the entry file retains only the modulepreload polyfill (injected by Vite, not by Rollup), and the app is a blank page.

**Why it wasn't caught earlier**: Local E2E tests run against `npm run dev` (Vite dev server), NOT the production build. The dev server doesn't apply Rollup's production treeshaking, so the app works perfectly in development.

## Investigation Steps

1. **CI E2E screenshots** showed a completely blank/white page
2. **Build output** showed success (3123 modules, dist created)
3. **Preview server** started and responded with HTML
4. Checked `dist/assets/js/` — all chunks were 1 byte
5. Entry JS was 711 bytes (only modulepreload polyfill)
6. CSS was normal (139kb) — confirmed CSS pipeline was fine
7. Identified `treeshake.moduleSideEffects: false` as the culprit

## Solution

Replace the aggressive treeshake config with Rollup's defaults:

```typescript
// vite.config.ts — rollupOptions
// BEFORE (broken):
treeshake: {
  moduleSideEffects: false,
  propertyReadSideEffects: false,
  unknownGlobalSideEffects: false,
},

// AFTER (fixed):
treeshake: true,
```

`treeshake: true` uses Rollup's default settings which respect `sideEffects` fields in package.json and preserve imports that have observable side effects.

## Additional CI Fixes (PRs #112-#115)

This fix (PR #116) was the final piece. The E2E pipeline required 5 PRs total:

| PR   | Fix                                        | Why                                                                 |
| ---- | ------------------------------------------ | ------------------------------------------------------------------- |
| #112 | `npm ci --include=dev` in vercel.json      | `NODE_ENV=production` skipped devDependencies (vite, plugins)       |
| #112 | 9 GitHub secrets wired to E2E job          | Supabase + test credentials for real auth                           |
| #113 | Removed `continue-on-error: true` from E2E | Made E2E a hard gate                                                |
| #114 | `VITE_SUPABASE_URL/KEY` in Build step env  | Vite inlines `VITE_*` at **build time**, not runtime                |
| #115 | Skip `webServer` in CI                     | Playwright was starting dev server, conflicting with preview server |
| #116 | `treeshake: true`                          | **This fix** — empty JS bundles                                     |

## Key Insight: Build-Time vs Runtime Environment Variables

Vite's `VITE_*` environment variables are **statically replaced at build time** via `import.meta.env.*`. They must be present during `npm run build`, not just at runtime. This is different from Node.js's `process.env` which is read at runtime.

```yaml
# CI: VITE_ vars must be in the Build step, not just E2E step
- name: Build frontend
  run: npm run build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }} # Inlined at build time
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

## Prevention

### 1. Never set `moduleSideEffects: false` globally

This setting is only safe for specific modules you've verified are pure. For a React app, most modules have side effects (CSS imports, DOM manipulation, event listeners, polyfills).

If you need per-module control:

```typescript
treeshake: {
  moduleSideEffects: (id) => {
    // Only mark specific utility modules as side-effect-free
    if (id.includes('pure-utils')) return false;
    return true; // Default: assume side effects
  },
},
```

### 2. Validate production build output in CI

Add a chunk size check after build:

```yaml
- name: Verify build output
  run: |
    test -d packages/frontend/dist || exit 1
    test -f packages/frontend/dist/index.html || exit 1
    # Verify JS chunks are non-empty
    EMPTY_CHUNKS=$(find packages/frontend/dist/assets/js -name '*.js' -size -10c | wc -l)
    if [ "$EMPTY_CHUNKS" -gt 5 ]; then
      echo "ERROR: $EMPTY_CHUNKS JS chunks are nearly empty — treeshake may be too aggressive"
      exit 1
    fi
```

### 3. Test E2E against production build locally

```bash
npm run build && npx vite preview --port 4173 &
E2E_BASE_URL=http://localhost:4173 npx playwright test
```

### 4. Local dev server masks production issues

The Vite dev server does NOT apply Rollup's production optimizations (treeshaking, minification, chunk splitting). Always verify the production build before assuming the app works.

## Detection Rule

```bash
# Check for moduleSideEffects: false in vite/rollup configs
grep -r "moduleSideEffects.*false" vite.config.* rollup.config.* 2>/dev/null
# Check for empty JS chunks in dist
find dist/assets/js -name '*.js' -size -10c 2>/dev/null | head -5
```

## Cross-References

- [PR #111 CI/CD Pipeline Zero Failures](../infrastructure-issues/pr111-cicd-pipeline-zero-failures-20260228.md)
- [E2E Mock Elimination — POM Rewrite](../test-failures/e2e-mock-elimination-pom-rewrite-20260224.md)
- [Common Solutions #26 — E2E Must Not Mock API](../patterns/common-solutions.md)
- [Common Solutions #62 — Per-Package tsc](../patterns/common-solutions.md)
- [Common Solutions #64 — Advisory CI Jobs](../patterns/common-solutions.md)
- [Rollup treeshake docs](https://rollupjs.org/configuration-options/#treeshake)
