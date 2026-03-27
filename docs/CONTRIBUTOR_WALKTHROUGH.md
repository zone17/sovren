# Contributor Walkthrough — Sovren

A narrative guide for engineers joining the Sovren codebase. Read this top to bottom on your first day. Budget 30–45 minutes.

---

## Table of Contents

1. [Your First 30 Minutes](#1-your-first-30-minutes)
2. [Codebase Map](#2-codebase-map)
3. [How a Request Flows Through the System](#3-how-a-request-flows-through-the-system)
4. [How to Add a New Feature](#4-how-to-add-a-new-feature)
5. [How to Add a New API Endpoint](#5-how-to-add-a-new-api-endpoint)
6. [How to Add a New Database Table](#6-how-to-add-a-new-database-table)
7. [How to Run and Debug Tests](#7-how-to-run-and-debug-tests)
8. [Common Mistakes to Avoid](#8-common-mistakes-to-avoid)
9. [Where to Get Help](#9-where-to-get-help)

---

## 1. Your First 30 Minutes

### Step 1 — Install and boot the project (5 min)

```bash
# From repo root
npm install

# Start the frontend dev server (port 3000)
npm run dev

# In a second terminal, start the backend dev server (port 3001)
cd packages/backend
npm run dev
```

The frontend hot-reloads via Vite. The backend uses `tsx watch` — save any `.ts` file and it restarts automatically.

### Step 2 — Browse the live API docs (2 min)

Start the backend, then open **http://localhost:3001/api/docs** in a browser.

You'll see Swagger UI listing every documented endpoint. The raw OpenAPI spec is also available at **http://localhost:3001/api/docs.json** for tooling (Postman, code generators, etc.).

To authorize in Swagger UI: click the "Authorize" button and paste a JWT Bearer token.

### Step 3 — Run the test suite (5 min)

```bash
# Unit + backend tests — fast, no Docker required
npm test

# Integration tests (Postgres + Redis via testcontainers — Docker must be running)
npm run test:integration

# End-to-end Playwright tests
npm run test:e2e
```

All three should pass on a clean checkout. If integration tests fail, make sure Docker Desktop is running.

### Step 4 — Read the two mandatory pattern files (10 min)

These files distil 50+ P1 review findings across the project's history. Skipping them is the single fastest way to introduce bugs that will fail code review.

- `docs/solutions/patterns/critical-patterns.md` — 8 P1-class patterns (TOCTOU, auth, pagination, atomic writes, SSRF, status guards, payment persistence, test infrastructure). **Read every section.**
- `docs/solutions/patterns/common-solutions.md` — P2/P3 patterns (double-submit CSRF, TTLCache, env validation, error formats, E2E conventions, and more).

### Step 5 — Scan the docs index (5 min)

`docs/README.md` is the map to all documentation. Key directories:

| Path | What lives here |
|------|-----------------|
| `docs/solutions/patterns/` | Canonical code patterns (start here) |
| `docs/architecture/` | System diagrams and ADRs |
| `docs/development/` | Branching strategy, deployment, shared package protocol |
| `docs/deployment/` | Deployment guide, staging/production runbooks |
| `docs/features/` | Per-feature implementation docs |
| `docs/decisions/` | Architecture Decision Records |

---

## 2. Codebase Map

The repo is an **npm workspaces monorepo**.

```
Sovren/
├── packages/
│   ├── frontend/          # React 18 + Vite + TailwindCSS (port 3000)
│   ├── backend/           # Node.js + Express + TypeScript (port 3001)
│   ├── shared/            # Types, utilities, and constants shared across packages
│   └── testing/           # Shared test helpers and fixtures
├── docs/                  # All documentation
├── scripts/               # Monorepo-level tooling (Docker dev scripts, etc.)
└── package.json           # Workspace root — runs commands across all packages
```

### Frontend (`packages/frontend/src/`)

The frontend uses **feature-based modular architecture**. Code is organized by business domain, not by technical type.

```
src/
├── features/              # One directory per business domain
│   ├── auth/              # Authentication & NOSTR key management
│   │   ├── components/    # Auth-specific UI components
│   │   ├── services/      # AuthContext, NOSTR key logic
│   │   ├── types/         # Auth type definitions
│   │   └── index.ts       # Barrel export — import from here, not from sub-paths
│   ├── content/           # Content creation and management
│   ├── analytics/         # AI-powered creator analytics
│   ├── dashboard/         # Creator dashboards
│   └── wellness/          # Creator Safety Net features
├── components/ui/         # Generic, domain-agnostic UI components (buttons, modals)
├── store/                 # Redux Toolkit slices — one slice per feature
├── hooks/                 # Shared React hooks used across features
├── services/              # API client layer (wraps the backend REST API)
├── pages/                 # Route-level components (thin wrappers — logic lives in features)
└── shared/                # Cross-cutting utilities, constants, global types
```

**Key rule:** each feature is self-contained. Import a feature's public API from its `index.ts` barrel. Never reach into a feature's sub-directories from another feature.

### Backend (`packages/backend/src/`)

```
src/
├── routes/                # Express route definitions (request parsing + middleware)
│   ├── v1/                # V1 API: content, users, payments, metrics
│   ├── v2/                # V2 API: wellness, shield, circles, marketplace, etc.
│   ├── auth.ts            # /api/auth — NOSTR + JWT auth
│   ├── users.ts           # /api/users
│   ├── health.ts          # /health, /ready, /live, /health/detailed
│   └── admin/             # Admin-only routes (Bull Board queue UI)
├── controllers/           # Request/response handling (thin — delegates to services)
├── services/              # Business logic (the bulk of the implementation)
├── repositories/          # Data access layer (Supabase queries)
├── middleware/            # Express middleware (auth, validation, CSRF, rate limiting)
├── interfaces/            # TypeScript interfaces for services and repositories (DI contracts)
├── container/             # InversifyJS DI container wiring
├── database/              # SQL migrations and schema files
├── lib/                   # Shared backend utilities (logger, Sentry, AppError)
├── utils/                 # Request helpers (asyncHandler, api-response, errors)
├── validators/            # Zod/Joi request validation schemas
├── types/                 # TypeScript type augmentations (Express.Request extensions)
├── app.ts                 # Express app factory — all middleware and routes wired here
└── server.ts              # Entry point — binds port, bootstrap, graceful shutdown
```

### Shared (`packages/shared/`)

Common TypeScript types (NOSTR event shapes, payment types, API response envelopes) and utility functions used by both frontend and backend. Import as `@sovren/shared`.

---

## 3. How a Request Flows Through the System

Tracing a `POST /api/v1/content/publish` request end-to-end:

### 1. Entry: `packages/backend/src/server.ts`

The HTTP server starts here, calls `createApp()` and `bootstrap()`, then listens on the configured port.

### 2. App factory: `packages/backend/src/app.ts` → `createApp()`

Every middleware and route is wired in `createApp()` in a specific order:

```
correlationIdMiddleware       → stamps X-Correlation-ID on every request
compression                   → gzip/brotli for responses >1KB
helmet                        → security headers (CSP, HSTS, X-Frame-Options, etc.)
cors                          → allowlists origins
createRateLimiter             → global 300 req/15min rate limit
express.json                  → parses JSON body, stores raw body for signature verification
cookieParser                  → parses cookies (required for CSRF)
csrfProtection                → double-submit cookie CSRF guard
request logger middleware     → structured logs with correlation ID on response finish
deploymentMonitoring          → Prometheus metrics per route
routes                        → mounted here (auth, users, v1, v2, discovery, etc.)
notFoundHandler               → 404 catch-all
errorHandler                  → global error handler (Sentry + structured log)
```

### 3. Route file: `packages/backend/src/routes/v1/content.routes.ts`

The route file declares the middleware stack for the endpoint:

```typescript
router.post(
  '/publish',
  authenticate,              // Validates JWT → populates req.user
  requireCreator,            // Asserts req.user.role === 'creator'
  rateLimiters.content.write,
  validate({ body: ContentValidators.publishContent }),  // Zod schema validation
  (req, res, next) => getController().publishContent(req, res, next)
);
```

Middleware runs left-to-right. If any middleware calls `next(error)`, execution jumps straight to the global `errorHandler`.

### 4. Controller: `packages/backend/src/controllers/content/ContentController.ts`

Controllers are thin. They extract validated data from `req`, call the service, and format the response:

```typescript
async publishContent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = getAuthUser(req);
    const result = await this.contentService.publishContent(user.id, req.body);
    res.status(201).json(createApiResponse({ data: result }));
  } catch (err) {
    next(err);  // Delegates to global errorHandler
  }
}
```

### 5. Service: `packages/backend/src/services/content/`

All business logic lives here. Services hold ownership checks, transactional writes, and queue dispatches:

```typescript
async publishContent(creatorId: string, dto: PublishContentDto): Promise<Content> {
  // 1. Ownership/access check (critical-patterns.md #2)
  // 2. Validate business rules
  // 3. Atomic write (critical-patterns.md #4)
  // 4. Enqueue background jobs with compensation (critical-patterns.md #4c)
  // 5. Return result
}
```

### 6. Repository: `packages/backend/src/repositories/`

The repository layer wraps Supabase queries. Services call repositories — they never query Supabase directly.

### 7. Database: Supabase (Postgres)

RLS policies enforce row-level ownership at the database level as a second line of defence. Migrations live in `packages/backend/src/database/`.

### 8. Response path

The result bubbles back up: repository → service → controller → route → `createApiResponse` → JSON response.

All successful responses use the envelope from `packages/backend/src/utils/api-response.ts`:

```json
{ "success": true, "data": { ... } }
```

All errors use the structure from `packages/backend/src/utils/errors.ts`:

```json
{ "success": false, "error": "Not Found", "code": "CONTENT_NOT_FOUND" }
```

---

## 4. How to Add a New Feature

Use the **frontend feature module pattern**. This example adds a `gifting` feature.

### Step 1 — Create the feature directory

```bash
mkdir -p packages/frontend/src/features/gifting/{components,services,types,__tests__}
```

### Step 2 — Define types first

```typescript
// packages/frontend/src/features/gifting/types/index.ts
export interface Gift {
  id: string;
  fromUserId: string;
  toCreatorId: string;
  amountSats: number;
  message?: string;
  createdAt: string;
}

export interface SendGiftDto {
  toCreatorId: string;
  amountSats: number;
  message?: string;
}
```

### Step 3 — Write the test first (TDD)

```typescript
// packages/frontend/src/features/gifting/__tests__/useGifting.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGifting } from '../services/useGifting';

describe('useGifting', () => {
  it('should expose sendGift function', () => {
    const { result } = renderHook(() => useGifting());
    expect(typeof result.current.sendGift).toBe('function');
  });
});
```

### Step 4 — Implement the service hook

```typescript
// packages/frontend/src/features/gifting/services/useGifting.ts
import { useMutation } from '@tanstack/react-query';
import type { SendGiftDto, Gift } from '../types';
import { apiClient } from '@services/api-client';

export const useGifting = () => {
  const sendGift = useMutation<Gift, Error, SendGiftDto>({
    mutationFn: (dto) => apiClient.post('/api/v2/gifting', dto),
  });

  return { sendGift };
};
```

### Step 5 — Build the component

```typescript
// packages/frontend/src/features/gifting/components/GiftButton.tsx
import React from 'react';
import { useGifting } from '../services/useGifting';

interface Props { toCreatorId: string; }

export const GiftButton: React.FC<Props> = ({ toCreatorId }) => {
  const { sendGift } = useGifting();

  const handleClick = () => {
    sendGift.mutate({ toCreatorId, amountSats: 1000 });
  };

  return (
    <button onClick={handleClick} disabled={sendGift.isPending}>
      {sendGift.isPending ? 'Sending…' : 'Send Gift'}
    </button>
  );
};
```

### Step 6 — Export through the barrel

```typescript
// packages/frontend/src/features/gifting/index.ts
export * from './components';
export * from './services';
export type * from './types';
```

### Step 7 — Add the Redux slice if state is needed

```typescript
// packages/frontend/src/store/giftingSlice.ts
import { createSlice } from '@reduxjs/toolkit';

const giftingSlice = createSlice({
  name: 'gifting',
  initialState: { recentGifts: [] as Gift[] },
  reducers: {
    addGift: (state, action) => { state.recentGifts.unshift(action.payload); },
  },
});

export const { addGift } = giftingSlice.actions;
export default giftingSlice.reducer;
```

Register it in `packages/frontend/src/store/index.ts`.

### Step 8 — Update CHANGELOG.md

Every commit requires a CHANGELOG entry:

```
## [Unreleased]
### Added
- feat(gifting): GiftButton component and useGifting hook (SOV-XXX)
```

---

## 5. How to Add a New API Endpoint

This example adds `POST /api/v2/gifting` to the v2 router.

### Step 1 — Add the validator

```typescript
// packages/backend/src/validators/gifting.ts
import { z } from 'zod';

export const GiftingValidators = {
  sendGift: z.object({
    toCreatorId: z.string().uuid(),
    amountSats: z.number().int().min(1).max(1_000_000),
    message: z.string().max(280).optional(),
  }),
};
```

### Step 2 — Create the route file

```typescript
// packages/backend/src/routes/v2/gifting.routes.ts
import { Router } from 'express';
import { authenticate, requireCreator } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { createUserRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { GiftingValidators } from '../../validators/gifting';
import { getAuthUser } from '../../middleware/auth';

const router = Router();
const giftRateLimiter = createUserRateLimiter({ windowMs: 60_000, max: 10 });

/**
 * @openapi
 * /gifting:
 *   post:
 *     summary: Send a Lightning gift to a creator
 *     tags: [Gifting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toCreatorId, amountSats]
 *             properties:
 *               toCreatorId:
 *                 type: string
 *                 format: uuid
 *               amountSats:
 *                 type: integer
 *                 minimum: 1
 *               message:
 *                 type: string
 *                 maxLength: 280
 *     responses:
 *       '201':
 *         description: Gift sent successfully
 */
router.post(
  '/',
  authenticate,
  giftRateLimiter,
  validate({ body: GiftingValidators.sendGift }),
  asyncHandler(async (req, res) => {
    const user = getAuthUser(req);
    // TODO: call GiftingService.sendGift(user.id, req.body)
    res.status(201).json(createApiResponse({ data: { ok: true } }));
  })
);

export default router;
```

The `@openapi` JSDoc comment is picked up automatically by `swaggerJsdoc` — it will appear in the Swagger UI at `/api/docs` the next time the server starts.

### Step 3 — Mount the route in the v2 index

```typescript
// packages/backend/src/routes/v2/index.ts — add:
import giftingRoutes from './gifting.routes';
router.use('/gifting', giftingRoutes);
```

### Step 4 — Implement the service

Create `packages/backend/src/services/gifting/GiftingService.ts`. Follow the layered pattern:

1. Service accepts a DTO and a `callerId` string.
2. Verifies the caller has access (critical-patterns.md #2).
3. Makes all DB writes atomically (critical-patterns.md #4).
4. Returns the result.

### Step 5 — Wire in the DI container

```typescript
// packages/backend/src/container/types.ts — add:
GiftingService: Symbol.for('GiftingService'),

// packages/backend/src/container/index.ts — add:
container.bind<IGiftingService>(TYPES.GiftingService).to(GiftingService).inSingletonScope();
```

### Step 6 — Write integration tests

```typescript
// packages/backend/src/routes/v2/__tests__/gifting.routes.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app';

describe('POST /api/v2/gifting', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v2/gifting').send({});
    expect(res.status).toBe(401);
  });
});
```

---

## 6. How to Add a New Database Table

### Step 1 — Write the SQL migration

Create a file in `packages/backend/src/database/`. Use a timestamp prefix:

```sql
-- packages/backend/src/database/20260326_gifts.sql

CREATE TABLE gifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_sats  INTEGER NOT NULL CHECK (amount_sats > 0),
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for creator inbox
CREATE INDEX idx_gifts_to_creator ON gifts(to_creator_id, created_at DESC);
-- Index for sender history
CREATE INDEX idx_gifts_from_user ON gifts(from_user_id, created_at DESC);
```

### Step 2 — Add RLS policies

RLS is mandatory. Every table must have policies. Add these in the same migration file:

```sql
-- Enable RLS
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

-- Senders can see their own gifts
CREATE POLICY "gifts_select_sender"
  ON gifts FOR SELECT
  USING (from_user_id = auth.uid());

-- Creators can see gifts sent to them
CREATE POLICY "gifts_select_receiver"
  ON gifts FOR SELECT
  USING (to_creator_id = auth.uid());

-- Only the system/service role can insert (no direct client inserts)
CREATE POLICY "gifts_insert_service"
  ON gifts FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only service role can update status
CREATE POLICY "gifts_update_service"
  ON gifts FOR UPDATE
  USING (auth.role() = 'service_role');
```

**Important:** always use `auth.uid()` — never `auth.jwt() ->> 'sub'` directly, as it bypasses the type check.

### Step 3 — Run the migration

```bash
# Apply migration to local/dev database
npm run db:migrate --workspace=packages/backend

# Or apply directly if using Supabase CLI
supabase db push
```

### Step 4 — Add the TypeScript type

```typescript
// packages/shared/src/types/gift.ts
export interface Gift {
  id: string;
  fromUserId: string;
  toCreatorId: string;
  amountSats: number;
  message: string | null;
  status: 'pending' | 'paid' | 'failed';
  createdAt: string;
  updatedAt: string;
}
```

### Step 5 — Create the repository

```typescript
// packages/backend/src/repositories/GiftRepository.ts
import { supabase } from '../lib/supabase';
import type { Gift } from '@sovren/shared';

export class GiftRepository {
  async create(dto: Omit<Gift, 'id' | 'createdAt' | 'updatedAt'>): Promise<Gift> {
    const { data, error } = await supabase
      .from('gifts')
      .insert({
        from_user_id: dto.fromUserId,
        to_creator_id: dto.toCreatorId,
        amount_sats: dto.amountSats,
        message: dto.message,
        status: dto.status,
      })
      .select()
      .single();

    if (error) throw new Error(`Gift creation failed: ${error.message}`);
    return data as Gift;
  }

  async findByCreator(creatorId: string, limit = 20, offset = 0): Promise<Gift[]> {
    // Always paginate — never unbounded SELECT (critical-patterns.md #3)
    const { data, error } = await supabase
      .from('gifts')
      .select('*')
      .eq('to_creator_id', creatorId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Gift fetch failed: ${error.message}`);
    return (data ?? []) as Gift[];
  }
}
```

### Step 6 — Write tests for the migration

```typescript
// packages/backend/src/repositories/__tests__/GiftRepository.integration.test.ts
// Uses testcontainers — requires Docker Desktop running
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

describe('GiftRepository (integration)', () => {
  // Setup: spin up a real Postgres container and run migrations
  // See packages/backend/src/test-infra/ for testcontainer helpers
});
```

---

## 7. How to Run and Debug Tests

### Test categories

| Command | What runs | Docker needed? |
|---------|-----------|----------------|
| `npm test` | Unit tests for backend, frontend, and shared | No |
| `npm run test:watch` | Unit tests in watch mode | No |
| `npm run test:coverage` | Unit tests + coverage report | No |
| `npm run test:integration` | Integration tests (real Postgres + Redis) | Yes |
| `npm run test:e2e` | Playwright end-to-end tests | No (demo mode) |
| `npm run test:e2e:ui` | Playwright with visual runner | No |
| `npm run test:security` | Security-focused tests | No |

### Running a single test file

```bash
# Run one file
npx vitest run packages/backend/src/routes/v2/__tests__/wellness.routes.test.ts

# Run tests matching a name pattern
npx vitest run --reporter=verbose -t "POST /api/v2/gifting"
```

### Debugging a failing test

1. Add `--reporter=verbose` to see the full test tree.
2. Use `console.log` or Vitest's `vi.spyOn` to inspect intermediate values.
3. For async errors, wrap the assertion in a `try/catch` to see the actual thrown value.
4. For integration tests, check that Docker is running: `docker ps`. If Postgres fails to start, set `TESTCONTAINERS_RYUK_DISABLED=true`.

### Common Vitest pitfalls

- Use `vi.fn()`, `vi.mock()`, `vi.spyOn()` — not `jest.*`. Jest globals are not available.
- `vi.mock()` hoisting behaves differently from Jest. Use `vi.hoisted()` for class declarations inside mock factories.
- `vi.importActual()` returns a Promise — always `await` it.
- For runtime enum values, use `import { MyEnum }` not `import type { MyEnum }` — `import type` is erased by esbuild.
- On machines with less than 32 GB RAM, set `maxForks: 2` in the vitest config to prevent OOM.

### Coverage thresholds

- Services, repositories, Redux store: **95% minimum**
- Global: **85% minimum**
- New code you write: **95%+**

---

## 8. Common Mistakes to Avoid

These are the top patterns that have caused P1 review findings across the project's history. Violating them will fail code review.

### 1. TOCTOU race conditions — read-check-write without an atomic guard

**Wrong:** SELECT count → if under limit → INSERT
**Right:** INSERT first → COUNT after → rollback if over limit

See `docs/solutions/patterns/critical-patterns.md` section 1 for three atomic patterns.

### 2. Trusting route-level auth alone

Every service method that reads or writes user data must re-verify that the caller owns the resource. Route-level `authenticate` middleware proves identity but not authorization.

```typescript
// Always pass callerId to service methods and check ownership inside
async getContent(contentId: string, callerId: string): Promise<Content>
```

### 3. Unbounded database queries

Never fetch a full table without `.range()`. Use `PAGE_SIZE = 500` for aggregation loops. A `.limit(1000)` silently truncates results — it is not safe for totals.

### 4. Multi-table writes without atomicity

Two `.insert()` calls on different tables without a Supabase RPC or try/catch + compensating delete will leave data inconsistent on partial failure.

### 5. Missing count check after Supabase mutations

Every `.update()` or `.delete()` targeting a specific row must check the returned `count`. A `count === 0` means the WHERE clause matched nothing — the operation was a silent no-op.

```typescript
const { error, count } = await supabase.from('gifts').update({ status: 'paid' }).eq('id', giftId);
if (!count) throw new NotFoundError('Gift not found or already updated');
```

### 6. Fetching user-supplied URLs without SSRF validation

Any server-side fetch of a URL that comes from user input must pass through `validateSsrfUrl` first. This resolves DNS, checks that the resolved IP is not private or loopback, and returns pinned IPs for subsequent use.

### 7. No status guard before destructive operations

Before deleting or voiding an entity, assert its status is one of the allowed mutable states (`draft`, `cancelled`). Never allow deleting a `paid` or `active` record without an explicit override.

### 8. Importing from feature sub-paths

Import from the barrel (`features/gifting`), not from `features/gifting/components/GiftButton`. The barrel is the public API. Sub-paths are internal.

### 9. `any` types

The project enforces `strict: true`. If TypeScript can't infer a type, define an interface. Use `as unknown as T` only as an absolute last resort with a comment explaining why.

### 10. Skipping the CHANGELOG

Every commit that changes behaviour must include a CHANGELOG entry. CI enforces this. It takes 30 seconds.

---

## 9. Where to Get Help

### Documentation index

`docs/README.md` — full map of all documentation files.

### Pattern files (canonical)

- `docs/solutions/patterns/critical-patterns.md` — P1-class patterns, 8 sections
- `docs/solutions/patterns/common-solutions.md` — P2/P3 patterns, 130+ entries

### Architecture

- `docs/architecture/` — system diagrams and Mermaid architecture files
- `ELITE_ARCHITECTURE_DOCUMENTATION.md` — full system architecture narrative
- `FEATURE_ARCHITECTURE_GUIDE.md` — frontend feature architecture deep dive

### Development guides

- `docs/development/BRANCHING_STRATEGY.md` — branch naming, merge strategy, worktree rules
- `docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md` — CI/CD gates and staging validation
- `docs/development/SHARED_PACKAGE_PROTOCOL.md` — how to change the shared package

### Deployment

- `docs/deployment/DEPLOYMENT_GUIDE.md` — staging and production deployment runbooks

### API reference

- `http://localhost:3001/api/docs` — live Swagger UI (when backend is running)
- `http://localhost:3001/api/docs.json` — raw OpenAPI spec

### Project context

- `docs/PROJECT_CONTEXT.md` — distilled codebase context (~2,500 tokens, read this when starting a large task)
- `SOVREN_PRD.md` — product requirements and user stories

### Incident response

- `docs/incident-response/` — runbooks for production incidents
- `docs/troubleshooting/` — common issues and their fixes
