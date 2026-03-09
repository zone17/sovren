---
status: pending
priority: p2
issue_id: 802
tags: [code-review, security]
---

# Google Fonts missing SRI integrity hash

## Problem Statement

External Google Fonts loaded via @import without subresource integrity, allowing potential supply-chain tampering.

## Findings

- Security Sentinel: External @import without subresource integrity
- If the CDN is compromised, malicious CSS could be injected

## Proposed Solutions

1. Use link tag with integrity attribute instead of @import
2. Alternatively, self-host the fonts to eliminate external dependency

## Technical Details

- **Affected files**: CSS files containing Google Fonts @import

## Acceptance Criteria

- [ ] Google Fonts loaded via link tag with integrity hash, or self-hosted
- [ ] No external @import for fonts without SRI
