---
status: pending
priority: p2
issue_id: '615'
tags: [code-review, security, backend, content-shield]
dependencies: []
---

# P2: Upsert on content_id Allows Silent Provenance Record Overwrite

## Problem Statement

`ProvenanceService.signContent()` uses `.upsert({...}, { onConflict: 'content_id' })`. A second call silently overwrites the existing provenance record (signature, event ID, content hash). A creator could accidentally or intentionally replace a valid record with an invalid one.

## Findings

- **Security Sentinel (P2-002)**: "A fraudulent record replaces a legitimate one"

## Proposed Solutions

### Option A: Replace upsert with insert (Recommended)

Use `.insert()` and handle unique constraint violation with clear error message.

### Option B: Check-then-insert

Query for existing record first, reject if exists.

## Acceptance Criteria

- [ ] Second signContent for same content_id returns error, not overwrite
- [ ] Error message is clear: "Provenance record already exists"
- [ ] Unit test covers duplicate submission

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
