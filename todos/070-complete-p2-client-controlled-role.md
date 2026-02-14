---
status: pending
priority: p2
issue_id: 070
tags: [code-review, security, authentication]
dependencies: []
---

# Client-Controlled Role Assignment During Authentication

## Problem Statement

During authentication, the client can influence their assigned role. The role should be determined server-side from the database or identity provider, not from client-supplied data.

## Findings

- **Security Sentinel P2-02**: Role assignment can be influenced by client during auth flow, enabling privilege escalation.

## Proposed Solutions

### Option A: Server-side role lookup (Recommended)

Query user role from database/Supabase during JWT creation. Ignore any client-supplied role.
**Pros:** Eliminates privilege escalation vector
**Cons:** Adds DB lookup to auth flow
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Role is always determined server-side
- [ ] Client-supplied role values are ignored
- [ ] JWT contains only server-verified role
