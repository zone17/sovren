---
status: pending
priority: p1
issue_id: 758
tags: [code-review, security, injection, postgrest]
dependencies: []
---

# PostgREST .or() Filter Injection at 7+ Locations

## Problem Statement

User-controlled input is interpolated directly into PostgREST `.or()` filter strings without escaping metacharacters. An attacker can inject arbitrary filter operators to expose unauthorized data, bypass visibility restrictions, or extract data from other columns. CVSS: 8.6.

## Findings

- **Security Agent**: P1-01 — 7+ locations identified
- **critical-patterns.md #11** documents the escape pattern but it's not consistently applied

### Affected Files

1. `content-management-service.ts` line 184 — search in .or()
2. `content-management-service.ts` lines 298-299 — media search
3. `content-management-service.ts` lines 752-753 — content search
4. `content-discovery-service.ts` line 337 — similar content
5. `content-discovery-service.ts` lines 95, 393 — exclude_categories
6. `CreatorCircleService.ts` line 121 — circle search
7. `recommendation-service.ts` line 214 — recommendations

### PoC

Search query `%,status.eq.draft` at line 184 → exposes draft content

## Proposed Solutions

Apply `escapePostgrestFilter()` to all user input before .or() interpolation. Escape order: `\` first, then `%`, `_`, `:`, `"`.

## Acceptance Criteria

- [ ] All 7+ .or() interpolation sites use escaped values
- [ ] exclude*categories validated with regex `/^[a-zA-Z0-9*-]+$/`
- [ ] Injection PoC no longer works
