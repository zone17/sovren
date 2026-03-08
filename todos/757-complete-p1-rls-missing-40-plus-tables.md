---
status: pending
priority: p1
issue_id: 757
tags: [code-review, security, database, rls, data-integrity]
dependencies: []
---

# RLS Missing on 40+ Tables with User/Financial/PII Data

## Problem Statement

40+ database tables containing user data, financial records, and PII are created WITHOUT Row Level Security (RLS). Additionally, `content_analytics` has RLS enabled but ZERO policies (all operations denied for non-superuser roles). Without RLS, any authenticated Supabase client can read ALL users' financial records, encrypted tokens, session data, and wellness information.

## Findings

- **Data Integrity Agent**: P1-2 — 40+ tables in `20240201000000_additional_tables.sql` lack RLS
- **Data Integrity Agent**: P1-1 — `content_analytics` has RLS enabled but no policies
- **Security Agent**: P2-04 — Confirms missing RLS on core tables

### Affected Tables (Partial List)

- `platform_connections` (encrypted OAuth tokens)
- `service_listings`, `service_orders` (financial escrow)
- `revenue_split_ledger`, `revenue_split_payments` (financial)
- `contracts`, `business_invoices`, `expenses`, `revenue_entries` (financial)
- `subscriptions`, `recurring_payments`, `transactions` (payment)
- `lightning_invoices`, `lightning_payments` (payment)
- `user_preferences`, `user_sessions`, `session_activity` (PII)
- `wellness_snapshots`, `burnout_risk_history` (health PII)
- `premium_content_access` (access control)

## Proposed Solutions

1. Enable RLS on all user-data tables with `service_role` full-access + `authenticated` owner-only policies
2. Add policies to `content_analytics` or disable RLS if only service_role accesses it
3. Prioritize: payment tables > platform_connections > user_preferences > wellness

## Acceptance Criteria

- [ ] All tables containing user-specific data have RLS enabled
- [ ] Each table has appropriate SELECT/INSERT/UPDATE/DELETE policies
- [ ] `content_analytics` has explicit policies or RLS disabled with justification
- [ ] Verified with `SELECT tablename FROM pg_tables WHERE NOT rowsecurity`
