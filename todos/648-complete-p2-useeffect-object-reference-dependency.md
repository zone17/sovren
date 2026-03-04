---
status: pending
priority: p2
issue_id: '648'
tags: [code-review, frontend, react, business-manager]
dependencies: []
---

# useEffect Depends on Object Reference Instead of Primitive

## Problem Statement

In `InvoiceEditor.tsx`, the QR code generation `useEffect` depends on `[paymentLink]` where `paymentLink` is `{ lnurlPay: string } | null`. Since a new object reference is created on every state update, the effect may re-fire unnecessarily. The actual dependency is the `lnurlPay` string value.

**Consensus**: 5/8 review agents flagged this.

## Findings

- `packages/frontend/src/features/business/components/InvoiceEditor.tsx:~L180` — `useEffect(..., [paymentLink])` with `paymentLink` being `useState<{ lnurlPay: string } | null>`
- The state could be simplified to `useState<string | null>` storing just the LNURL string, eliminating the object wrapper entirely

## Proposed Solutions

### Solution A: Simplify state to string (Recommended)

Change `paymentLink` state from object to just the LNURL string:

```typescript
const [lnurlPay, setLnurlPay] = useState<string | null>(null);
// useEffect dependency: [lnurlPay]
```

- **Pros**: Eliminates the object wrapper, simplifies code, fixes dependency issue
- **Cons**: Minor refactor of payment link display section
- **Effort**: Small
- **Risk**: Low

### Solution B: Use primitive in dependency array

```typescript
useEffect(() => { ... }, [paymentLink?.lnurlPay]);
```

- **Pros**: Minimal change
- **Cons**: Leaves unnecessary object wrapper in state
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] useEffect dependency is a primitive value (string), not an object reference
- [ ] QR code generation only re-runs when the LNURL value actually changes
- [ ] No regression in payment link display or QR rendering

## Work Log

| Date       | Action                                            | Learnings                                              |
| ---------- | ------------------------------------------------- | ------------------------------------------------------ |
| 2026-03-04 | Created from PR #136 review (5/8 agent consensus) | Object refs in useEffect deps are a React anti-pattern |
