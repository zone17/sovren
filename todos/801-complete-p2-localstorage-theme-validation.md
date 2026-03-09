---
status: pending
priority: p2
issue_id: 801
tags: [code-review, security, frontend]
---

# localStorage theme validation missing

## Problem Statement

localStorage.getItem('theme') is used without validation in an inline script, allowing arbitrary string injection into the DOM class list.

## Findings

- Security Sentinel: localStorage.getItem('theme') used without validation in inline script
- Any value stored in localStorage (via XSS or dev tools) gets applied directly to the document element

## Proposed Solutions

1. Validate against allowed values ('light', 'dark') before applying to the DOM

## Technical Details

- **Affected files**: index.html or equivalent inline theme script

## Acceptance Criteria

- [ ] localStorage theme value validated against allowlist ('light', 'dark')
- [ ] Invalid/missing values fall back to a safe default
- [ ] No arbitrary strings can be injected into document.classList via theme
