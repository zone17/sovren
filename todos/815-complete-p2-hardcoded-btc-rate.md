---
status: pending
priority: p2
issue_id: 815
tags: [code-review, patterns, frontend]
---

# Hardcoded $30K BTC rate

## Problem Statement

A static Bitcoin price ($30,000) is hardcoded instead of using a live rate or clearly labeling it as an example value.

## Findings

- Pattern Recognition: Static Bitcoin price used instead of live rate
- Misleading to users if displayed as current price

## Proposed Solutions

1. Use API or config for BTC rate
2. Alternatively, clearly label as example/placeholder value

## Technical Details

- **Affected files**: Components displaying BTC price calculations

## Acceptance Criteria

- [ ] BTC rate sourced from API/config or clearly labeled as example
- [ ] No misleading hardcoded price displayed to users
