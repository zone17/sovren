# Epic 001: Type Safety Improvements - Quick Reference

**Last Updated**: 2025-10-23

---

## At a Glance

| Metric | Value |
|--------|-------|
| **Total Stories** | 12 (all 1-point) |
| **Total Points** | 12 points |
| **Sprints** | 2 (Sprint 0 + Sprint 1) |
| **Duration (3 devs)** | 2 days |
| **Duration (1 dev)** | 3.5 days |
| **Parallel Streams** | 3 (A, B, C) |
| **Sequential Work** | 1 stream (D) |
| **Medium Risk Stories** | 3 (Stories 3, 9, 11) |
| **Security Reviews** | 3 (Stories 3, 7, 9) |

---

## Story Quick Reference

### Sprint 0: Foundation (Parallel Work)

| ID | Title | Priority | Risk | Hours | Owner | Security |
|----|-------|----------|------|-------|-------|----------|
| S1 | Event Handlers | High | Low | 2-3 | Frontend | No |
| S2 | API Responses | High | Low | 2-3 | Frontend | No |
| S3 | Validation | High | **Medium** | 2-3 | Frontend | **YES** |
| S4 | Email Service | Medium | Low | 2 | Frontend | No |
| S5 | Test Utilities | Medium | Low | 2 | Frontend | No |
| S6 | Quality Metrics | High | Low | 2-3 | Shared | No |
| S7 | NOSTR Keys | Medium | Low | 1.5-2 | Shared | **YES** |
| S8 | Environment | Low | Low | 1.5 | Shared | No |
| S9 | API Routes | High | **Medium** | 2-3 | API | **YES** |
| S10 | NOSTR Service | Medium | Low | 2 | API | No |

### Sprint 1: Strict Mode (Sequential Work)

| ID | Title | Priority | Risk | Hours | Owner | Depends On |
|----|-------|----------|------|-------|-------|------------|
| S11 | Enable Strict Mode | Critical | **Medium** | 1.5-2 | Any | S1-S10 |
| S12 | Validate Coverage | Critical | Low | 1.5-2 | Any | S11 |

---

## Work Streams

### Stream A: Frontend Types (Stories 1-5)
**Focus**: React components, API responses, validation, services, test utilities
**Owner**: Frontend Specialist
**Hours**: ~12 hours (1.5 days)
**Dependencies**: None (start immediately)

### Stream B: Shared Package Types (Stories 6-8)
**Focus**: Quality metrics, NOSTR keys, environment validation
**Owner**: Backend/Shared Specialist
**Hours**: ~6 hours (0.75 days)
**Dependencies**: None (start immediately)

### Stream C: API & Integration Types (Stories 9-10)
**Focus**: API route handlers, NOSTR service
**Owner**: API Specialist
**Hours**: ~5 hours (0.6 days)
**Dependencies**: None (start immediately)

### Stream D: Strict Mode (Stories 11-12)
**Focus**: Enable strict compiler options, validate coverage
**Owner**: Any Developer
**Hours**: ~3.5 hours (0.4 days)
**Dependencies**: **MUST WAIT FOR S1-S10 TO COMPLETE**

---

## Critical Dependencies

```
Sprint 0 (Stories 1-10): ALL PARALLEL
         ↓
Story 11: Enable Strict Mode (WAITS for 1-10)
         ↓
Story 12: Validate Coverage (WAITS for 11)
```

**No story in Sprint 0 blocks any other story in Sprint 0.**
**All Sprint 0 stories must complete before Sprint 1 begins.**

---

## Files by Story

### Stream A: Frontend

**Story 1** (Event Handlers):
- `packages/frontend/src/pages/Login.tsx`
- `packages/frontend/src/pages/Signup.tsx`
- `packages/frontend/src/pages/Profile.tsx`
- `packages/frontend/src/pages/Post.tsx`

**Story 2** (API Responses):
- Create: `packages/frontend/src/types/api-responses.ts`
- `packages/frontend/src/pages/Home.tsx`
- `packages/frontend/src/pages/Profile.tsx`
- `packages/frontend/src/pages/Post.tsx`

**Story 3** (Validation):
- `packages/frontend/lib/middleware/validation.ts`

**Story 4** (Email Service):
- `packages/frontend/lib/services/emailService.ts`

**Story 5** (Test Utilities):
- `packages/frontend/src/test-utils/test-providers.tsx`
- `packages/frontend/src/test-utils/react-query-test-utils.tsx`

### Stream B: Shared

**Story 6** (Quality Metrics):
- `packages/shared/src/types/quality-metrics.ts`
- `packages/shared/src/types/quality-metrics.d.ts` (regenerate)

**Story 7** (NOSTR Keys):
- `packages/shared/src/types/nostr-key-management.ts`

**Story 8** (Environment):
- `packages/shared/src/config/environment-validator.ts`

### Stream C: API

**Story 9** (API Routes):
- Create: `packages/frontend/api/types/api-types.ts`
- `packages/frontend/api/payments/create-payment-intent.ts`
- `packages/frontend/api/payments/webhook.ts`
- `packages/frontend/api/posts/index.ts`
- `packages/frontend/api/auth/register.ts`
- `packages/frontend/api/users/[id].ts`

**Story 10** (NOSTR Service):
- `packages/frontend/lib/services/nostrService.ts`

### Stream D: Strict Mode

**Story 11** (Enable Strict Mode):
- `tsconfig.json` (root)
- `packages/frontend/tsconfig.json`
- `packages/shared/tsconfig.json`
- `packages/backend/tsconfig.json`

**Story 12** (Validate Coverage):
- `package.json` (add scripts)
- `.github/workflows/*.yml` (CI/CD updates)
- `README.md` (add badge)

---

## Security Review Checklist

### Story 3: Validation Middleware ⚠️
- [ ] XSS payload testing completed
- [ ] SQL injection testing completed
- [ ] Null byte injection testing completed
- [ ] Prototype pollution testing completed
- [ ] Security review by 2 team members
- [ ] No information leakage in error messages

### Story 7: NOSTR Keys ⚠️
- [ ] Private keys never logged or exposed
- [ ] Key format validation enforced
- [ ] Metadata validation prevents injection
- [ ] Key expiration properly enforced
- [ ] Cryptographic operations reviewed

### Story 9: API Routes ⚠️
- [ ] Authentication properly typed and enforced
- [ ] Authorization checks use proper User type
- [ ] Query parameter injection prevented
- [ ] Error responses don't leak sensitive data
- [ ] Privilege escalation testing completed
- [ ] Security review by senior backend developer

---

## Testing Checklist (Per Story)

### Before Merging Any Story
- [ ] TypeScript compiler passes (`tsc --noEmit`)
- [ ] ESLint passes (no explicit-any warnings)
- [ ] All unit tests pass
- [ ] All integration tests pass (if applicable)
- [ ] Manual testing completed
- [ ] Code review approved
- [ ] Security review approved (if medium/high risk)

### Before Starting Sprint 1 (After S1-S10)
- [ ] All Sprint 0 stories merged
- [ ] Full test suite passes across all packages
- [ ] No TypeScript errors in any package
- [ ] Manual QA of critical flows completed
- [ ] No console errors in browser

### Before Completing Epic (Story 12)
- [ ] Type coverage ≥ 99%
- [ ] Zero TypeScript errors
- [ ] Zero ESLint explicit-any warnings
- [ ] All tests pass (unit, integration, E2E)
- [ ] Build time < 5% increase
- [ ] CI/CD pipeline passes
- [ ] Documentation updated

---

## Common Type Patterns (Copy-Paste Reference)

### React Event Handlers
```typescript
// Form submission
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
};

// Input change
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.currentTarget.value);
};

// Button click
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  console.log('Clicked!');
};

// Keyboard events
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    submitForm();
  }
};
```

### API Response Types
```typescript
export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Usage
const response: ApiResponse<User> = await fetchUser(userId);
const posts: PaginatedResponse<Post> = await fetchPosts({ page: 1 });
```

### Discriminated Unions
```typescript
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

// Type guard
function isSuccess<T>(result: ApiResult<T>): result is { success: true; data: T } {
  return result.success === true;
}

// Usage
const result = await apiCall();
if (isSuccess(result)) {
  console.log(result.data); // TypeScript knows data exists
} else {
  console.error(result.error); // TypeScript knows error exists
}
```

### Zod Schemas
```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(20),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

// Validation
const result = UserSchema.safeParse(data);
if (result.success) {
  const user: User = result.data;
}
```

### Generic Constraints
```typescript
// Constrain to object types
function sanitize<T extends Record<string, unknown>>(obj: T): T {
  // ... sanitization logic
}

// Constrain to specific types
function formatValue<T extends string | number>(value: T): string {
  return String(value);
}

// Constrain with union
function process<T extends 'user' | 'post' | 'comment'>(type: T): void {
  // ... processing logic
}
```

### Type Guards
```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    'username' in value
  );
}

// Usage
if (isUser(data)) {
  console.log(data.email); // TypeScript knows data is User
}
```

---

## GitHub Issue Labels

Apply these labels when creating issues:

**Work Stream**:
- `stream-a-frontend` (Stories 1-5)
- `stream-b-shared` (Stories 6-8)
- `stream-c-api` (Stories 9-10)
- `stream-d-strict` (Stories 11-12)

**Priority**:
- `priority-critical` (Stories 11, 12)
- `priority-high` (Stories 1, 2, 3, 6, 9)
- `priority-medium` (Stories 4, 5, 7, 10)
- `priority-low` (Story 8)

**Risk**:
- `risk-medium` (Stories 3, 9, 11)
- `risk-low` (All others)

**Type**:
- `type-refactoring`
- `epic-001-type-safety`
- `1-point-story`

**Sprint**:
- `sprint-0-foundation` (Stories 1-10)
- `sprint-1-strict-mode` (Stories 11-12)

**Security**:
- `security-review-required` (Stories 3, 7, 9)

---

## Useful Commands

### Type Checking
```bash
# Check specific package
cd packages/frontend && npm run type-check
cd packages/shared && npm run type-check
cd packages/backend && npm run type-check

# Check all packages
npm run type-check --workspaces

# Check root
tsc --noEmit
```

### Find All `any` Types
```bash
# Search for 'any' types (exclude node_modules and tests)
grep -r "\bany\b" --include="*.ts" --include="*.tsx" packages/ | \
  grep -v "node_modules" | \
  grep -v ".test." | \
  grep -v ".spec."

# Count files with 'any' types
find packages -name "*.ts" -o -name "*.tsx" | \
  grep -v node_modules | \
  grep -v ".test." | \
  xargs grep -l "\bany\b" | \
  wc -l
```

### ESLint Checks
```bash
# Check for explicit-any violations
npm run lint -- --rule '@typescript-eslint/no-explicit-any: error'

# Fix auto-fixable issues
npm run lint -- --fix

# Check specific file
npx eslint packages/frontend/src/pages/Login.tsx
```

### Type Coverage (After Story 12)
```bash
# Install type-coverage
npm install --save-dev type-coverage

# Check coverage
npx type-coverage --detail

# Check coverage with strict minimum
npx type-coverage --strict --at-least 99
```

### Build Time Measurement
```bash
# Measure build time before changes
time npm run build

# Measure build time after changes
time npm run build

# Compare (should be < 5% increase)
```

---

## Troubleshooting

### Issue: TypeScript errors after enabling strict mode

**Solution**: This is expected for Story 11. Fix errors incrementally:
1. Enable one strict option at a time
2. Fix all errors for that option
3. Move to next option
4. Common fixes:
   - Add `| undefined` to array access types
   - Add `override` keyword to overriding methods
   - Add null checks before accessing properties

### Issue: Tests failing after type changes

**Solution**:
1. Check if test mocks need type updates
2. Verify test utilities (Story 5) are using proper types
3. Update test expectations to match new types
4. Ensure mock data conforms to new type constraints

### Issue: ESLint complaining about explicit-any

**Solution**:
1. Replace `any` with proper type
2. If legitimately needed (rare), add comment:
   ```typescript
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const result: any = externalLib.getData();
   ```
3. Document why `any` is necessary

### Issue: Type coverage below 99%

**Solution**:
1. Run `npx type-coverage --detail` to see uncovered code
2. Add explicit type annotations where TypeScript can't infer
3. Check for dynamic property access (`obj[key]`) - use type guards
4. Verify no implicit `any` in function parameters

### Issue: Build time increased by > 5%

**Solution**:
1. Check for circular dependencies
2. Simplify complex generic types
3. Use type aliases to reduce duplication
4. Consider splitting large type files
5. May need to adjust incremental compilation settings

---

## Contact & Resources

**Epic Owner**: [Tech Lead Name]
**Questions**: Post in #engineering Slack channel

**Documentation**:
- Full Story Breakdown: `docs/refactoring/EPIC-001-story-breakdown.md`
- Story Map: `docs/refactoring/EPIC-001-story-map.md`
- Dependency Graph: `docs/refactoring/EPIC-001-dependency-graph.mmd`

**External Resources**:
- [TypeScript Handbook: Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [Zod Documentation](https://zod.dev/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

---

**Last Updated**: 2025-10-23
**Epic Status**: Ready for Development
