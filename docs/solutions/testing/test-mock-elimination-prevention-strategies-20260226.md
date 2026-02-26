---
title: 'Test Mock Elimination Sprint: Prevention Strategies for 5 Critical Issues'
date: 2026-02-26
category: testing
tags:
  - mock-testing
  - test-infrastructure
  - database-migrations
  - test-isolation
  - missing-modules
  - pre-push-hooks
severity: P1-P2
module: test-infrastructure
symptoms:
  - 'Mock chains return undefined silently instead of failing loudly'
  - '39 database migrations accumulate conflicts and timestamp collisions'
  - 'Shared test state (DEFAULT_PREFERENCES) pollutes tests'
  - 'Mock behavior diverges from real route/service behavior'
  - 'Missing modules cause test file crashes at import time'
  - 'Pre-push hooks block on pre-existing failures in changed files'
---

# Test Mock Elimination Sprint: Prevention Strategies

## Executive Summary

The test mock elimination sprint identified **5 critical infrastructure problems** that systematically cause test failures and false confidence. Each problem represents a category of bugs that recur across sprints unless prevented at the source.

| Issue                     | Root Cause                                        | Prevention                        | Detection                    |
| ------------------------- | ------------------------------------------------- | --------------------------------- | ---------------------------- |
| **Broken Mock Chains**    | Incomplete chaining → silent undefined            | Chainable mock factory pattern    | grep missing methods         |
| **Migration Drift**       | 39 incremental migrations, timestamp collisions   | Pre-migration checks + versioning | Migration pre-push hook      |
| **Shared Mutable State**  | Reused test objects without cloning               | `structuredClone()` in beforeEach | Search for `= DEFAULT_`      |
| **Mock vs Reality**       | Tests mock fake behavior (400 vs 200)             | Real behavior table in brief      | Code review + run real test  |
| **Missing Modules**       | Imported but never created (analytics-service)    | Module dependency matrix          | Import path linter           |
| **Pre-Push Whack-a-Mole** | Hook runs with `--bail 1`, blocks on old failures | Filter to new files only          | Check `git diff --name-only` |

---

## Issue 1: Broken Mock Chains — Silent Undefined Returns

### Root Cause

Mock Supabase client implemented methods individually without supporting chaining. Tests called `.from().select().eq()` but the chain broke after `.select()`, returning undefined instead of failing loudly.

```typescript
// ❌ BROKEN: Incomplete chain
const mockDb = {
  from: () => ({
    select: () => undefined, // Breaks here!
  }),
};

const result = mockDb.from('users').select('*').eq('id', 1);
// result === undefined, test silently passes
```

### Prevention Strategy

#### A. Chainable Mock Factory Pattern

Create a reusable factory that supports arbitrary chaining depth:

```typescript
// test-utils/supabase-mock.ts
export function createChainableMock<T = any>(): T {
  return new Proxy(
    {},
    {
      get: () => createChainableMock<T>(), // Any property access returns another mock
    }
  ) as T;
}

// Usage in tests
const mockDb = {
  from: () => createChainableMock(),
  rpc: () => createChainableMock(),
  auth: {
    admin: {
      createUser: () => createChainableMock(),
    },
  },
};

// Now all of these work without breaking
mockDb.from('users').select('*').eq('id', 1).order('created_at').limit(10);
mockDb.rpc('some_function').returns(data);
mockDb.auth.admin.createUser({ email: 'test@test.com' }).then(() => {});
```

#### B. Return Values Strategy

For chains that need to return actual data, extend the pattern:

```typescript
export function createChainableMockWithData<T = any>(defaultValue: T): T {
  return new Proxy(
    {},
    {
      get: (target, prop) => {
        // Specific terminal methods return data
        if (prop === 'data') return defaultValue;
        if (prop === 'error') return null;
        if (prop === 'count') return defaultValue?.length ?? 0;

        // Everything else chains
        return createChainableMockWithData(defaultValue);
      },
    }
  ) as T;
}

// Usage
const mockUsers = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];
const mockDb = {
  from: () => createChainableMockWithData(mockUsers),
};

const result = mockDb.from('users').select('*').eq('id', 1);
console.log(result.data); // mockUsers
console.log(result.count); // 2
```

#### C. Assertion-Friendly Mocks (Catch Silent Failures)

Make mocks throw on suspicious patterns:

```typescript
export function createStrictChainableMock(allowedMethods: string[]): any {
  return new Proxy(
    {},
    {
      get: (target, prop: string) => {
        if (prop === 'data' || prop === 'error' || prop === 'count') {
          return undefined; // Terminal properties
        }

        if (!allowedMethods.includes(prop)) {
          throw new Error(
            `MockDb: Method .${prop}() not allowed. Allowed: ${allowedMethods.join(', ')}`
          );
        }

        return createStrictChainableMock(allowedMethods);
      },
    }
  );
}

// Usage — catches typos like .selct() instead of .select()
const mockDb = createStrictChainableMock(['from', 'select', 'eq', 'order', 'limit']);
// mockDb.from('users').selct('*') → throws!
```

### Detection Mechanism

#### Pre-Commit Hook

```bash
#!/bin/bash
# scripts/detect-incomplete-mock-chains.sh

# Find all mock definitions
grep -r "from.*().*{" packages/ --include="*.test.ts" --include="*.mock.ts" | \
while read file; do
  # Check if they return createChainableMock or Proxy
  if ! grep -A 5 "$file" | grep -qE "createChainableMock|Proxy|chainable"; then
    echo "ERROR: Incomplete mock chain in $file"
    echo "Use createChainableMock() for service mocks"
    exit 1
  fi
done

# Find tests that access undefined results from chains
grep -r "\..*\(\)\..*\(\)" packages/ --include="*.test.ts" | \
grep -v "const.*=" | \
grep -v "expect\(" | \
while read line; do
  echo "WARNING: Chained call without assertion or assignment: $line"
done
```

#### Code Review Checklist

When reviewing tests with mocks:

- [ ] Mock chains return `this` or Proxy (not undefined)
- [ ] Terminal methods documented (`.data`, `.error`, etc.)
- [ ] Test asserts return value, not undefined
- [ ] All methods in actual service covered by mock
- [ ] Strict mode enabled (`createStrictChainableMock`)

### Checklist Item for Future Sprints

**Before merging any test changes:**

```markdown
## Test Infrastructure Checklist

### Mock Chain Integrity

- [ ] All Supabase mocks use `createChainableMock()` factory
- [ ] No plain object mocks with undefined returns
- [ ] Mock chain methods tested independently in mock unit tests
- [ ] Assertions on mock return values (not just "doesn't crash")
- [ ] Pre-commit hook `detect-incomplete-mock-chains.sh` passes
```

---

## Issue 2: Migration Drift — 39 Conflicting Incremental Migrations

### Root Cause

39 incremental SQL migrations accumulated across 4 months with:

- **Timestamp collisions**: Two migrations with same `20260210` timestamp
- **Reserved SQL words**: Column named `user` (reserved in SQL)
- **Wrong column references**: Migrations referencing `user_id` after it was renamed to `payer_id`
- **macOS Finder artifacts**: Copy operation created " 2.sql" files (space prefix) that silently failed
- **No validation**: Migrations applied without checking for conflicts before execution

```bash
# ❌ Broken migration accumulation
migrations/
├── 20260210_1_create_users.sql
├── 20260210_2_add_preferences.sql    # Collision!
├── 20260215_create_payments.sql
├── 20260215_create_payments 2.sql    # macOS copy artifact
├── 20260220_add_user_id_fk.sql
├── 20260225_rename_user_id_to_payer_id.sql
└── 20260225_add_user_reference.sql   # Still references old `user_id`!
```

### Prevention Strategy

#### A. Migration Versioning Convention

Use ISO 8601 + sequence number with strict validation:

```typescript
// Migration filename pattern: YYYYMMDD_NNN_description.sql
// NNN = 3-digit sequence, increments per day

// ✅ Correct
migrations/20260210_001_create_users.sql
migrations/20260210_002_create_payments.sql
migrations/20260215_001_update_schema.sql

// ❌ Wrong
migrations/20260210_create_users.sql      // Missing sequence
migrations/20260210_1_create_users.sql    // Single digit
migrations/20260210_1.sql                 // No description
migrations/20260210 create users.sql      // Spaces!
```

#### B. Pre-Migration Validation

Create a migration validator that runs before applying:

```typescript
// scripts/validate-migrations.ts
import fs from 'fs';
import path from 'path';

export async function validateMigrations(migrationDir: string) {
  const files = fs
    .readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const errors: string[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    // Pattern: YYYYMMDD_NNN_description.sql
    const match = file.match(/^(\d{8})_(\d{3})_(.+)\.sql$/);
    if (!match) {
      errors.push(`Invalid filename: "${file}". Use YYYYMMDD_NNN_description.sql`);
      continue;
    }

    const [, date, seq, desc] = match;
    const dateNum = parseInt(date);
    const seqNum = parseInt(seq);

    // Check for timestamp collisions
    const key = `${date}_${seq}`;
    if (seen.has(key)) {
      errors.push(`Timestamp collision: "${file}" and "${seen.get(key)}" both use ${date} ${seq}`);
    }
    seen.set(key, file);

    // Check for reserved SQL words in filename
    if (/\b(user|order|group|select|from|where|create)\b/i.test(desc)) {
      errors.push(
        `Reserved SQL word in migration: "${file}". Avoid: user, order, group, select, etc.`
      );
    }

    // Check for macOS copy artifacts
    if (/ \d+\.sql$/.test(file)) {
      errors.push(`macOS copy artifact detected: "${file}". Remove and use proper naming.`);
    }

    // Read content for additional checks
    const content = fs.readFileSync(path.join(migrationDir, file), 'utf-8');

    // Check for column references to renamed columns
    const renames = extractColumnRenames(content);
    for (const rename of renames) {
      const laterMigrations = files.slice(files.indexOf(file) + 1);
      for (const later of laterMigrations) {
        const laterContent = fs.readFileSync(path.join(migrationDir, later), 'utf-8');
        if (laterContent.includes(rename.oldName)) {
          errors.push(
            `Migration "${file}" renames column "${rename.oldName}" to "${rename.newName}", ` +
              `but "${later}" still references old name`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('Migration validation failed:');
    errors.forEach((e) => console.error(`  ❌ ${e}`));
    process.exit(1);
  }

  console.log(`✅ All ${files.length} migrations valid`);
}

function extractColumnRenames(sql: string): Array<{ oldName: string; newName: string }> {
  const renames: Array<{ oldName: string; newName: string }> = [];

  // Match: ALTER TABLE ... RENAME COLUMN old_name TO new_name
  const pattern = /ALTER\s+TABLE\s+\w+\s+RENAME\s+COLUMN\s+(\w+)\s+TO\s+(\w+)/gi;
  let match;
  while ((match = pattern.exec(sql)) !== null) {
    renames.push({ oldName: match[1], newName: match[2] });
  }

  return renames;
}

// Run in pre-push hook
if (require.main === module) {
  validateMigrations('./packages/backend/migrations').catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

#### C. Migration Locking & Safety Checks

```bash
#!/bin/bash
# scripts/pre-push-migration-check.sh

# Prevent push if migrations have issues
MIGRATION_DIR="packages/backend/migrations"

# Check 1: No macOS copy artifacts
if find "$MIGRATION_DIR" -name "* *.sql" 2>/dev/null | grep -q .; then
  echo "ERROR: Found macOS copy artifacts in migrations (files with spaces)"
  find "$MIGRATION_DIR" -name "* *.sql" -exec echo "  - {}" \;
  exit 1
fi

# Check 2: No duplicate timestamps
TIMESTAMPS=$(find "$MIGRATION_DIR" -name "*.sql" | sed 's/_[0-9]*_[^_]*.sql//' | sort)
UNIQUE_TIMESTAMPS=$(echo "$TIMESTAMPS" | sort -u)

if [ "$(echo "$TIMESTAMPS" | wc -l)" -ne "$(echo "$UNIQUE_TIMESTAMPS" | wc -l)" ]; then
  echo "ERROR: Duplicate migration timestamps detected"
  echo "$TIMESTAMPS" | sort | uniq -d | while read dup; do
    echo "  Migrations starting with: $dup"
  done
  exit 1
fi

# Check 3: Run TypeScript validator
npx ts-node scripts/validate-migrations.ts

echo "✅ Migration validation passed"
exit 0
```

### Detection Mechanism

#### Git Hook

```bash
# .git/hooks/pre-push
#!/bin/bash
source scripts/pre-push-migration-check.sh
```

#### CI/CD Gate

```yaml
# .github/workflows/quality-gates.yml
- name: Validate Migrations
  run: npm run validate:migrations
  if: contains(github.event.head_commit.modified, 'migrations')
```

### Checklist Item for Future Sprints

```markdown
## Database Migration Checklist

### Before Creating a Migration

- [ ] Use YYYYMMDD_NNN_description.sql naming (NNN = 3-digit sequence)
- [ ] Check existing migrations for timestamp conflicts
- [ ] No spaces in filename (macOS copy artifacts)
- [ ] No reserved SQL words in table/column names
- [ ] Run `npm run validate:migrations` locally
- [ ] If renaming column, check all later migrations for old name usage
- [ ] Reversibility: include UP and DOWN in Umzug config

### Pre-Push Validation

- [ ] `scripts/pre-push-migration-check.sh` passes
- [ ] `npm test packages/backend` passes (migrations tested)
- [ ] No migration files with spaces
- [ ] All timestamps unique

### Code Review

- [ ] Migration describes what changed (clear description)
- [ ] No hardcoded credentials in migration
- [ ] Idempotent (safe to run twice)
- [ ] Tested in test environment first
```

---

## Issue 3: Shared Mutable Test State — Object Reuse Across Tests

### Root Cause

Test helper exported a mutable object that was reused across tests:

```typescript
// ❌ BROKEN: Shared mutable state
export const DEFAULT_PREFERENCES = {
  notifications: true,
  theme: 'light',
  language: 'en',
};

// Test 1
it('disables notifications', () => {
  const prefs = DEFAULT_PREFERENCES;
  prefs.notifications = false;
  // ...
});

// Test 2 (affected by Test 1)
it('checks notification default', () => {
  expect(DEFAULT_PREFERENCES.notifications).toBe(true); // FAILS! Set to false by Test 1
});
```

Test order dependency → flaky tests that pass individually but fail when run together.

### Prevention Strategy

#### A. Deep Clone in beforeEach

```typescript
// ❌ WRONG: Reuses object
beforeEach(() => {
  prefs = DEFAULT_PREFERENCES;
});

// ✅ RIGHT: Clone via structuredClone (ES2022 standard)
beforeEach(() => {
  prefs = structuredClone(DEFAULT_PREFERENCES);
});

// Fallback for older Node.js:
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

beforeEach(() => {
  prefs = deepClone(DEFAULT_PREFERENCES);
});
```

#### B. Immutable Default Objects

```typescript
// ✅ BETTER: Freeze defaults
export const DEFAULT_PREFERENCES = Object.freeze({
  notifications: true,
  theme: 'light',
  language: 'en',
} as const);

// Now mutations fail loudly
const prefs = DEFAULT_PREFERENCES;
prefs.notifications = false; // TypeError: Cannot assign to read-only property

// Force explicit cloning
beforeEach(() => {
  prefs = { ...DEFAULT_PREFERENCES }; // Spread for shallow copy
  // or
  prefs = structuredClone(DEFAULT_PREFERENCES); // Deep copy
});
```

#### C. Factory Pattern (Most Explicit)

```typescript
// ✅ BEST: Factory function
export function createDefaultPreferences() {
  return {
    notifications: true,
    theme: 'light',
    language: 'en',
  };
}

// No shared state
let prefs: ReturnType<typeof createDefaultPreferences>;

beforeEach(() => {
  prefs = createDefaultPreferences(); // Always fresh
});

describe('preferences', () => {
  it('disables notifications', () => {
    const modified = createDefaultPreferences();
    modified.notifications = false;
    // No impact on other tests
  });

  it('checks default', () => {
    expect(createDefaultPreferences().notifications).toBe(true); // Always true
  });
});
```

### Detection Mechanism

#### ESLint Rule

```javascript
// eslint-plugin-test-isolation.js
module.exports = {
  rules: {
    'no-mutable-test-state': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Detect shared mutable state in tests',
        },
      },
      create(context) {
        return {
          VariableDeclarator(node) {
            if (node.id.name.match(/^(DEFAULT_|MOCK_|TEST_)/)) {
              const init = node.init;

              // Object or array literals are mutable
              if (init && (init.type === 'ObjectExpression' || init.type === 'ArrayExpression')) {
                context.report({
                  node,
                  message: `"${node.id.name}" is mutable. Wrap in Object.freeze() or use a factory function`,
                  fix(fixer) {
                    return fixer.replaceText(init, `Object.freeze(${init.raw})`);
                  },
                });
              }
            }
          },

          // Detect direct mutation of shared state
          AssignmentExpression(node) {
            if (
              node.left.type === 'MemberExpression' &&
              node.left.object.name &&
              node.left.object.name.match(/^(DEFAULT_|MOCK_|TEST_)/)
            ) {
              context.report({
                node,
                message: `Mutating shared state "${node.left.object.name}". Clone in beforeEach first.`,
              });
            }
          },
        };
      },
    },
  },
};
```

#### Grep Check

```bash
#!/bin/bash
# scripts/detect-shared-test-state.sh

# Find test files that mutate exported DEFAULT_ constants
grep -r "DEFAULT_\|MOCK_\|TEST_" packages/ \
  --include="*.test.ts" --include="*.test.tsx" \
  --include="*.spec.ts" --include="*.spec.tsx" | \
grep -E "=\s+(DEFAULT_|MOCK_|TEST_)" | \
while read line; do
  # Check if it's a direct assignment (not in beforeEach/beforeAll)
  if ! echo "$line" | grep -qE "beforeEach|beforeAll|createDefault|structuredClone"; then
    echo "WARNING: Possible shared mutable state: $line"
  fi
done
```

### Checklist Item for Future Sprints

```markdown
## Test Isolation Checklist

### Test Data Management

- [ ] All exported test data use `Object.freeze()` or factory functions
- [ ] `beforeEach` clones mutable objects with `structuredClone()`
- [ ] No shared state mutations (const prefs = DEFAULT_X; prefs.y = z)
- [ ] Test data named clearly: DEFAULT*\*, MOCK*_, createTest_()
- [ ] ESLint rule `no-mutable-test-state` enabled and passing

### State Isolation

- [ ] Each test gets fresh objects/services
- [ ] No dependencies between test execution order
- [ ] Tests pass when run individually
- [ ] Tests pass when run in parallel

### Code Review

- [ ] No `const x = shared_object; x.property = value;` mutations
- [ ] All shared constants frozen or in factories
- [ ] beforeEach includes cloning step for mutable state
```

---

## Issue 4: Mock vs Reality Divergence — Tests Pass with Wrong Behavior

### Root Cause

Tests mocked API responses with different behavior than actual routes:

```typescript
// ❌ BROKEN: Mock returns 200 with data
test('update user', async () => {
  mockApi.onPatch('/api/users/1').reply(200, { success: true, data: { id: 1, name: 'Alice' } });

  const result = await updateUser({ id: 1, name: 'Alice' });
  expect(result).toEqual({ id: 1, name: 'Alice' });
});

// 🚨 But the REAL API returns 400 validation error
// PUT /api/users
// Request: { id: 1, name: 'Alice' }
// Response: { error: { code: 'INVALID_PAYLOAD', ... } }
// Status: 400
```

Tests pass in CI but fail in production.

### Prevention Strategy

#### A. Real Behavior Documentation

Create a behavior matrix that documents actual API responses:

```typescript
// test-utils/api-behavior-matrix.ts
export const API_BEHAVIOR = {
  'POST /api/users': {
    '200': {
      description: 'User created successfully',
      request: { name: string; email: string },
      response: { id: UUID; created_at: ISO8601 },
      validations: ['email must be valid', 'name must be non-empty'],
    },
    '400': {
      description: 'Validation failed',
      response: { error: { code: 'VALIDATION_ERROR'; details: ValidationError[] } },
      causes: ['Email invalid', 'Name empty'],
    },
    '409': {
      description: 'User already exists',
      response: { error: { code: 'USER_EXISTS'; message: string } },
      causes: ['Email already registered'],
    },
  },
  'PATCH /api/users/:id': {
    '200': { /* ... */ },
    '400': { /* ... */ },
    '401': {
      description: 'Unauthorized',
      response: { error: { code: 'UNAUTHORIZED' } },
    },
    '403': {
      description: 'Forbidden (not own resource)',
      response: { error: { code: 'FORBIDDEN' } },
    },
    '404': {
      description: 'User not found',
      response: { error: { code: 'NOT_FOUND' } },
    },
  },
} as const;

// Usage in tests
test('returns 400 for invalid email', async () => {
  // Reference real behavior
  const behavior = API_BEHAVIOR['POST /api/users']['400'];

  const result = await createUser({ name: 'Bob', email: 'invalid' });

  expect(result.status).toBe(400);
  expect(result.body.error.code).toBe('VALIDATION_ERROR');
});
```

#### B. Run Real Test First, Mock Later

Change the test writing approach:

```typescript
// 1. FIRST: Write test against REAL API (integration test)
import request from 'supertest';
import app from '../app';

describe('POST /api/users - REAL BEHAVIOR', () => {
  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/api/users').send({ name: 'Bob', email: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    console.log('Real response:', JSON.stringify(res.body, null, 2));
  });
});

// 2. THEN: Document the behavior
// This shows the REAL output format

// 3. THEN: Create mock that matches EXACTLY
const mockCreateUser = vi
  .fn()
  .mockRejectedValue(new ValidationError('invalid_email', 'Email must be valid'));

// 4. Test against mock
test('handles validation error', async () => {
  try {
    await createUser({ name: 'Bob', email: 'invalid' });
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe('invalid_email');
  }
});
```

#### C. Snapshot Testing for API Contracts

```typescript
// Use snapshots to lock API shape
test('user creation response shape', async () => {
  const res = await request(app)
    .post('/api/users')
    .send({ name: 'Alice', email: 'alice@test.com' });

  expect(res.body).toMatchSnapshot();
});

// Snapshot file: user-creation.snap.ts
export const snap = {
  'returns 200 with user data': {
    id: 'uuid-v4-format',
    name: 'Alice',
    email: 'alice@test.com',
    created_at: 'ISO-8601-timestamp',
    role: 'creator', // New field added
  },
};
```

When API changes, snapshot test fails → forces explicit review before merging.

### Detection Mechanism

#### Code Review: Real vs Mock Validation

In PR review, for each mocked endpoint:

````markdown
### Mock Behavior Verification

For endpoint: POST /api/users

- [ ] Mock response shape matches actual endpoint response?
- [ ] Mock error codes match actual validation?
- [ ] Mock status codes (200, 400, 401, 403, 404) match real responses?
- [ ] Mock data constraints (max length, enum values) match actual?

**How to verify:**

1. Run integration test against real endpoint:
   ```bash
   npm run test:integration -- --grep "POST /api/users"
   ```
````

2. Check actual response in browser dev tools
3. Update mock to match exactly

**Red flags:**

- Mock doesn't include error case (4xx/5xx)
- Status codes differ (mock: 200, real: 400)
- Response shape different (mock has extra fields)
- Error messages don't match Zod validation output

````

#### Linter Rule

```javascript
// eslint-plugin-api-mock-sync.js
module.exports = {
  rules: {
    'mock-response-matches-real': {
      create(context) {
        return {
          'CallExpression > Identifier[name="mockApi"]': function(node) {
            const args = node.parent.arguments;
            if (!args[0]?.value) return;

            const endpoint = args[0].value; // 'GET /api/users'
            const comment = getJSDocComment(node);

            if (!comment || !comment.includes('@real-response')) {
              context.report({
                node,
                message:
                  `Mock for "${endpoint}" should document real response shape. ` +
                  `Add JSDoc: @real-response { status: 200, body: { ... } }`,
              });
            }
          },
        };
      },
    },
  },
};
````

### Checklist Item for Future Sprints

```markdown
## Mock/Real Behavior Sync Checklist

### Before Writing Mock Tests

- [ ] Run integration test against REAL endpoint first
- [ ] Document actual response shape (status code, body structure, error codes)
- [ ] Check for all HTTP status code branches (200, 400, 401, 403, 404)
- [ ] Capture actual error message format (especially Zod validation output)

### Mock Implementation

- [ ] Mock response shape EXACTLY matches real response
- [ ] Mock status codes match real endpoints
- [ ] Mock error messages match Zod/actual validation
- [ ] Mock includes error cases, not just happy path (200)
- [ ] JSDoc comment: @real-response { status: X, body: {...} }

### Test Structure

- [ ] Integration test (real API) runs first in PR
- [ ] Mock test documents behavior from integration test
- [ ] Snapshot test locks API contract
- [ ] Any divergence from real API is explicit (with comment)

### Code Review

- [ ] Reviewer checks integration test output
- [ ] Reviewer compares mock response to real response
- [ ] Status codes verified
- [ ] Error handling tested (not just happy path)
```

---

## Issue 5: Missing Modules Blocking Test Collection

### Root Cause

`analytics-service.ts` was imported by 8+ service files but never created. Tests crashed at import time before any tests ran:

```typescript
// ❌ services/user-analytics-service.ts
import { AnalyticsService } from '../services/analytics-service'; // Doesn't exist!

export class UserAnalyticsService {
  constructor(private analytics: AnalyticsService) {}
}

// When Vitest tries to import this file:
// Error: Cannot find module '../services/analytics-service'
// 8 test files importing UserAnalyticsService crash before running
```

### Prevention Strategy

#### A. Module Dependency Matrix

Create a manifest of all imports and verify existence:

```typescript
// scripts/validate-module-imports.ts
import fs from 'fs';
import path from 'path';
import { parse } from '@swc/core';

export async function validateModuleImports(srcDir: string) {
  const errors: string[] = [];
  const modules = new Map<string, string[]>(); // module -> [importers]

  // Scan all files
  const files = getAllTypeScriptFiles(srcDir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const imports = extractImportPaths(content);

    for (const importPath of imports) {
      const resolved = resolveImportPath(file, importPath);

      if (!fs.existsSync(resolved) && !fs.existsSync(resolved + '.ts')) {
        const importers = modules.get(resolved) || [];
        importers.push(file);
        modules.set(resolved, importers);

        errors.push(
          `Module not found: "${importPath}"\n` +
            `  Imported by: ${file}\n` +
            `  Expected location: ${resolved}`
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} missing modules:\n`);
    errors.forEach((e) => console.error(e + '\n'));

    console.log('\nDependency graph of missing modules:');
    modules.forEach((importers, module) => {
      console.log(`\n${module}`);
      importers.forEach((imp) => console.log(`  ← ${imp}`));
    });

    process.exit(1);
  }

  console.log(`✅ All imports valid (${files.length} files)`);
}

function extractImportPaths(content: string): string[] {
  const imports: string[] = [];

  // Match: import { ... } from 'path'
  const pattern = /import\s+(?:{[^}]+}|[^'"\s]+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function resolveImportPath(fromFile: string, importPath: string): string {
  if (importPath.startsWith('@/')) {
    return importPath.replace('@/', 'src/');
  }
  if (importPath.startsWith('.')) {
    return path.resolve(path.dirname(fromFile), importPath);
  }
  return importPath;
}
```

#### B. Test Import Safety Check

```typescript
// test-utils/validate-test-imports.ts
import fs from 'fs';
import Module from 'module';

/**
 * Ensures all test files can be imported without errors.
 * Runs at test startup before any tests execute.
 */
export async function validateTestImports(testFiles: string[]) {
  const errors: { file: string; error: Error }[] = [];

  for (const testFile of testFiles) {
    try {
      // Try to import the test file
      await import(testFile);
    } catch (error) {
      errors.push({
        file: testFile,
        error: error as Error,
      });
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Test files with import errors:\n');
    errors.forEach(({ file, error }) => {
      console.error(`${file}`);
      console.error(`  Error: ${error.message}\n`);
    });

    process.exit(1);
  }

  console.log(`✅ All ${testFiles.length} test files import successfully`);
}

// In vitest setup file:
import { beforeAll } from 'vitest';
import { globSync } from 'glob';

beforeAll(async () => {
  const testFiles = globSync('packages/**/src/**/*.test.ts');
  await validateTestImports(testFiles);
});
```

#### C. Missing Service Stubs

For required-but-not-yet-created services, create stub implementations:

```typescript
// services/analytics-service.ts (STUB)
/**
 * @stub This service is referenced by multiple packages but not yet implemented.
 * TODO: Implement after #XXX is completed.
 *
 * Currently used by:
 * - UserAnalyticsService
 * - DashboardService
 * - ActivityMonitor
 */

export class AnalyticsService {
  // Minimal stub to prevent import errors

  trackEvent(event: string, data: unknown): void {
    // TODO: Implement event tracking
    console.warn('[STUB] Analytics.trackEvent called:', event);
  }

  trackPageView(page: string): void {
    // TODO: Implement page view tracking
    console.warn('[STUB] Analytics.trackPageView called:', page);
  }
}
```

Mark stubs clearly so they're visible in code review.

### Detection Mechanism

#### Pre-Push Hook

```bash
#!/bin/bash
# scripts/pre-push-validate-imports.sh

echo "Validating module imports..."
npx ts-node scripts/validate-module-imports.ts

if [ $? -ne 0 ]; then
  echo ""
  echo "ERROR: Missing modules detected. Create stubs or update imports."
  echo "To see the dependency graph: npm run analyze:imports"
  exit 1
fi

echo "✅ All imports valid"
exit 0
```

#### Build-Time Check

```bash
npm run type-check  # TypeScript will catch import errors
```

### Checklist Item for Future Sprints

```markdown
## Module Import Safety Checklist

### Before Creating Service/Module

- [ ] Check if service is already imported elsewhere
- [ ] If imported but not created, create stub with TODO comment
- [ ] If new service, document all current importers
- [ ] Run `npm run validate:imports` before committing

### Before Refactoring Imports

- [ ] Update all import paths (use IDE refactoring tool)
- [ ] Verify no circular imports: `npm run analyze:circular-deps`
- [ ] TypeScript compiler passes: `npm run type-check`
- [ ] All imports resolvable: `npm run validate:imports`

### Test Setup

- [ ] Vitest setup includes `validateTestImports()` at startup
- [ ] All test files importable before first test runs
- [ ] Missing mocks use stubs (clear, marked TODO)

### Code Review

- [ ] New imports point to existing modules or marked stubs?
- [ ] Refactored imports all updated across codebase?
- [ ] No circular dependencies introduced?
- [ ] `npm run validate:imports` passes in PR?
```

---

## Issue 6: Pre-Push Hook Whack-a-Mole — Blocks on Pre-Existing Failures

### Root Cause

Pre-push hook ran with `--bail 1` (stop after first failure):

```bash
# ❌ BROKEN: Blocks on ANY failure in touched files
git diff origin/main...HEAD --name-only | while read file; do
  npx vitest run "$file" --bail 1  # Stops at first failure
done

# Developer pushes 1 file, hook runs all tests in that file
# If ANY existing test was already failing, hook blocks the push
```

Even if the developer's changes are correct, pre-existing failures in the same file prevent the push.

### Prevention Strategy

#### A. Filter to Changed Lines Only

```bash
#!/bin/bash
# scripts/pre-push-tests.sh

# Get files changed since origin/main
CHANGED_FILES=$(git diff origin/main...HEAD --name-only | grep -E '\.test\.(ts|tsx)$')

if [ -z "$CHANGED_FILES" ]; then
  echo "✅ No test files changed"
  exit 0
fi

echo "Running tests for changed files:"
echo "$CHANGED_FILES" | sed 's/^/  /'

# Run ONLY changed test files, don't stop at first failure
# This allows review to show all new failures at once
npx vitest run $CHANGED_FILES --reporter=verbose

TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  echo ""
  echo "⚠️  Some tests failed. Review above for:"
  echo "  1. New failures (introduced by your changes) → must fix"
  echo "  2. Pre-existing failures (not your change) → OK to push, will be triaged"
  exit $TEST_EXIT
fi

echo "✅ All tests in changed files pass"
exit 0
```

#### B. Separate New vs Pre-Existing Failures

```bash
#!/bin/bash
# scripts/test-delta-analysis.sh

# Compare test results before and after changes
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Run tests on origin/main
git stash
git checkout origin/main 2>/dev/null
BEFORE=$(npx vitest run --reporter=json 2>/dev/null | jq '.stats.failures')
git checkout "$ORIGINAL_BRANCH"
git stash pop

# Run tests on current branch
AFTER=$(npx vitest run --reporter=json 2>/dev/null | jq '.stats.failures')

NEW_FAILURES=$((AFTER - BEFORE))

if [ "$NEW_FAILURES" -gt 0 ]; then
  echo "❌ $NEW_FAILURES NEW test failures introduced by this branch"
  exit 1
elif [ "$NEW_FAILURES" -lt 0 ]; then
  echo "✅ $((BEFORE - AFTER)) test failures FIXED by this branch"
  exit 0
else
  echo "✅ No new test failures (pre-existing: $BEFORE)"
  exit 0
fi
```

#### C. Aggregate Results, Don't Bail on First Failure

```bash
#!/bin/bash
# scripts/pre-push-test-aggregation.sh

CHANGED_FILES=$(git diff origin/main...HEAD --name-only | grep -E '\.test\.(ts|tsx)$')

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

FAILED_TESTS=""
PASS_COUNT=0
FAIL_COUNT=0

# Run each file, collect results (don't stop on first failure)
while IFS= read -r file; do
  echo "Testing: $file"

  if npx vitest run "$file" --reporter=silent 2>&1; then
    ((PASS_COUNT++))
  else
    ((FAIL_COUNT++))
    FAILED_TESTS="$FAILED_TESTS\n  - $file"
  fi
done <<< "$CHANGED_FILES"

echo ""
echo "Results: $PASS_COUNT passed, $FAIL_COUNT failed"

if [ $FAIL_COUNT -gt 0 ]; then
  echo ""
  echo "Failed test files:$FAILED_TESTS"
  echo ""
  echo "⚠️  Review failures above. If pre-existing, safe to push."
  exit 1
fi

echo "✅ All changed test files pass"
exit 0
```

#### D. Document the Hook Philosophy

```bash
#!/bin/bash
# scripts/PRE_PUSH_PHILOSOPHY.md

# Pre-Push Hook Strategy
#
# Goal: Prevent pushing code that INTRODUCES new failures
# NOT: Prevent pushing when pre-existing failures exist
#
# Difference:
#
# ❌ WRONG:
#   if any test in touched file fails:
#     block push
#
#   This blocks developers even if they didn't cause the failure
#
# ✅ RIGHT:
#   if new failures introduced by this branch:
#     block push
#
#   If tests were already failing (pre-existing):
#     allow push (will be triaged separately)
#
# Implementation:
#   1. Get changed files: git diff origin/main...HEAD --name-only
#   2. Run tests only in changed files
#   3. Compare results to origin/main
#   4. Block only on NEW failures
#
# Benefits:
#   - Developers don't get blocked by unrelated failures
#   - Pre-existing failures get triaged separately
#   - Faster feedback loop
#   - Clear separation of concerns
```

### Detection Mechanism

#### CI Gate (More Reliable)

Move test validation from pre-push hook to CI:

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on:
  pull_request:
    branches: [main]

jobs:
  test-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get changed test files
        id: changed
        run: |
          FILES=$(git diff origin/main...HEAD --name-only | grep -E '\.test\.(ts|tsx)$' | xargs)
          echo "files=$FILES" >> $GITHUB_OUTPUT

      - name: Run tests for changed files
        if: steps.changed.outputs.files != ''
        run: npx vitest run ${{ steps.changed.outputs.files }}

      - name: Compare to main
        run: |
          # Get failure count on main
          git stash
          git checkout origin/main
          BEFORE=$(npm test 2>&1 | grep -c "FAIL\|✕" || true)
          git checkout -
          git stash pop

          # Get failure count on branch
          AFTER=$(npm test 2>&1 | grep -c "FAIL\|✕" || true)

          NEW=$((AFTER - BEFORE))

          if [ $NEW -gt 0 ]; then
            echo "::error::$NEW new test failures introduced"
            exit 1
          fi
```

### Checklist Item for Future Sprints

```markdown
## Pre-Push Hook Checklist

### Hook Configuration

- [ ] Runs only on CHANGED test files (not all files touching module)
- [ ] Doesn't stop at first failure (`--bail 0` or aggregates results)
- [ ] Compares to origin/main (captures new failures only)
- [ ] Clear output showing pass/fail per file
- [ ] Timeout reasonable (30+ seconds for slow machines)

### Logic

- [ ] Pre-existing failures don't block push
- [ ] New failures introduced by this commit block push
- [ ] Documentation explains philosophy in hook comment
- [ ] Developers understand when hook blocks (and when it shouldn't)

### Alternative: CI Gate (Recommended)

- [ ] Use GitHub Actions for test validation instead of hook
- [ ] Hook serves only as local feedback (non-blocking warning)
- [ ] CI blocks merge if new failures detected
- [ ] Clearer separation between local dev and merge gates

### Code Review

- [ ] Hook configuration documented in CONTRIBUTING.md
- [ ] New test files don't silence failures (`--bail 0`)
- [ ] Pre-push hook doesn't interfere with CI
```

---

## Cross-Cutting Prevention Summary

### Common Pattern Across All Issues

Every issue had the same root cause: **No automated detection + no enforcement = systematic accumulation**.

| Issue             | Missing Detection      | Missing Enforcement         |
| ----------------- | ---------------------- | --------------------------- |
| Broken mocks      | Grep for mock patterns | Pre-commit hook             |
| Migration drift   | Validation script      | Pre-push gate               |
| Shared state      | ESLint rule            | Code review + pre-commit    |
| Mock divergence   | Behavior matrix docs   | Integration test + snapshot |
| Missing modules   | Import validator       | Pre-push + test startup     |
| Hook whack-a-mole | Delta analysis         | CI gate (not hook)          |

### Universal Prevention Framework

```typescript
// For ANY recurring issue, establish 3 layers:

// Layer 1: Detection (automated grep/lint)
// Layer 2: Prevention (pre-commit/pre-push)
// Layer 3: Enforcement (CI gate + code review)
// Layer 4: Documentation (pattern file + example)
```

Apply to next issue that emerges:

1. **Detect**: Write grep/ESLint rule to find it
2. **Prevent**: Add to pre-commit hook or linting
3. **Enforce**: Add to CI gate (make it blocking)
4. **Document**: Add to `docs/solutions/patterns/`

---

## Integration into Development Workflow

### For Code Review

Use this checklist when reviewing tests:

```markdown
## Test Infrastructure Review

### Mock Chain Quality

- [ ] Mocks use `createChainableMock()` or similar
- [ ] No undefined returns from chains
- [ ] Terminal methods (.data, .error) documented

### Database Changes

- [ ] New migrations use YYYYMMDD_NNN_desc.sql pattern
- [ ] No duplicate timestamps with existing migrations
- [ ] `npm run validate:migrations` passes
- [ ] No column name references to renamed columns in later migrations

### Test Data

- [ ] No shared mutable state (DEFAULT*\*, MOCK*\*)
- [ ] All test data cloned in beforeEach or frozen
- [ ] Factory functions used for complex data

### Mock Accuracy

- [ ] Mock response shape matches real endpoint
- [ ] Status codes match real API (not just 200)
- [ ] Error messages match Zod validation output
- [ ] All HTTP branches covered (200, 400, 401, 403, 404)

### Module Safety

- [ ] All imports resolvable (test `npm run validate:imports`)
- [ ] No missing service stubs
- [ ] Test files importable before running tests

### Hook Configuration

- [ ] Pre-push doesn't block on pre-existing failures
- [ ] Only validates changed files
- [ ] Clear reporting of new vs pre-existing failures
```

### For Sprint Planning

Before sprint starts:

```markdown
## Quality Gate Readiness

- [ ] All prevention scripts deployed and passing
- [ ] Pre-commit hooks installed: `npm run install:hooks`
- [ ] CI workflows active on PRs
- [ ] Test infrastructure checklist reviewed with team
- [ ] Previous sprint's prevention items still working
```

---

## Appendix: Quick Reference Files

### All scripts mentioned

```bash
scripts/
├── validate-migrations.ts
├── pre-push-migration-check.sh
├── detect-incomplete-mock-chains.sh
├── detect-shared-test-state.sh
├── validate-module-imports.ts
├── validate-test-imports.ts
├── pre-push-test-aggregation.sh
└── test-delta-analysis.sh
```

### ESLint rules mentioned

```javascript
eslint-plugin-test-isolation.js
  └── no-mutable-test-state

eslint-plugin-api-mock-sync.js
  └── mock-response-matches-real
```

### Integration points

```yaml
.git/hooks/
├── pre-commit (add migration + import checks)
├── pre-push (add tests + delta analysis)

.github/workflows/
└── quality-gates.yml (add test-changes job)
```

---

## Summary Table

| Problem                  | Detection         | Prevention           | Enforcement   | Time to Fix |
| ------------------------ | ----------------- | -------------------- | ------------- | ----------- |
| **Broken Mock Chains**   | Grep mock methods | Factory pattern      | Pre-commit    | 1 sprint    |
| **Migration Drift**      | Validator script  | YYYYMMDD_NNN pattern | Pre-push hook | 1 sprint    |
| **Shared Mutable State** | ESLint rule       | structuredClone()    | Code review   | 2 hours     |
| **Mock vs Reality**      | Behavior matrix   | Real test first      | Snapshots     | 2 sprints   |
| **Missing Modules**      | Import validator  | Stub pattern         | Test startup  | 1 sprint    |
| **Hook Whack-a-Mole**    | Delta analysis    | Filter to new files  | CI gate       | 4 hours     |

**Total effort to implement all 6**: ~2-3 sprints for full automation + enforcement

---

**Document Status**: Complete
**Date Created**: February 26, 2026
**Scope**: Prevention strategies for test mock elimination sprint (5 critical issues)
**Next Review**: After first prevention script implementation
