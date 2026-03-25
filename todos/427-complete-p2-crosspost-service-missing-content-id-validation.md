---
id: 427
severity: P2
status: complete
title: 'CrossPostService.publish: no validation that content_id exists before queueing'
file: packages/backend/src/services/distribution/CrossPostService.ts
found_in: PR #89
reviewer: review-backend
---

# CrossPostService.publish does not verify content_id exists

## Problem

The `publish` method accepts `request.content_id` and immediately inserts rows into `cross_posts` and queues BullMQ jobs without verifying that the content actually exists in the database. If a caller passes an invalid `content_id`:

1. `cross_posts` rows are created referencing non-existent content
2. BullMQ jobs are enqueued that will fail when they try to fetch the content
3. The caller gets a success response with a `job_id` for content that doesn't exist

While there may be a foreign key constraint at the DB level, relying solely on DB constraints without application-layer validation produces opaque Postgres error messages rather than clean `404 Content not found` responses.

## Location

```
packages/backend/src/services/distribution/CrossPostService.ts  lines 54-134 (publish method)
```

## Fix

Add a content existence check before the batch insert:

```typescript
async publish(creatorId: string, request: PublishRequest) {
  if (request.platforms.length > MAX_CROSS_POST_TARGETS) {
    throw new ValidationError(...);
  }

  // Verify content exists and belongs to caller
  const { data: content, error: contentError } = await this.db
    .from('content')
    .select('id, creator_id')
    .eq('id', request.content_id)
    .single();

  if (contentError || !content) {
    throw new ValidationError('Content not found');
  }
  if (content.creator_id !== creatorId) {
    throw new AuthorizationError('Not authorized to cross-post this content');
  }

  // ... rest of publish logic
}
```

## Severity Justification

P2: Not a security vulnerability but a data integrity issue. Invalid content references create orphaned cross-post records and wasted queue jobs.
