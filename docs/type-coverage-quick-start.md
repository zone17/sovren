# Type Coverage Quick Start Guide

**For**: Sovren Development Team
**Purpose**: Quick reference for using type-coverage tool
**Last Updated**: 2025-10-24

---

## What is Type Coverage?

Type coverage measures the percentage of your TypeScript code that has explicit types (not `any`). Higher coverage means better type safety.

**Current Baseline**: 96.79% (237,262 / 245,112 expressions)
**Target**: 99%

---

## Quick Commands

### Check Current Coverage
```bash
npm run type-coverage
```

**Output**:
```
(237262 / 245112) 96.79%
type-coverage success.
```

### See Detailed List of Untyped Code
```bash
npm run type-coverage:detail
```

**Output** (first few lines):
```
/path/to/file.ts:42:63: variableName
/path/to/file.ts:45:48: anotherVariable
...
```

### Verify Coverage Meets Threshold
```bash
npm run type-coverage:verify
```

This enforces the current baseline of 96.79%. Will fail if coverage drops below.

### Generate Report File
```bash
npm run type-coverage:report
```

Creates `docs/type-coverage-details.txt` with full list of untyped locations.

---

## Interpreting Results

### Example Output
```
/Users/fp/Desktop/Sovren/packages/backend/src/routes/auth.ts:62:63: body
```

**Breakdown**:
- **File**: `packages/backend/src/routes/auth.ts`
- **Line**: 62
- **Column**: 63
- **Untyped symbol**: `body`

**Meaning**: The `body` variable on line 62, column 63 has an implicit `any` type.

### How to Fix

**Before** (untyped):
```typescript
const processRequest = (body) => {
  return body.data;
};
```

**After** (typed):
```typescript
interface RequestBody {
  data: string;
}

const processRequest = (body: RequestBody) => {
  return body.data;
};
```

---

## Common Patterns and Fixes

### Pattern 1: Implicit `any` Parameters

**Problem**:
```typescript
function handler(req, res, next) {
  // TypeScript infers `any` for req, res, next
}
```

**Fix**:
```typescript
import { Request, Response, NextFunction } from 'express';

function handler(req: Request, res: Response, next: NextFunction) {
  // Properly typed
}
```

### Pattern 2: Unknown Error Type

**Problem**:
```typescript
try {
  // code
} catch (error) {
  console.log(error.message); // error is `unknown`
}
```

**Fix**:
```typescript
try {
  // code
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message);
  }
}
```

### Pattern 3: Dynamic Object Access

**Problem**:
```typescript
const config = JSON.parse(data); // config is `any`
```

**Fix Option 1** - Define interface:
```typescript
interface Config {
  apiKey: string;
  timeout: number;
}

const config: Config = JSON.parse(data);
```

**Fix Option 2** - Use Zod for runtime validation:
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  apiKey: z.string(),
  timeout: z.number()
});

const config = ConfigSchema.parse(JSON.parse(data));
```

### Pattern 4: Unused Variables

**Problem**:
```typescript
function middleware(req, res, next) {
  return res.json({ success: true });
  // `req` and `next` are unused
}
```

**Fix**:
```typescript
function middleware(_req: Request, res: Response, _next: NextFunction) {
  return res.json({ success: true });
  // Prefix with underscore to indicate intentionally unused
}
```

---

## Best Practices

### 1. Run Before Committing
```bash
npm run type-coverage:verify
```

Ensure your changes don't reduce coverage.

### 2. Focus on High-Impact Files

Check the top files with most untyped code:
```bash
npm run type-coverage:detail | grep "your-file.ts"
```

### 3. Incremental Improvements

Don't try to fix everything at once. Target:
- One file per commit
- One type category per PR
- Weekly coverage improvements

### 4. Use Type Guards

```typescript
// Type guard
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Usage
try {
  // code
} catch (error) {
  if (isError(error)) {
    console.log(error.message); // TypeScript knows it's Error
  }
}
```

### 5. Prefer Explicit Over Implicit

**Bad**:
```typescript
const data = await fetchData(); // implicit any
```

**Good**:
```typescript
const data: UserData = await fetchData();
```

---

## Working with Service Files

Service files are the biggest source of untyped code. Here's a systematic approach:

### Step 1: Type Method Signatures

```typescript
class UserService {
  // Before
  async getUser(id) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }

  // After
  async getUser(id: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return result[0] ?? null;
  }
}
```

### Step 2: Type Internal Variables

```typescript
class AnalyticsService {
  processMetrics(data: MetricData[]): ProcessedMetrics {
    // Type local variables
    const aggregated: Record<string, number> = {};
    const timestamps: Date[] = [];

    // Rest of implementation
    return { aggregated, timestamps };
  }
}
```

### Step 3: Type Callbacks

```typescript
// Before
data.map(item => item.value)

// After
data.map((item: DataItem) => item.value)
```

---

## Integration with CI/CD

### Pre-commit Hook

Add to `.husky/pre-commit`:
```bash
npm run type-coverage:verify
```

This prevents commits that reduce type coverage.

### CI Pipeline

Add to GitHub Actions workflow:
```yaml
- name: Check Type Coverage
  run: npm run type-coverage:verify
```

### PR Quality Gate

Require type coverage check to pass before merging.

---

## Monitoring Progress

### Weekly Check
```bash
npm run type-coverage
```

Track improvements over time:
- Week 1: 96.79%
- Week 2: 97.29% (+0.5%)
- Week 3: 97.79% (+0.5%)
- Week 4: 98.29% (+0.5%)

### Set Incremental Targets

Update `package.json` as coverage improves:
```json
{
  "scripts": {
    "type-coverage:verify": "type-coverage --at-least 97.00"
  }
}
```

Gradually increase threshold each sprint.

---

## Troubleshooting

### Issue: Too Many Errors to Fix

**Solution**: Use `--ignore-files` to focus:
```bash
type-coverage --ignore-files "**/*.test.ts" --ignore-files "setupTests.ts"
```

### Issue: Third-party Library Without Types

**Solution 1** - Install `@types` package:
```bash
npm install --save-dev @types/library-name
```

**Solution 2** - Create type declaration:
```typescript
// types/library-name.d.ts
declare module 'library-name' {
  export function someFunction(param: string): void;
}
```

**Solution 3** - Type as `any` with comment (last resort):
```typescript
// @ts-ignore - No types available for legacy-library
import legacyLib from 'legacy-library';
```

### Issue: Complex Generic Types

**Solution**: Break down into smaller types:
```typescript
// Complex
type ComplexType<T> = T extends Array<infer U> ? U : never;

// Simpler
type ArrayElement<T> = T extends Array<infer U> ? U : never;
type ComplexType<T> = ArrayElement<T>;
```

---

## Resources

### Documentation
- **Type Coverage Report**: `/docs/type-coverage-report.md`
- **Epic 001 Summary**: `/docs/epic-001-completion-summary.md`
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/

### Tools
- **type-coverage**: https://github.com/plantain-00/type-coverage
- **TypeScript Playground**: https://www.typescriptlang.org/play
- **VS Code TypeScript**: Built-in, shows type errors inline

### Team Resources
- **Weekly Type Coverage Review**: Every Friday 2pm
- **Type Safety Champions**: [Assign team members]
- **Slack Channel**: #type-safety

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run type-coverage` | Check current coverage % |
| `npm run type-coverage:detail` | See all untyped locations |
| `npm run type-coverage:verify` | Enforce minimum threshold |
| `npm run type-coverage:report` | Generate report file |
| `npm run type-check` | Run TypeScript compiler |

| Baseline | Target | Gap |
|----------|--------|-----|
| 96.79% | 99% | 2.21% (5,399 expressions) |

---

**Remember**: Every bit of typing improves code quality, IDE support, and catches bugs before runtime. Small, incremental improvements lead to big wins!

**Questions?** See `/docs/type-coverage-report.md` or ask in #type-safety Slack channel.
