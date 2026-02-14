---
status: pending
priority: p1
issue_id: '117'
tags:
  - code-review
  - performance
  - payment
  - receipt
dependencies: []
---

# 117: Puppeteer Launched Per Receipt — 500ms-2s + 100MB RAM Per Receipt

## Problem Statement

`/packages/backend/src/services/lightning/receipt-service.ts` (lines 339-352) launches a new Puppeteer browser instance for EVERY receipt PDF generation. Each launch costs 500ms-2s startup time + 100-200MB RAM. Under load (e.g., 10 concurrent receipt requests), this would consume 1-2GB RAM and take 5-20 seconds.

## Findings

- **Lines 339-352**: `puppeteer.launch()` called per receipt generation
- Each browser launch: 500ms-2s startup time
- Each browser instance: 100-200MB RAM
- No instance reuse or pooling
- Under concurrent load:
  - 10 concurrent receipts = 1-2GB RAM + 5-20s total time
  - 50 concurrent receipts = potential OOM crash
- Browser processes not cleaned up on error paths

## Proposed Solutions

**Option A: Use a browser pool — launch once, reuse pages (Recommended)**

- Create browser pool at service initialization
- Reuse browser instances across receipt requests
- Each request gets a new page, not a new browser
- Effort: Medium, Risk: Low

**Option B: Replace Puppeteer with lighter PDF library**

- Use PDFKit, jsPDF, or similar for PDF generation
- No headless browser overhead
- Effort: Medium, Risk: Medium (requires reimplementing receipt template)

**Option C: Generate receipts asynchronously via queue**

- Add receipt generation to job queue
- Limit concurrent browser instances
- Return receipt URL immediately, generate in background
- Effort: Medium, Risk: Low

## Acceptance Criteria

- [ ] Browser instance reused across receipts (or replaced with lighter solution)
- [ ] Memory usage stable under concurrent receipt generation
- [ ] Receipt generation time < 500ms per receipt
- [ ] No memory leaks from orphaned browser processes
- [ ] Graceful degradation under high load

## Work Log

| Date       | Action                                      | Learnings                                                                 |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Heavy processes like Puppeteer must be pooled, never launched per-request |
