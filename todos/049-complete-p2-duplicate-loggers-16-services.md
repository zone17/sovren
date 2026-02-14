---
status: pending
priority: p2
issue_id: '049'
tags: [code-review, architecture, logging, duplication]
dependencies: []
---

# Duplicate Logger Implementations - 16 Services

## Problem Statement

Two logger implementations exist with significantly different capabilities. The hand-rolled `utils/logger.ts` (119 lines, console-only, no correlation ID, no sanitization) is used by 16 service files, while the production-grade `lib/logger.ts` (95 lines, Winston-based, structured JSON, correlation ID via AsyncLocalStorage, sensitive field sanitization) is only used by 2 consumers (app.ts, error-handler-middleware.ts).

## Findings

**Location**:

- `utils/logger.ts` - 16 service consumers
- `lib/logger.ts` - 2 consumers (app.ts, error-handler-middleware.ts)

**utils/logger.ts Limitations**:

- Hand-rolled implementation
- Console-only output (no file, no external services)
- No correlation ID tracking across async operations
- No sensitive field sanitization (leaks secrets)
- No structured logging format
- No log level filtering in production
- No integration with observability tools

**lib/logger.ts Capabilities**:

- Winston-based (industry standard)
- Structured JSON output
- Correlation ID via AsyncLocalStorage
- Sensitive field sanitization (passwords, tokens, keys)
- Multiple transports (console, file, external services)
- Proper log level management
- Integration-ready for Datadog, Sentry, etc.

**Risk**:

- 16 services potentially logging sensitive data
- No request tracing across service boundaries
- Difficult to debug production issues
- Inconsistent log formats complicate aggregation

## Proposed Solutions

1. **Migrate All Services to lib/logger.ts** (Recommended):

   - Create migration script to update imports
   - Verify API compatibility between loggers
   - Add adapter shim if API differences exist
   - Delete utils/logger.ts after migration
   - Update all 16 service files

2. **Enhance utils/logger.ts**:
   - Add Winston backend to utils/logger.ts
   - Add correlation ID support
   - Add sanitization
   - Keep same API surface
   - Still leaves duplication

## Technical Details

**Affected Service Files** (16 total):

- Identify all imports of `utils/logger`
- Map logger method calls (info, error, warn, debug)
- Check for custom logger configuration
- Verify context object usage

**Migration Checklist per File**:

```typescript
// Before
import { logger } from '../utils/logger';
logger.info('User created', { userId });

// After
import { logger } from '../lib/logger';
logger.info('User created', { userId }); // Same API if compatible
```

**API Compatibility Check**:

- Compare method signatures (info, error, warn, debug)
- Check context object handling
- Verify error serialization
- Test correlation ID propagation

**Files Requiring Changes**:

- All 16 service files importing utils/logger
- utils/logger.ts (delete after migration)
- Tests for affected services
- Documentation

## Acceptance Criteria

- [ ] All services use lib/logger.ts
- [ ] No imports of utils/logger.ts remain
- [ ] utils/logger.ts deleted
- [ ] All logs include correlation IDs
- [ ] Sensitive fields sanitized in all logs
- [ ] Structured JSON format in production
- [ ] Log aggregation works across all services
- [ ] Unit tests updated for all migrated services
- [ ] Integration tests verify logging behavior
- [ ] Performance benchmarks show acceptable overhead
- [ ] Documentation updated with logging guidelines
- [ ] No secrets leaked in production logs (audit log samples)

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- Winston documentation
- AsyncLocalStorage Node.js docs
- OWASP Logging Cheat Sheet
