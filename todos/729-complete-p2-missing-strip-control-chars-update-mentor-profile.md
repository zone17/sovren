---
status: pending
priority: p2
issue_id: 729
tags: [code-review, slice-8, security, sanitization, mentorship]
dependencies: []
---

# #729 - Missing stripControlChars in updateMentorProfile

## Problem Statement

The `updateMentorProfile()` method in `MentorshipService.ts` accepts user-supplied text fields (bio, specialties, availability) without applying `stripControlChars()` sanitization. This creates an XSS/injection risk — malicious control characters or crafted input can be stored directly in the database and later rendered to other users.

## Findings

4 agent consensus during Slice 8 Creator Network review.

- `updateMentorProfile()` in `services/community/MentorshipService.ts` writes `bio`, `specialties`, and `availability` fields to the database without any sanitization
- `stripControlChars()` is already available in the codebase (used in other service methods) but not applied here
- Raw user input stored in these fields could contain control characters, Unicode direction overrides, or injection payloads that affect rendering

## Proposed Solutions

Apply `stripControlChars()` to all user-supplied text fields before the database write in `updateMentorProfile()`:

```typescript
// In updateMentorProfile():
const sanitized = {
  ...profileData,
  bio: profileData.bio ? stripControlChars(profileData.bio) : profileData.bio,
  specialties: profileData.specialties
    ? profileData.specialties.map((s) => stripControlChars(s))
    : profileData.specialties,
  availability: profileData.availability
    ? stripControlChars(profileData.availability)
    : profileData.availability,
};
// then use `sanitized` in the Supabase update call
```

## Technical Details

- **File**: `services/community/MentorshipService.ts`
- **Method**: `updateMentorProfile()`
- **Fields at risk**: `bio`, `specialties` (array of strings), `availability`
- **Existing helper**: `stripControlChars()` — already imported/available in the codebase (see common-solutions.md #87)
- **Pattern**: DOMPurify is a silent no-op in Node.js; `stripControlChars()` is the correct server-side approach

## Acceptance Criteria

- [ ] `stripControlChars()` applied to `bio` field before DB write
- [ ] `stripControlChars()` applied to each element of `specialties` array before DB write
- [ ] `stripControlChars()` applied to `availability` field before DB write
- [ ] Unit test added: verify control characters are stripped on update
- [ ] No change to existing behavior for clean inputs
