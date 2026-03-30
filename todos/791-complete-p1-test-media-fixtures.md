---
status: pending
priority: p1
issue_id: 791
tags: [e2e, fixtures, media-upload, infrastructure]
dependencies: []
---

# Create Test Media Fixtures for E2E Upload Tests

## Problem Statement
Content creation tests need file upload capability but no test media files exist. E2E tests must use real files (pattern #26: no page.route() mocks).

## Findings
- Need tiny deterministic binary fixtures committed to repo
- Location: `packages/frontend/e2e/fixtures/media/`
- Export helper: `packages/frontend/e2e/fixtures/test-media.ts`
- Files: test-image.png (~68 bytes), test-audio.mp3 (~2KB), test-video.mp4 (~5KB)

## Proposed Solutions

### Option A: Generate with ffmpeg (Recommended)
```bash
ffmpeg -f lavfi -i "color=c=red:s=1x1:d=0.04" -frames:v 1 test-image.png
ffmpeg -f lavfi -i "anullsrc=r=44100:cl=mono" -t 0.1 -q:a 9 test-audio.mp3
ffmpeg -f lavfi -i "color=c=black:s=1x1:d=0.04" -c:v libx264 test-video.mp4
```
Plus `test-media.ts` exporting paths using `import.meta.url`.
- Pros: Deterministic, tiny, real binary formats
- Cons: Requires ffmpeg for initial generation
- Effort: Small
- Risk: Low

## Acceptance Criteria
- [ ] 3 media fixture files exist in `e2e/fixtures/media/`
- [ ] `test-media.ts` exports paths for image, audio, video
- [ ] Total fixture size < 10KB
- [ ] Files are committed to git (not gitignored)

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Blocking all media upload E2E tests |
