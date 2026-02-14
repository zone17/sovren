---
status: pending
priority: p1
issue_id: '022'
tags: [code-review, security, tls]
dependencies: []
---

# SSL Certificate Verification Disabled in Production Code

## Problem Statement

Two files disable TLS certificate verification (`rejectUnauthorized: false`):

1. `packages/backend/src/services/lightning/receipt-service.ts:212` - Lightning payment infrastructure
2. `scripts/automated-supabase-rotation-vault.ts:368` - Production database connection

This allows MITM attacks on payment data and database credentials.

## Findings

- **security-sentinel**: HIGH-01

## Proposed Solutions

Set `rejectUnauthorized: true` in production. Gate `false` behind `NODE_ENV !== 'production'` only if needed for local development with self-signed certs.

## Acceptance Criteria

- [ ] `grep -r 'rejectUnauthorized.*false' packages/ scripts/` returns no production code matches
- [ ] Lightning receipt service verifies TLS certificates
