# Security Issues & Prevention Strategies

This directory documents critical security findings and comprehensive prevention frameworks to prevent recurrence.

## Documents

### Remediation Records

- **[PR #73 Code Review Remediation](pr73-code-review-remediation.md)** (2026-02-12)
  - 18 findings resolved (6 P1 critical, 9 P2 important, 3 P3 nice-to-have)
  - Root causes: rapid iteration, copy-paste drift, loose validation, config sprawl
  - Outcome: 71 files changed, 20 files deleted, all findings resolved

### Prevention Frameworks

- **[P1-037-043 Prevention Strategies](P1-037-043-prevention-strategies.md)** (2026-02-12)
  - 7 recurring P1 critical patterns with systematic prevention
  - Combines ESLint rules, CI/CD automation, design patterns, testing requirements
  - Actionable implementation roadmap (4 weeks)

## Prevention Strategy Mapping

| Finding                          | Root Cause                      | Prevention                                       | Automation                                              |
| -------------------------------- | ------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| P1-037: Route Metrics Timing     | Middleware execution assumption | ESLint rule `no-prometheus-labels-in-middleware` | CI grep check, integration tests                        |
| P1-038: Health Check Hangs       | Missing defensive programming   | Timeout wrapper + resource cleanup utils         | ESLint `enforce-external-call-timeouts`, CI validation  |
| P1-039: Redis Client Sprawl      | No shared module + copy-paste   | `RedisFactory` singleton pattern                 | ESLint `no-direct-redis-import`, CI audit               |
| P1-040: Credential Rotation Race | No concurrency guard or WAL     | Write-ahead log + distributed lock               | Pre-commit hook validation, integration tests           |
| P1-041: CORS Header Mismatch     | Missing integration tests       | Type-safe `CORS_CONFIG`, integration test        | CI/CD header audit, response validation                 |
| P1-042: Fake Encryption          | TODO/placeholder shipped        | Real `crypto.encrypt()`, ban Base64              | ESLint `no-base64-encoding-as-crypto`, CI comment audit |
| P1-043: Unsafe Type Casts        | TypeScript escape hatches       | Zod validation-first, ban `as` casts             | ESLint `no-unsafe-assignment`, strict type checks       |

## Quick Reference: What Each Prevention Covers

### ESLint Rules (4 New + 2 Updated)

```bash
# New rules
@sovren/custom-rules/no-prometheus-labels-in-middleware
@sovren/custom-rules/enforce-external-call-timeouts
@sovren/custom-rules/no-direct-redis-import
@sovren/custom-rules/no-base64-encoding-as-crypto
@sovren/custom-rules/no-index-signature-on-domain-types

# Updated rules
@typescript-eslint/consistent-type-assertions
@typescript-eslint/no-explicit-any
```

### CI/CD Automation (6 New Workflows)

```bash
.github/workflows/prometheus-labels-check.yml
.github/workflows/health-check-validation.yml
.github/workflows/redis-factory-audit.yml
.github/workflows/cors-validation.yml
.github/workflows/crypto-audit.yml
.github/workflows/type-safety-validation.yml
```

### Code Patterns (4 New Libraries)

```typescript
// Production utilities
packages / backend / src / lib / redis.ts; // RedisFactory singleton
packages / backend / src / lib / credential - rotation.ts; // Write-ahead log + distributed lock
packages / backend / src / lib / crypto.ts; // Real AES-256-GCM encryption
packages / backend / src / lib / health - check - timeout.ts; // Timeout wrapper + cleanup

// Configuration
packages / backend / src / config / cors - config.ts; // Type-safe header validation
```

### Test Suites (7 Integration + Unit Tests)

```bash
packages/backend/src/__tests__/integration/metrics-timing.test.ts
packages/backend/src/__tests__/integration/health-check-cleanup.test.ts
packages/backend/src/__tests__/unit/lib/redis-factory.test.ts
packages/backend/src/__tests__/integration/credential-rotation.test.ts
packages/backend/src/__tests__/integration/cors-header-validation.test.ts
packages/backend/src/__tests__/integration/type-safety.test.ts
packages/backend/src/__tests__/unit/lib/crypto.test.ts
```

## Implementation Checklist

### Phase 1: Automation (Week 1)

- [ ] Add 4 new ESLint rules
- [ ] Update 2 existing ESLint rules in `.eslintrc.json`
- [ ] Create 6 CI/CD workflow files
- [ ] Add CI checks to quality gate

### Phase 2: Design Patterns (Week 1-2)

- [ ] Implement `RedisFactory`
- [ ] Implement `CredentialRotationLog` + `AtomicRotator`
- [ ] Implement `encrypt()`/`decrypt()`
- [ ] Implement health check timeout wrapper
- [ ] Create type-safe CORS config

### Phase 3: Tests (Week 2)

- [ ] Integration tests for all 7 areas
- [ ] Unit tests for new libraries
- [ ] CI/CD test gate verification
- [ ] Pre-commit hook validation

### Phase 4: Migration (Week 3-4)

- [ ] Audit codebase for violations
- [ ] Migrate Redis clients to factory
- [ ] Migrate credential rotation to write-ahead
- [ ] Migrate to real encryption
- [ ] Add type safety to configs

### Phase 5: Documentation (Week 4)

- [ ] Update CLAUDE.md with patterns
- [ ] Create ADRs for each pattern
- [ ] Add code review training

## Code Review Guidelines

### For All PRs:

```markdown
## Prevention Checklist

### Prometheus & Observability

- [ ] Route metrics captured in `res.on('finish')`, not middleware
- [ ] No unbounded labels (use `:uuid` placeholders)

### Health Checks

- [ ] External calls have explicit timeouts
- [ ] Resources cleaned up in finally blocks
- [ ] No hanging connections

### Redis & Clients

- [ ] Using `RedisFactory.getClient()`, never `new Redis()`
- [ ] No hardcoded connection strings
- [ ] Graceful shutdown calls `RedisFactory.closeAll()`

### Credential Rotation

- [ ] Uses write-ahead logging
- [ ] Distributed lock acquired before changes
- [ ] Credentials validated before commit
- [ ] No hardcoded fallback credentials

### CORS & Headers

- [ ] exposedHeaders list matches actual response headers
- [ ] No mixed X- and IETF header formats
- [ ] Integration test validates header consistency

### Cryptography

- [ ] Uses `crypto.encrypt()`, never Base64 for secrets
- [ ] No TODO/FIXME in security code
- [ ] No "simplified version" comments
- [ ] Errors thrown on decryption failure

### Type Safety

- [ ] No `as TypeName` type assertions
- [ ] Validation using Zod schema
- [ ] No index signatures on domain types
- [ ] Type inference from schemas
```

## Prevention Standards in CLAUDE.md

The prevention patterns are formally documented in:

- [CLAUDE.md: Critical Development Standards](../../CLAUDE.md#critical-development-standards)
- Code quality gates section
- Testing standards (TDD required)
- TypeScript standards (strict mode)

## Key Files Updated

```
docs/solutions/security-issues/
├── README.md (this file)
├── pr73-code-review-remediation.md
└── P1-037-043-prevention-strategies.md

.eslintrc.json - Added 6 rules
package.json - Updated lint-staged lint steps
.github/workflows/ - Added 6 new validation workflows
```

## Related ADRs

- ADR-016: CSRF Double-Submit Cookie
- ADR-017: Observability Stack
- ADR-018: CI/CD Consolidation
- ADR-019: Error Handling Patterns (TBD)
- ADR-020: Credential Rotation Protocol (TBD)

## Running Prevention Checks

```bash
# Run all quality gates (includes new prevention checks)
npm run quality:check

# Run ESLint prevention rules
npm run lint -- --rule="@sovren/custom-rules/*: error"

# Run CI/CD prevention workflows locally (requires act)
act -j redis-audit
act -j crypto-audit
act -j prometheus-labels-check
# ... etc

# Run all prevention integration tests
npm run test -- --testPathPattern="(redis-factory|credential-rotation|cors-header|health-check|type-safety|crypto)"

# Pre-commit validation (automatic on git commit)
npm run quality:pre-commit
```

## Metrics

### P1-037: Prometheus Metrics

- **Prevention**: 1 ESLint rule, 1 CI check, 1 integration test
- **Coverage**: 100% of metric definitions

### P1-038: Health Checks

- **Prevention**: 1 ESLint rule, 1 CI workflow, 1 integration test
- **Coverage**: Required timeout on 100% of external calls

### P1-039: Redis Clients

- **Prevention**: 1 ESLint rule, 1 CI audit, 1 unit test
- **Coverage**: Ban `new Redis()` outside `lib/redis.ts`

### P1-040: Credential Rotation

- **Prevention**: Write-ahead logging, distributed locking, 1 integration test
- **Coverage**: All credential rotation code paths

### P1-041: CORS Headers

- **Prevention**: Type-safe config, 1 integration test, 1 CI audit
- **Coverage**: All response headers validated

### P1-042: Encryption

- **Prevention**: 1 ESLint rule, 1 CI audit, 1 unit test
- **Coverage**: Ban Base64 in crypto paths, ban TODO in security code

### P1-043: Type Safety

- **Prevention**: 2 ESLint rules, 1 integration test
- **Coverage**: Ban type assertions, require Zod validation

## Next Steps

1. **Review** [P1-037-043 Prevention Strategies](P1-037-043-prevention-strategies.md) document
2. **Plan** implementation using provided roadmap
3. **Implement** in order: automation → patterns → tests → migration → docs
4. **Review** using provided code review checklists
5. **Document** learnings in ADRs

---

**Last Updated**: 2026-02-12
**Status**: Prevention Framework Ready for Implementation
**Effort Estimate**: 4 weeks (full implementation)
