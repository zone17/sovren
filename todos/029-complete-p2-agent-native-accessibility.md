---
status: pending
priority: p2
issue_id: '029'
tags: [code-review, agent-native, api]
dependencies: []
---

# Agent-Native Accessibility Blockers (CSRF, CORS, Bot Detection)

## Problem Statement

Three issues prevent AI agents from using the API:

1. **CSRF blocks agent API calls**: Double-submit cookie pattern requires browser-like cookie handling. Agents calling POST/PUT/DELETE endpoints get 403 unless they manage cookies.

2. **CORS doesn't expose key headers**: `X-Correlation-ID` and `X-CSRF-Token` are not in `Access-Control-Expose-Headers`, making them invisible to agent HTTP clients.

3. **Bot detection penalizes agents**: Rate limiting or user-agent checks may flag agent traffic as suspicious.

## Findings

- **agent-native-reviewer**: 3 FAIL findings, 4 WARNING findings
- Score: 8/14 capabilities fully agent-accessible

## Proposed Solutions

1. Add token-based auth bypass for CSRF (API key or JWT auth skips CSRF for machine clients)
2. Add `X-Correlation-ID`, `X-CSRF-Token`, `X-RateLimit-*` to CORS `exposedHeaders`
3. Document an agent-friendly auth flow (API key or service token)
4. Add `/api/v1/rate-limits` discovery endpoint

**Effort**: Medium | **Risk**: Low

## Acceptance Criteria

- [ ] Agents with valid API keys can make POST requests without CSRF tokens
- [ ] CORS exposes all diagnostic headers
- [ ] Rate limit info discoverable via API
