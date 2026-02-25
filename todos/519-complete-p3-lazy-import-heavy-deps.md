---
status: pending
priority: p3
issue_id: 519
tags: [code-review, performance, backend]
dependencies: []
---

# Lazy-Import Heavy Dependencies (pdfkit, AWS SDK)

## Problem Statement

Two heavy dependencies are eagerly imported at startup via DI binding modules:

- `pdfkit` (~80ms cold load, 4.4MB) — loaded via `payment.bindings.ts` → `InvoiceService.ts`
- `@aws-sdk/client-secrets-manager` (~35ms cold load, 6.2MB) — loaded via `bootstrap.ts` → `SecretsService.ts`

Total: ~115ms added to cold start. Acceptable for long-running Docker process, but could be optimized.

## Findings

**Performance Oracle:** Measured cold-require times. Invoice generation and AWS secrets are low-frequency operations that don't need eager loading.

## Proposed Solutions

Convert top-level imports to dynamic `import()` inside the methods that use them:

```typescript
// InvoiceService.ts
async generatePdf(invoice: Invoice): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  // ...
}
```

**Effort:** Small (2 files, single import change each)
**Expected gain:** ~115ms cold start reduction

## Acceptance Criteria

- [ ] `pdfkit` and `@aws-sdk/client-secrets-manager` not in startup import chain
- [ ] Invoice generation still works
- [ ] SecretsService still initializes when `useAwsSecrets=true`

## Work Log

| Date       | Action                       | Learnings                                 |
| ---------- | ---------------------------- | ----------------------------------------- |
| 2026-02-25 | Created during PR #98 review | Performance oracle measured; not blocking |
