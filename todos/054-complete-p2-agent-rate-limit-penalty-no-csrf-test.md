---
status: pending
priority: p2
issue_id: '054'
tags: [code-review, agent-native, testing]
dependencies: []
---

# Agent Rate Limit Penalty and Missing CSRF Test

## Problem Statement

Two issues affect agent-native API access and security testing: (1) Advanced rate limiter's BypassDetector incorrectly flags legitimate agent traffic as attacks, applying penalties including 1-hour blocks for missing Accept-Language and bot detection for standard automation User-Agents; (2) No test coverage exists for Bearer token CSRF bypass path, leaving security-critical logic untested.

## Findings

**Location**:

- `middleware/advanced-rate-limiting.ts:748-902`
- `__tests__/middleware/csrf.test.ts` (missing test)

**Issue 1: Legitimate Agent Traffic Flagged**:

**Critical Rule - Accept-Language**:

```typescript
if (!acceptLanguage) {
  indicators.push('DISTRIBUTED_ATTACK'); // Critical indicator
  // Results in 1-hour penalty
}
```

- Headless browsers, CLI tools, automation don't send Accept-Language
- Legitimate API clients (Python, Go, curl) flagged as distributed attacks
- 1-hour penalty blocks all legitimate API access

**User-Agent Detection**:

```typescript
if (userAgent.includes('python') || userAgent.includes('curl') || userAgent.includes('go-http')) {
  indicators.push('USER_AGENT_ROTATION');
}
```

- Python requests, Go http.Client, curl are standard API clients
- Not rotation attacks
- False positive rate high

**Accept: _/_ + No Language = Bot**:

```typescript
if (accept === '*/*' && !acceptLanguage) {
  // 2+ indicators = bot classification
}
```

- Standard HTTP client behavior
- Not indicative of malicious bot

**Impact**:

- Legitimate CI/CD pipelines blocked
- API integrations fail
- Automation tools unusable
- Developer tools (curl, httpie) blocked

**Issue 2: Missing CSRF Test**:

- Bearer token authentication bypasses CSRF check
- Security-critical code path
- No test coverage verifying:
  - Bearer token properly bypasses CSRF
  - Invalid Bearer token still requires CSRF
  - CSRF still enforced for session auth

## Proposed Solutions

1. **Fix BypassDetector Rules** (Required):

   - Remove Accept-Language requirement
   - Remove standard User-Agent flagging (python, curl, go)
   - Keep only true indicators:
     - Rapidly rotating User-Agents (different UA per request)
     - Missing critical headers (Host, Connection)
     - Malformed headers
   - Document agent-friendly API access patterns

2. **Add CSRF Test Coverage** (Required):

   ```typescript
   describe('CSRF Bearer Token Bypass', () => {
     it('should bypass CSRF check with valid Bearer token', async () => {
       // Test implementation
     });

     it('should enforce CSRF check with invalid Bearer token', async () => {
       // Test implementation
     });

     it('should enforce CSRF check for session auth', async () => {
       // Test implementation
     });
   });
   ```

## Technical Details

**BypassDetector Refactor**:

```typescript
// Before - too aggressive
const indicators = [];
if (!acceptLanguage) indicators.push('DISTRIBUTED_ATTACK');
if (userAgent.includes('python')) indicators.push('USER_AGENT_ROTATION');

// After - focus on true attacks
const indicators = [];
// Only flag if User-Agent changes rapidly (track per IP)
if (detectUserAgentRotation(ip, userAgent)) {
  indicators.push('USER_AGENT_ROTATION');
}
// Only flag truly missing headers
if (!headers.host || !headers.connection) {
  indicators.push('MALFORMED_REQUEST');
}
```

**CSRF Test Cases**:

```typescript
// Test 1: Valid Bearer bypasses CSRF
POST /api/protected
Authorization: Bearer valid-token
// No CSRF token required
// Should succeed

// Test 2: Invalid Bearer requires CSRF
POST /api/protected
Authorization: Bearer invalid-token
// CSRF token required
// Should fail without CSRF

// Test 3: Session auth requires CSRF
POST /api/protected
Cookie: session=abc123
// CSRF token required
// Should fail without CSRF
```

**Files Requiring Changes**:

- `middleware/advanced-rate-limiting.ts:748-902` - Fix BypassDetector
- `__tests__/middleware/csrf.test.ts` - Add Bearer token tests
- Documentation - Document agent-friendly API access

## Acceptance Criteria

- [ ] Accept-Language not required for API access
- [ ] Standard User-Agents (python, curl, go) not flagged
- [ ] Only true attack patterns flagged (rotation, malformed)
- [ ] CI/CD pipelines work without penalties
- [ ] curl/httpie/Postman work without blocks
- [ ] Python requests library works without penalties
- [ ] CSRF tests cover Bearer token bypass path
- [ ] CSRF tests verify session auth still requires token
- [ ] All CSRF tests passing
- [ ] Integration tests with automation tools
- [ ] Documentation updated with agent access patterns
- [ ] Rate limiting rules documented with examples

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- HTTP User-Agent specifications
- CSRF protection best practices
- API client documentation (requests, curl, etc.)
