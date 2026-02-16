---
status: pending
priority: p2
issue_id: "162"
tags: [code-review, pr-82, phase-7, data-integrity, immutability, provenance, security]
dependencies: []
---

# Provenance Records Lack Immutability Protection

## Problem Statement
Provenance records (content authenticity proofs) can be updated or deleted via service-role bypass. Content provenance should be append-only — once a provenance record is created, it must never be modified, as it serves as a cryptographic proof of authorship.

## Findings
- ProvenanceService has update and delete methods on provenance_records table
- No database-level immutability constraint (e.g., trigger preventing UPDATE/DELETE)
- Service-role Supabase client bypasses RLS entirely
- A compromised service could tamper with provenance history
- NOSTR event signatures would still verify, but metadata (timestamps, associations) could be altered
- Flagged by: data-integrity-guardian, security-sentinel

## Proposed Solutions
### Option 1: Database Trigger to Prevent Modification (Recommended)
**Approach:** Create Postgres triggers on provenance_records that reject UPDATE and DELETE. Only INSERT allowed.
**Pros:** Database-enforced immutability, cannot be bypassed by application code
**Cons:** Requires migration
**Effort:** 1 hour
**Risk:** Low

### Option 2: Remove Update/Delete Methods
**Approach:** Remove update and delete capabilities from ProvenanceService. Add only soft-delete (status column) if needed.
**Pros:** Application-level enforcement
**Cons:** Doesn't prevent direct SQL access
**Effort:** 30 minutes
**Risk:** Medium (not database-enforced)

## Technical Details
- `packages/backend/src/services/provenance/ProvenanceService.ts`
- New Supabase migration for immutability triggers

## Acceptance Criteria
- [ ] Provenance records cannot be modified after creation
- [ ] Provenance records cannot be deleted
- [ ] Immutability enforced at database level
- [ ] Soft-delete mechanism available if revocation needed

## Resources
- **PR:** #82
- **Agents:** data-integrity-guardian, security-sentinel

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: data-integrity, immutability, provenance, security
