# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sovren** is an elite-level decentralized creator monetization platform built on the NOSTR protocol and Bitcoin Lightning Network. The platform empowers creators with true ownership of their content, audience relationships, and revenue streams.

**Status**: Elite Engineering Achievement (99/100 quality score, 94% type safety improvement, 100% test success rate)

## Technology Stack

- **Frontend**: React 18.3.1 + TypeScript 5.3 + Vite + TailwindCSS
- **Backend**: Node.js + TypeScript (in development)
- **State Management**: Redux Toolkit + React Query
- **Protocols**: NOSTR (via nostr-tools), Bitcoin Lightning Network
- **Database/Auth**: Supabase
- **Deployment**: Vercel (frontend), Docker (backend)
- **Testing**: Vitest + React Testing Library + Playwright
- **Monorepo**: npm workspaces

## Essential Commands

### Development

```bash
# Install dependencies
npm install

# Start frontend dev server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific project tests
npm run test:unit              # Backend, frontend, shared
npm run test:integration       # Integration tests (requires Docker — uses testcontainers)
npm run test:e2e              # Playwright E2E tests
npm run test:e2e:ui           # E2E tests with UI
npm run test:security         # Security tests
npm run test:a11y             # Accessibility tests

# Run single test file
npx vitest run path/to/test.test.ts
```

**Prerequisites for integration tests:**

- Docker Desktop (or Docker Engine) must be running for `test:integration`
- Testcontainers auto-pulls `postgres:16-alpine` and `redis:7-alpine`
- First run downloads ~150MB of container images
- Set `TESTCONTAINERS_RYUK_DISABLED=true` if Docker API connectivity issues occur

### Code Quality

```bash
# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check

# Type checking
npm run type-check

# Full quality check
npm run quality:check
npm run quality:full
```

### Docker Operations (Backend)

```bash
# Frontend package has docker scripts
cd packages/frontend
npm run docker:build
npm run docker:start
npm run docker:stop
npm run docker:logs
npm run docker:status
```

## Architecture Overview

### Monorepo Structure

```
packages/
├── frontend/          # React app with elite feature-based architecture
├── backend/           # Node.js API server
├── shared/            # Shared types, utilities, configs
└── testing/           # Shared testing utilities
```

### Frontend Architecture (Feature-Based Design)

**Critical Pattern**: The frontend uses a **feature-based modular architecture** where code is organized by business domain rather than technical type.

```
src/
├── features/                    # Domain-driven feature modules
│   ├── auth/                   # Authentication & authorization
│   │   ├── components/         # Auth-specific UI
│   │   ├── services/          # AuthContext, auth logic
│   │   ├── types/             # Auth type definitions
│   │   └── index.ts           # Barrel exports
│   ├── content/               # Content management (CMS)
│   ├── analytics/             # AI-powered analytics
│   ├── dashboard/             # Monitoring dashboards
│   └── [feature]/             # Each feature is self-contained
├── shared/                    # Cross-cutting concerns
│   ├── utils/                # Universal utilities
│   ├── constants/            # App-wide constants
│   └── types/               # Global type definitions
├── components/ui/             # Generic reusable UI components
├── store/                     # Redux store (slices by feature)
├── hooks/                     # Shared React hooks
├── services/                  # API clients, external integrations
└── pages/                     # Route-level components

Path Aliases:
@/             → src/
@components/   → src/components/
@pages/        → src/pages/
@hooks/        → src/hooks/
@services/     → src/services/
@types/        → src/types/
@utils/        → src/utils/
@store/        → src/store/
```

**Key Principle**: When adding new features, create a self-contained feature module with its own components, services, types, and tests. Export through barrel files (`index.ts`) for clean imports.

### Backend Architecture

Located in `packages/backend/src/`:

- `services/` - Business logic and service layer
- `repositories/` - Data access layer
- `routes/` - API endpoint definitions
- `middleware/` - Express middleware
- `utils/` - Backend utilities

### NOSTR & Lightning Integration

**NOSTR Protocol**: The platform uses NOSTR for decentralized identity and content distribution

- Keys managed via browser extensions (Alby, nos2x) or manual input
- Events published to multiple relays for redundancy
- NIP-05 verification for identity
- Encrypted DMs using NOSTR protocol

**Lightning Network**: Direct creator monetization with minimal fees

- BOLT11 invoice generation
- WebLN support for wallet connections
- Payment verification and subscription management
- Transaction history tracking

### Playwright E2E Testing

E2E tests live in `packages/frontend/e2e/` and run against the real app (zero `page.route()` mocks).

**Structure:**

```
e2e/
├── pages/                  # Page Object Models (one per page)
│   ├── home.page.ts
│   ├── login.page.ts
│   ├── signup.page.ts
│   ├── profile.page.ts
│   └── layout.page.ts     # Shared nav/layout locators
├── fixtures/
│   └── test-credentials.ts    # Centralized credentials with env var fallbacks
├── auth.setup.ts              # Playwright setup project — real login, saves storage state
├── auth.public.spec.ts        # Auth flow tests (no stored state — tests auth itself)
├── home.public.spec.ts        # Public page tests (no auth needed)
├── navigation.auth.spec.ts    # Authenticated nav tests (uses stored state)
├── wellness.auth.spec.ts      # Authenticated wellness tests
├── global-setup.ts            # Creates auth dir
└── global-teardown.ts         # Cleans auth dir
```

**3-tier Playwright config** (`playwright.config.ts`):

1. **setup** — Runs `auth.setup.ts`, saves storage state to `test-results/.auth/creator.json`
2. **chromium-authenticated** — Uses saved storage state for tests needing auth
3. **chromium-public** — No auth, for public pages and auth flow tests

**Auth setup chain:**

1. `global-setup.ts` creates `test-results/.auth/` directory
2. **setup** project runs `auth.setup.ts` — logs in via `LoginPage` POM with `CREATOR_CREDENTIALS`, saves storage state to `test-results/.auth/creator.json`
3. **chromium-authenticated** project depends on setup, injects saved storage state into every `*.auth.spec.ts` test
4. **chromium-public** project has no dependency — runs `*.public.spec.ts` tests without auth
5. `global-teardown.ts` cleans up the `.auth/` directory

**Available credentials** (`e2e/fixtures/test-credentials.ts`):

| Export                | Purpose                    | Used by                         |
| --------------------- | -------------------------- | ------------------------------- |
| `CREATOR_CREDENTIALS` | Primary authenticated user | `auth.setup.ts` (storage state) |
| `TEST_USER`           | Secondary login testing    | `auth.public.spec.ts`           |
| `SIGNUP_USER`         | Registration flow testing  | `auth.public.spec.ts`           |

All support env var overrides (e.g. `E2E_CREATOR_EMAIL`).

**POM template:**

```typescript
import type { Locator, Page } from '@playwright/test';

export class ExamplePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Page Title' }).first();
  }

  async goto() {
    await this.page.goto('/example');
  }

  async someAction() {
    await this.heading.click();
  }
}
```

**When building new features, agents MUST:**

1. Create a Page Object in `e2e/pages/{page}.page.ts` following the POM template above
2. Add E2E spec with convention-based naming — no config changes needed:
   - Needs auth: `{name}.auth.spec.ts` (auto-matched by `chromium-authenticated` project)
   - Public page: `{name}.public.spec.ts` (auto-matched by `chromium-public` project)
3. Import credentials from `e2e/fixtures/test-credentials.ts` — never hardcode
4. Use `beforeEach` to instantiate POMs and navigate — avoid repeating setup in every test
5. Run `npm run test:e2e` and verify all tests pass before marking work complete

**Conventions:**

- Use Page Object Model pattern for all pages
- Use web-first assertions (`toBeVisible`, `toHaveURL`) — never `waitForTimeout`
- Use role-based locators — never CSS selectors or test IDs
- One spec file per page/feature, one POM per page
- Add `.first()` in the POM constructor for any locator that may match multiple elements (e.g. logo, headings); Playwright strict mode throws at runtime if a locator resolves to more than one element
- Centralize all locators in POMs — no raw `page.getByText()` calls in spec files
- Import order: `@playwright/test` first, then local imports
- E2E tests run in CI post-build against the production bundle via `vite preview`

**Commands:**

```bash
npm run test:e2e                    # Run all E2E tests (demo auth, no backend)
npm run test:e2e:ui                 # Run with Playwright UI
npm run test:e2e:debug              # Run in debug mode
USE_BACKEND=1 npm run test:e2e      # Start real backend + frontend; real auth (not demo redirect)
```

## Required Reading for All Agents

Before writing any code in this repository, read these canonical pattern files:

- **`docs/solutions/patterns/critical-patterns.md`** — 8 P1-class patterns (TOCTOU, auth, pagination, atomic writes, SSRF, status guards, payment persistence, test infrastructure integration). Extracted from 50+ P1 findings across 7 sprints. **Violating these patterns WILL produce P1 review findings.**
- **`docs/solutions/patterns/common-solutions.md`** — P2/P3-class patterns covering double-submit, TTLCache, env validation, error format, E2E testing, SSRF, Vitest, git hooks, and more. Prevents re-inventing solutions already established across prior sprints.

These files are the single source of truth. Sprint-specific docs in `docs/solutions/` provide historical context but the patterns files are the canonical reference.

## Critical Development Standards

### Documentation Requirements (MANDATORY)

**Every code change MUST include documentation updates**. This is enforced in CI/CD.

1. **Mermaid Diagrams**: ALL user story implementations MUST include:
   - Architecture Overview Diagram
   - Component Interaction Diagram
   - Data Flow Diagram
   - Process Flow Diagram
   - Implementation-specific diagrams (as needed)

2. **Mermaid Diagram Linking**: All diagrams must be:
   - Saved as `.mmd` files in `/docs/architecture/diagrams/`
   - Linked with visual rendering: `![Name](github.com/owner/repo/blob/main/path/to/diagram.mmd)`
   - Provided in multiple formats (GitHub visual, interactive editor, source)

3. **CHANGELOG.md**: Every commit requires a CHANGELOG entry with:
   - Type prefix (feat:, fix:, docs:, refactor:, test:, chore:)
   - Clear description of changes
   - Reference to user story/issue
   - Breaking changes noted

4. **Architecture Decision Records**: Document in `/docs/decisions/` (ADR format)

### Code Quality Gates (Zero Tolerance)

All code changes must pass these gates before merge:

**Pre-Commit:**

- Zero ESLint errors/warnings
- Code formatted with Prettier
- Unit tests passing
- Documentation complete
- Mermaid diagrams validated

**CI/CD Pipeline:**

- Integration tests passing
- Security scans clean (no high/critical vulnerabilities)
- Performance benchmarks met
- Test coverage ≥ 95% for critical paths (services, repositories, store)
- Test coverage ≥ 85% globally

**Code Review:**

- Minimum 1 approving review
- Architecture review for significant changes
- All Mermaid diagrams present and clear
- Documentation reviewed

### TypeScript Standards

**Strict Mode**: The project uses `strict: true` with comprehensive type safety

- Eliminate all `any` types
- Use proper type definitions, not type assertions
- Prefer interfaces over types for object shapes
- Use barrel exports (`index.ts`) for clean imports
- Maintain 94%+ type coverage

### Testing Standards (TDD Required)

**Write tests BEFORE implementation** (Red-Green-Refactor cycle)

Coverage Requirements:

- Services/repositories/store: 95% minimum
- Global: 85% minimum
- New code: 95%+ required

Test Structure:

```typescript
// Feature-specific test patterns
describe('Feature Name', () => {
  describe('Component/Function Name', () => {
    it('should handle specific behavior', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

Use the multi-project Vitest configuration (`vitest.config.ts`):

- Frontend tests: jsdom environment
- Backend tests: node environment
- Shared tests: node environment

Vitest notes:

- Use `vi.fn()`, `vi.mock()`, `vi.spyOn()` (not `jest.*`)
- `vi.mock()` factories hoist differently — use `vi.hoisted()` for class declarations in mock factories
- `vi.importActual()` returns a Promise (must `await`)
- Use `import { Enum }` not `import type { Enum }` for runtime enum values (esbuild strips `import type`)
- Cap workers with `maxForks: 2` to prevent OOM on machines with <32GB RAM

### Git Workflow

**Conventional Commits** (mandatory):

```
<type>: <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

**Every commit must**:

- Include CHANGELOG.md update
- Include documentation updates
- Pass pre-commit hooks (lint, format, test, docs)
- Reference issue/ticket in footer

### Branching & Merge Strategy

**Read before starting any work:** [docs/development/BRANCHING_STRATEGY.md](docs/development/BRANCHING_STRATEGY.md)

- **Trunk-based development.** All merges to `main` use auto-merge with required CI checks. No `--admin` bypass except hotfix lane.
- **Branch naming:** `{type}/{squad}/{ticket}-{slug}` (e.g., `feat/squad-a/SOV-123-payment-webhooks`)
- **One epic per branch.** Multi-epic branches produce 3x more review findings.
- **Shared package changes** go in a separate PR before consumer changes. See [SHARED_PACKAGE_PROTOCOL.md](docs/development/SHARED_PACKAGE_PROTOCOL.md).
- **Hotfixes:** Follow [HOTFIX_PROCEDURE.md](docs/development/HOTFIX_PROCEDURE.md).
- **Merge command:** `gh pr merge --auto --squash` (auto-merges when CI + reviews pass).
- Each branch gets its own `/workflows:review` cycle.

## Common Workflows

### Adding a New Feature

1. **Create Feature Module**:

   ```bash
   mkdir -p packages/frontend/src/features/my-feature/{components,services,types}
   ```

2. **Design with Mermaid Diagrams** (BEFORE coding):
   - Create all required diagrams in `/docs/architecture/diagrams/`
   - Get design review approval

3. **Write Tests First** (TDD):

   ```typescript
   // src/features/my-feature/__tests__/MyFeature.test.tsx
   describe('MyFeature', () => {
     it('should...', () => {
       // Write failing test
     });
   });
   ```

4. **Implement Feature**:

   ```typescript
   // src/features/my-feature/types/index.ts
   export interface MyFeatureData {
     /* ... */
   }

   // src/features/my-feature/services/useMyFeature.ts
   export const useMyFeature = () => {
     /* ... */
   };

   // src/features/my-feature/components/MyFeatureComponent.tsx
   export const MyFeatureComponent = () => {
     /* ... */
   };

   // src/features/my-feature/index.ts
   export * from './components';
   export * from './services';
   export type * from './types';
   ```

5. **Update Documentation**:
   - CHANGELOG.md
   - Feature documentation in `/docs/features/`
   - ADR if architectural decision made

6. **Verify Quality Gates**:

   ```bash
   npm run quality:check
   npm run test:coverage
   ```

7. **Deploy & Validate** (MANDATORY - Post Epic 006):

   ```bash
   # Create PR with deployment checklist
   gh pr create --title "feat(US-XXX): Feature description"

   # Wait for CI/CD checks to pass
   gh pr checks

   # Merge to main (triggers staging deployment)
   gh pr merge --auto --squash

   # Monitor staging deployment
   gh run watch

   # Verify staging health
   curl https://api-staging.sovren.dev/health

   # Validate deployment successful
   npm run test:smoke
   ```

   **Story NOT complete until**:
   - ✅ CI/CD quality gates passing
   - ✅ Staging deployment successful
   - ✅ Health checks passing
   - ✅ Smoke tests passing (28/28)

   Reference: [Deployment Integration Standards](docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md)

### Working with NOSTR

Key imports and patterns:

```typescript
import { SimplePool, Event, getPublicKey, getEventHash, signEvent } from 'nostr-tools';

// Event creation pattern
const event: Event = {
  kind: 1, // Text note
  pubkey: userPublicKey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'Message content',
};
```

Relay configuration is in shared package configuration.

### Building for Production

The Vite build uses advanced optimizations:

- Manual chunk splitting (14 chunks for optimal caching)
- esbuild minification with tree shaking
- Gzip + Brotli compression
- PWA support with service worker
- Bundle size limits: JS chunks <250kb, CSS <50kb

Build artifacts:

```
dist/
├── assets/
│   ├── js/         # Code chunks
│   ├── css/        # Stylesheets
│   ├── images/     # Optimized images
│   └── fonts/      # Web fonts
└── index.html      # Entry point
```

## Key Project Files

- `@project-rules.mdc` - Core project rules (11 Commandments of Elite Engineering)
- `@ways-of-working.mdc` - Development workflow standards
- `.cursorrules` - AI assistant configuration with elite standards
- `docs/quality-gates.md` - Comprehensive quality gate definitions
- `SOVREN_PRD.md` - Product requirements and user stories
- `CHANGELOG.md` - Complete change history

## Important Constraints

1. **NOSTR Protocol Compliance**: All content events must follow NOSTR standards (NIPs)
2. **Lightning Payments**: Use BOLT11 for invoices, verify payments before granting access
3. **Mobile-First**: All UI must be responsive and touch-optimized
4. **Performance**: Core Web Vitals must meet thresholds (LCP <2.5s, FID <100ms, CLS <0.1)
5. **Security**: No private keys stored on server, all auth uses NOSTR keys or Supabase
6. **Docker**: Backend services must be containerized with proper health checks
7. **Free/Open Source**: Only use commercially-safe open source dependencies

## Deployment

**UPDATED (Post Epic 006)**: 100% CI/CD automation with zero-downtime deployments

### Automated CI/CD Pipeline

**CI/CD Maturity**: **100%** (Backend: 100%, Frontend: 95%)

- Zero manual deployment steps
- Automatic staging deployment on main merge
- Manual production approval with blue-green deployment
- Automatic rollback in < 2 minutes

### Deployment Workflows

**Staging (Automatic)**:

```bash
# Triggers automatically on merge to main
git push origin main

# Monitor deployment
gh run watch

# Verify staging
curl https://api-staging.sovren.dev/health
```

**Production (Manual)**:

```bash
# Frontend: Vercel auto-deploys on merge to main
# Backend: Promote staging Docker image to production

# Monitor CI
gh run list --workflow=ci.yml --limit 5

# Verify production
curl https://api.sovren.dev/health
```

**Emergency Rollback**:

```bash
# Frontend: Vercel dashboard → instant rollback to previous deployment
# Backend: Revert to previous Docker image tag
```

### Frontend Deployment

**Vercel** (95% automated):

- Environment: `packages/frontend/.env`
- Build command: `npm run vercel-build`
- Output: `packages/frontend/dist`
- Auto-deploys on push to main
- Production: Auto-deploys on merge to main

### Backend Deployment

**Docker Containers** (100% automated):

- Development: `docker-compose.dev.yml` (local)
- Production: Docker image built by CI (`ci.yml`), promoted manually
- Multi-stage builds (image size < 150MB)
- Multi-architecture support (amd64, arm64)
- GHCR: Image signing, SBOM, SLSA provenance
- Health checks: `/health`, `/ready`, `/live`, `/detailed`

### Deployment Commands Reference

```bash
# View CI status
gh run list --workflow=ci.yml --limit 5

# Run deployment tests
npm run test:deployment

# Validate secrets
./scripts/validate-deployment-secrets.sh production

# Check health endpoints
curl https://api-staging.sovren.dev/health
curl https://api-staging.sovren.dev/ready
curl https://api-staging.sovren.dev/live
```

**Complete Guide**: [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)
**Integration Standards**: [docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md](docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md)

## Getting Help

- **Documentation Index**: `docs/README.md`
- **Architecture Docs**: `ELITE_ARCHITECTURE_DOCUMENTATION.md`
- **Feature Guide**: `FEATURE_ARCHITECTURE_GUIDE.md`
- **Mermaid Guide**: `docs/development/mermaid-diagram-guide.md`
- **Deployment Integration**: `docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md` ⭐ NEW
- **Deployment Guide**: `docs/deployment/DEPLOYMENT_GUIDE.md` ⭐ NEW
- **User Stories**: `docs/user-stories.md` or `SOVREN_PRD.md`

## Project Philosophy

This codebase follows **Elite Engineering Standards** (11 Commandments):

1. Code is for humans first, machines second
2. Duplication is the root of all evil
3. Simplicity over cleverness
4. Tests are non-negotiable (TDD always)
5. Assume nothing, validate everything
6. Favor modularity and clear contracts
7. Interfaces are law
8. Leave code better than you found it
9. Automate all the things
10. Protect the integrity of the codebase
11. Visualize architecture and workflows (Mermaid diagrams mandatory)

**Achievement Status**: Elite Score 99/100 - Top 1% quality benchmark

# CI/CD Monitoring — Claude Code Standards

This section defines how Claude Code should assist engineers with CI/CD pipeline monitoring,
debugging, and automated repair across all repositories in this organization.

---

## CI Watching Protocol

When an engineer asks you to monitor, check, or watch CI/CD — follow this workflow:

### 1. Check current state first

```bash
gh run list --limit 5 --json databaseId,displayTitle,status,conclusion,workflowName,headBranch,createdAt
```

### 2. Watch the active run live

```bash
gh run watch <run-id> --exit-status
```

This refreshes every 3 seconds automatically. Do not poll manually.

### 3. On failure — get logs immediately

```bash
gh run view <run-id> --log-failed
```

Parse the error, identify the root cause, and present a clear diagnosis before suggesting any fix.

---

## Pipeline Architecture (This Org)

Our pipelines run in this order — always check failures in this context:

| Stage             | Jobs                                     | Branch        |
| ----------------- | ---------------------------------------- | ------------- |
| Code Quality      | lint, typecheck, format                  | all branches  |
| Security Scan     | npm-audit, trivy-fs                      | all branches  |
| Build & Test      | unit, integration, coverage              | all branches  |
| E2E Tests         | playwright                               | all branches  |
| Build Image       | docker-build, ghcr-push                  | main, develop |
| Image Scan        | trivy-container                          | main, develop |
| Deploy Staging    | deploy, smoke-tests                      | develop       |
| Deploy Production | blue-green, health-check, rollback-guard | main only     |

If a failure occurs in **Deploy Production**, always check:

1. Health endpoint response: `curl -f https://<service>/health`
2. Rollback status: `gh api repos/:owner/:repo/deployments`
3. Alert the engineer immediately — do not attempt auto-fix in production

---

## Environments

| Environment | Branch     | Auto-deploy | Auto-fix allowed     |
| ----------- | ---------- | ----------- | -------------------- |
| development | feature/\* | No          | Yes                  |
| staging     | develop    | Yes         | Yes                  |
| production  | main       | Yes         | **No — notify only** |

---

## Auto-Fix Rules

When auto-fixing CI failures, follow these rules strictly:

**✅ Safe to fix automatically:**

- ESLint errors → `npx eslint . --fix`
- Prettier formatting → `npx prettier . --write`
- `npm audit` low/medium severity → `npm audit fix`
- Missing `chmod +x` on scripts
- TypeScript type errors in non-critical paths
- Import path errors

**⚠️ Fix but notify engineer:**

- Failing unit tests (fix source, not just the test)
- Coverage threshold failures (must add real tests, not skip)
- Missing environment variables in workflow (add to `.env.example`)

**🚫 Never auto-fix — always notify:**

- Production deployment failures
- Security scan HIGH or CRITICAL findings
- Database migration failures
- Any failure in `deploy-production` job
- Trivy container scan failures (require security review)

When notifying about a no-auto-fix situation, format your message as:

```
⚠️  MANUAL ACTION REQUIRED
Job:   <job-name>
Error: <concise error description>
File:  <file:line if applicable>
Why:   <reason auto-fix was skipped>
Next:  <recommended human action>
```

---

## gh CLI Command Reference

Keep these commands ready for CI diagnostics:

```bash
# List recent runs
gh run list --limit 10

# Filter by branch
gh run list --branch <branch-name>

# Watch run live (blocks until complete)
gh run watch <run-id> --exit-status

# View full logs
gh run view <run-id> --log

# View only failed step logs
gh run view <run-id> --log-failed

# Re-run failed jobs only (preserves passing jobs)
gh run rerun <run-id> --failed

# Re-run entire workflow
gh run rerun <run-id>

# View deployment environments
gh api repos/:owner/:repo/environments

# Get latest deployment for environment
gh api "repos/:owner/:repo/deployments?environment=staging&per_page=1"

# Get deployment statuses
gh api repos/:owner/:repo/deployments/<deploy-id>/statuses
```

---

## Slash Commands Available

| Command                     | Description                          |
| --------------------------- | ------------------------------------ |
| `/watch-ci`                 | Watch current branch's latest CI run |
| `/watch-ci --fix`           | Watch and auto-fix failures          |
| `/watch-ci --env staging`   | Watch staging deployment             |
| `/watch-ci --branch <name>` | Watch a specific branch              |
| `/watch-ci --run <id>`      | Watch a specific run ID              |

---

## Commit Convention for CI Fixes

When Claude Code commits a CI fix, always use:

```
fix(ci): <what-was-fixed>

Auto-repaired by Claude Code
Run: <gh-run-url>
Error: <one-line error summary>
```

Example:

```
fix(ci): resolve ESLint no-unused-vars in UserService

Auto-repaired by Claude Code
Run: https://github.com/org/repo/actions/runs/12345
Error: 'token' is assigned a value but never used (line 142)
```

---

## Failure Notification Format

When reporting a failure to an engineer, always use this structure:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Pipeline Failed — <workflow> on <branch>
   Run: #<id> | Duration: <time> | Triggered by: <actor>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Failed Job:  <job-name>
Failed Step: <step-name>
Error:       <concise error — 1-2 lines>
File/Line:   <if applicable>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Diagnosis:   <root cause in plain English>
Suggested:   <recommended fix>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
