---
status: pending
priority: p3
issue_id: 783
tags: [code-review, data-integrity, gdpr, privacy]
dependencies: []
---

# GDPR Compliance — IP Address Retention

## Problem Statement

content_analytics stores ip_address as INET. No data retention policy, no anonymization job, no right-to-erasure procedure covering analytics/sessions. `delete_all_wellness_data` exists but no equivalent for analytics.

## Findings

- **Data Integrity Agent**: P3-3

## Proposed Solutions

Implement comprehensive GDPR data deletion function. Add scheduled IP anonymization job.

## Acceptance Criteria

- [ ] Data deletion covers all PII-containing tables
- [ ] IP addresses anonymized after retention period
