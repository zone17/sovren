---
status: pending
priority: p1
issue_id: '721'
tags: [code-review, slice-8, backend, security, community, auth]
dependencies: []
---

# Pubkey passed as UUID to circle/mentorship services

## Problem Statement

Routes pass `getAuthUser(req).nostr_pubkey` directly to `CreatorCircleService` and `MentorshipService`, which use the value in `.eq('created_by', userId)` Supabase queries. These queries expect a PostgreSQL UUID, not a NOSTR pubkey (hex string). The mismatch means all ownership checks silently return zero rows — effectively bypassing creator-ownership authorization for circles and mentorships.

**Agent consensus: 5/9**

This is the same bug class as previously fixed #682.

## Findings

- `routes/v2/circles.routes.ts` — extracts `nostr_pubkey` from auth context and passes it as `userId` to service methods
- `routes/v2/mentorship.routes.ts` — same pattern
- `services/community/CreatorCircleService.ts` — uses received `userId` in `.eq('created_by', userId)` and similar column filters that store UUIDs
- `services/community/MentorshipService.ts` — same pattern

Any `.eq('created_by', <pubkey_hex>)` query against a UUID column will never match, so ownership checks always fail open (return empty set), which means:

1. Creators cannot retrieve their own circles/mentorships
2. Access-control checks based on ownership are silently bypassed

## Proposed Solutions

**Option A (preferred): Resolve pubkey to UUID in route handlers**

Call `getUserIdByPubkey(nostr_pubkey)` (already used elsewhere in the codebase for bug #682) before invoking service methods, and pass the resolved UUID:

```typescript
// circles.routes.ts
const { nostr_pubkey } = getAuthUser(req);
const userId = await getUserIdByPubkey(nostr_pubkey);
const circles = await creatorCircleService.getCircles(userId);
```

**Option B: Restructure services to accept pubkey and resolve internally**

Each service method accepts `pubkey: string`, resolves to UUID internally via `getUserIdByPubkey()`, then uses the UUID for DB queries. More encapsulated but requires changing service interfaces.

## Technical Details

- `getUserIdByPubkey()` pattern was introduced as the fix for todo #682 — see that compound doc for the reference implementation
- Affected service methods include at minimum: `getCircles`, `createCircle`, `getCircleMembers`, `createPost`, `getMentorships`, `requestMentorship`, `updateMentorshipStatus`
- The `created_by` column type in `creator_circles` and `mentorships` tables is `uuid` (references `auth.users.id`)
- NOSTR pubkeys are 64-character hex strings — entirely different format from UUIDs

## Acceptance Criteria

- [ ] No service method receives a raw `nostr_pubkey` where a UUID is required
- [ ] All ownership queries using `created_by`, `mentor_id`, `mentee_id`, or similar UUID columns use a resolved UUID
- [ ] Existing tests updated to pass a UUID (not pubkey) or the resolution is mocked
- [ ] New unit test verifying that a request with a valid pubkey correctly resolves ownership
- [ ] TypeScript types reflect the distinction (e.g., `userId: UUID` vs `pubkey: NostrPubkey`)
