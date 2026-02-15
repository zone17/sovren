---
title: 'Prevention Strategies Quick Reference'
date: 2026-02-13
category: prevention
tags:
  - quick-reference
  - anti-patterns
---

# Quick Reference: Prevention Strategies for 7 Critical Anti-Patterns

## 1. Duplicate Implementations

**What recurs**: 3+ rate limiters, 2+ loggers, 2+ error hierarchies, 2+ routing systems

**Why it happens**:
- No architectural enforcement
- Organic growth without design review
- No visible list of "blessed" implementations

**How to prevent**:

| Action | Tool | Effort | Impact |
|--------|------|--------|--------|
| Create canonical patterns registry | Docs | 1h | High |
| ESLint no-restricted-imports rules | Config | 2h | High |
| Git hook to block duplicates | Shell | 1h | High |
| CI gate for duplicate detection | GitHub Actions | 2h | High |
| Test suite for pattern enforcement | Jest | 2h | High |

**Canonical Implementations**:
- Rate limiting: `packages/backend/src/middleware/rate-limit-middleware.ts`
- Logging: `packages/backend/src/lib/logger.ts`
- Errors: `packages/backend/src/middleware/error-handler-middleware.ts`
- Routing: `packages/backend/src/app.ts` (single mount point)

**Quick Fix**:
```bash
# Delete duplicates
rm packages/backend/src/utils/logger.ts
rm packages/backend/src/rateLimit.ts
rm packages/backend/src/advanced-rate-limiting.ts

# Update imports across 16+ files to use canonical logger
grep -r "from.*utils/logger" packages/backend/src | cut -d: -f1 | sort -u | xargs sed -i 's|from.*utils/logger|from ../../lib/logger|g'

# Run tests to verify no breakage
npm test
```

---

## 2. Missing Recursive Sanitization

**What recurs**: `sanitizeObject` only handles direct properties, not arrays/nested objects, no depth limit

**Why it happens**:
- Initial implementation only covered happy path
- No stack overflow protection
- Regex doesn't match all formats (api_key vs apiKey vs API-KEY)

**How to prevent**:

| Action | Tool | Effort | Impact |
|--------|------|--------|--------|
| Rewrite sanitizeObject with recursion | Code | 2h | High |
| Add MAX_SANITIZE_DEPTH constant | Config | 30m | High |
| Implement circular reference detection | Code | 1h | High |
| Add array truncation to prevent DoS | Code | 30m | High |
| Test with deeply nested + large arrays | Jest | 2h | High |

**Critical Implementation**:
```typescript
// lib/sensitive-fields.ts
const MAX_SANITIZE_DEPTH = 10;
const MAX_ARRAY_LENGTH = 1000;
const SENSITIVE_REGEX = new RegExp(
  `\\b(${SENSITIVE_FIELDS.map(f => f.replace(/[-_]/g, '[-_]?')).join('|')})\\b`, 'i'
);

export function sanitizeObject(
  data: unknown,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (depth >= MAX_SANITIZE_DEPTH) return '[MAX_DEPTH_EXCEEDED]';
  if (seen.has(data)) return '[CIRCULAR_REFERENCE]';
  seen.add(data);

  if (Array.isArray(data)) {
    return data.slice(0, MAX_ARRAY_LENGTH)
      .map(item => sanitizeObject(item, depth + 1, seen));
  }

  if (data !== null && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = isSensitiveKey(key)
        ? '[REDACTED]'
        : sanitizeObject(value, depth + 1, seen);
    }
    return sanitized;
  }

  return data;
}
```

**Test Cases**:
```typescript
// Should handle circular references
// Should respect MAX_SANITIZE_DEPTH
// Should truncate arrays > 1000 items
// Should match password, api_key, apiKey, API-KEY variants
// Should handle deeply nested { level1: { level2: { ... } } }
// Should sanitize { items: [{ token: '...' }] }
```

---

## 3. Error Detail Leakage

**What recurs**: JWT errors expose specific validation failures, stack traces sent to clients, detailed DB errors

**Why it happens**:
- Development convenience (showing details helps debugging)
- No classification of operational vs internal errors
- Insufficient error sanitization in responses

**How to prevent**:

| Action | Tool | Effort | Impact |
|--------|------|--------|--------|
| Generic error messages for all JWT errors | Code | 1h | High |
| Never expose stack traces except in development | Code | 1h | High |
| Classify errors: Operational vs Unexpected | Type system | 1h | Medium |
| Server-side detailed logging with sanitization | Code | 2h | High |
| Test that no implementation details leak | Jest | 2h | High |

**Generic Error Responses**:
```typescript
// BEFORE: ❌ Leaks information
error: "Invalid signature"  // Attacker learns validation method
error: "jwt expired"         // Attacker learns token type
error: "Database connection refused at 10.0.1.5"  // Leaks infrastructure

// AFTER: ✅ Generic to client, detailed on server
// Client sees:
error: "Authentication failed"
code: "AUTHENTICATION_ERROR"

// Server logs (sanitized):
logger.error('JWT validation failed', {
  requestId: 'abc-123',
  actualError: 'Invalid signature',  // Details logged, not sent to client
  algorithm: 'HS256',
  ...
});
```

**CI Gate**:
```bash
# Check that error-handler-middleware uses isDevelopment guard
grep -n "isDevelopment.*stack\|stack.*isDevelopment" middleware/error-handler-middleware.ts
```

---

## 4. Shell Injection via execSync

**What recurs**: `execSync('command ' + userInput)`, string interpolation with shell metacharacters

**Why it happens**:
- Shell interpreter allows string interpretation
- No argument escaping
- Developers not aware of execFileSync alternative

**How to prevent**:

| Action | Tool | Effort | Impact |
|--------|------|--------|--------|
| Block execSync import | ESLint | 1h | High |
| Replace all execSync with execFileSync | Code | 2h | High |
| Pass arguments as array, not strings | Code | 2h | High |
| Add test for shell metacharacters | Jest | 1h | High |

**Pattern Change**:
```typescript
// BEFORE: ❌ Vulnerable
execSync(`psql -U admin -c "ALTER USER postgres PASSWORD '${password}'"`);

// AFTER: ✅ Safe
execFileSync('psql', [
  '-U', 'admin',
  '-c', `ALTER USER postgres PASSWORD '${password}'`
], { stdio: 'pipe', timeout: 30000 });

// Shell metacharacters are literal, not interpreted:
// password = "abc'; rm -rf /" -> passed as single string argument
```

**ESLint Rule**:
```javascript
'no-restricted-imports': [
  'error',
  {
    paths: [{
      name: 'child_process',
      importNames: ['execSync'],
      message: 'Use execFileSync with separate arguments array instead'
    }]
  }
]
```

**Test Case**:
```typescript
it('should not allow shell injection via password', () => {
  const password = "'; DROP TABLE users; --";
  rotatePassword(password);

  // Verify execFileSync was called with password in args array
  expect(execFileSync).toHaveBeenCalledWith(
    'psql',
    expect.arrayContaining([password]),  // Not interpolated
    expect.any(Object)
  );
});
```

---

## 5. Dead Code Accumulation

**What recurs**: 769 lines of unused code, ghost imports, orphaned functions, historical artifacts

**Why it happens**:
- No automated cleanup
- "Keep just in case" mentality instead of using Git history
- Unused code not detected until manual review

**How to prevent**:

| Action | Tool | Effort | Impact |
|--------|------|--------|--------|
| Enable noUnusedLocals in tsconfig.json | Config | 30m | High |
| Install ts-prune for static analysis | NPM | 1h | High |
| Add ESLint unused-imports plugin | Config | 1h | High |
| CI gate that fails on dead code | GitHub Actions | 2h | High |
| Pre-commit hook to auto-fix | Shell | 1h | High |

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowUnusedLabels": false
  }
}
```

**One-time cleanup**:
```bash
# Find and remove dead code
npx ts-prune > unused.txt
# Manually review and delete files in unused.txt

# Auto-fix unused imports
npx eslint --fix --rule "unused-imports/no-unused-imports: error"

# Verify no broken imports remain
npm run build
```

**CI Gate**:
```bash
# Fail if ts-prune finds unused exports
npx ts-prune --error | grep -q "unused" && exit 1
```

---

## 6. Type Safety Erosion

**What recurs**: Scattered `as any` casts, loose index signatures like `[key: string]: unknown`, no module augmentation

**Why it happens**:
- TypeScript strictness bypassed with assertions
- Express Request type not extended for custom properties
- No enforcement of strict mode

**How to prevent**:

| Action | Tool | Effort | Impact |
|--------|------|--------|--------|
| Enable strict: true in tsconfig.json | Config | 1h | High |
| Create Express module augmentation | Code | 1h | High |
| Add @typescript-eslint/no-explicit-any rule | Config | 1h | High |
| Replace index signatures with named properties | Code | 3h | Medium |
| Test module augmentation works | Jest | 1h | High |

**Module Augmentation**:
```typescript
// types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      user?: AuthenticatedUser;
      correlationId?: string;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  nostr_pubkey: string;
  role?: 'admin' | 'user';
}
```

**TypeScript Config**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**ESLint Rule**:
```javascript
'@typescript-eslint/no-explicit-any': 'error',
'@typescript-eslint/no-unsafe-assignment': 'error',
```

---

## 7. CSP Bypass

**What recurs**: `'unsafe-inline'` in production, `ws:` instead of `wss:`, no inline script hashing

**Why it happens**:
- CSP policy not validated before deployment
- WebSocket protocol mixing (http + ws)
- No CSP violation monitoring

**How to prevent**:

| Action | Tool | Effort | Impact |
|--------|------|--------|--------|
| Remove unsafe-inline from CSP | Config | 30m | High |
| Replace ws: with wss: | Config | 30m | High |
| Add CSP validation test | Jest | 1h | High |
| Monitor CSP violations | Code | 1h | Medium |
| Implement nonce-based inline scripts | Code | 2h | High |

**Correct CSP Policy**:
```json
"Content-Security-Policy": "default-src 'self'; script-src 'self' 'nonce-{NONCE}'; style-src 'self'; connect-src 'self' https: wss:; img-src 'self' data: https:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
```

**Validation Test**:
```typescript
it('should not allow unsafe-inline in production', () => {
  const csp = getCSPPolicy();
  expect(csp).not.toContain("'unsafe-inline'");
  expect(csp).not.toContain('unsafe-eval');
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain('wss:');  // Not ws:
});
```

---

## Implementation Priority

### Week 1: Foundations
- [ ] Create canonical patterns registry
- [ ] Enable TypeScript strict mode
- [ ] Setup CSP policy validation

### Week 2: Automated Enforcement
- [ ] Deploy ESLint rules
- [ ] Setup pre-commit hooks
- [ ] Configure CI/CD gates

### Week 3: Codebase Cleanup
- [ ] Fix duplicates (rate limiters, loggers, errors)
- [ ] Enhance sanitizeObject with recursion
- [ ] Replace execSync with execFileSync

### Week 4: Type Safety
- [ ] Add Express module augmentation
- [ ] Remove all `as any` casts
- [ ] Verify 95%+ type coverage

### Week 5: Verification
- [ ] Run full test suites
- [ ] Deploy new CI workflows
- [ ] Monitor for violations

---

## One-Line Fixes (Can Run Immediately)

```bash
# 1. Find all duplicates
find packages/backend/src -name '*rate*limit*.ts' -not -path '*/node_modules/*'
find packages/backend/src -name '*logger*.ts' -not -path '*/node_modules/*'

# 2. Find unsafe type casts
grep -r " as any" packages/backend/src --include="*.ts" | head -20

# 3. Find execSync usage
grep -r "execSync" scripts --include="*.ts" | grep -v execFileSync

# 4. Find CSP policy
jq '.headers[0].headers[] | select(.key=="Content-Security-Policy")' vercel.json

# 5. Find error detail leakage
grep -r "error.stack\|res.json.*error" packages/backend/src/middleware --include="*.ts"

# 6. Find dead code
npx ts-prune | head -20

# 7. Analyze type safety
npx tsc --strict --noEmit --noUnusedLocals 2>&1 | head -20
```

---

## Metrics to Track

| Metric | Target | Current | Tooling |
|--------|--------|---------|---------|
| Duplicate implementations | 0 | 7 | Manual review |
| Dead code lines | 0 | 769 | ts-prune |
| Type safety (% coverage) | 95% | 88% | type-coverage |
| CSP violations | 0 | 1 | CSP header test |
| Shell injection vectors | 0 | 2 | ESLint rule |
| Error detail leaks | 0 | 3 | Test suite |
| Sanitization depth | 10+ | Current | Jest tests |

---

## Review Checklist

Before merging code, verify:

- [ ] No new `as any` type assertions
- [ ] No new execSync calls (only execFileSync)
- [ ] Recursive functions have depth/size limits
- [ ] Error responses are generic (no stack traces)
- [ ] All imports from canonical locations only
- [ ] Type coverage not decreased
- [ ] CSP policy validated
- [ ] Test coverage >= 85%

---

## Files to Review

Start here to understand the issues:

1. `/Users/fp/Desktop/Sovren/docs/plans/p2-remediation-plan.md` - Detailed sprint plan
2. `/Users/fp/Desktop/Sovren/docs/solutions/security-issues/p1-post-remediation-critical-fixes.md` - Previous fixes
3. `/Users/fp/Desktop/Sovren/CLAUDE.md` - Project standards
4. `/Users/fp/Desktop/Sovren/docs/solutions/prevention-strategies.md` - Full prevention guide
5. `/Users/fp/Desktop/Sovren/docs/solutions/prevention-ci-cd-automation.md` - CI/CD workflows
