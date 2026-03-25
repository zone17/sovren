---
status: pending
priority: p3
issue_id: 751
tags: [code-review, slice-8, frontend, api-client, mentorship]
dependencies: []
---

# P3: Frontend missing updateMentorProfile API call

## Problem Statement

The backend exposes an `updateMentorProfile` endpoint, but the frontend mentor API client does not include a corresponding function to call it. This prevents the frontend from updating mentor profile data, blocking the update mentor profile UI feature.

## Findings

- Backend endpoint exists: `PATCH /api/v2/mentorships/:id/profile` (or similar)
- Frontend missing: `updateMentorProfile()` function in mentor API service
- Impact: Update profile form has no way to submit data to backend
- Location: `src/services/api/mentor.ts` or equivalent

## Proposed Solutions

Add `updateMentorProfile()` function to mentor API service:

```typescript
export async function updateMentorProfile(
  mentorshipId: string,
  data: Partial<MentorProfileUpdate>
): Promise<MentorProfile> {
  const response = await apiClient.patch(`/mentorships/${mentorshipId}/profile`, data);
  return response.data;
}
```

Also add corresponding hook if not already present:

```typescript
export function useUpdateMentorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; data: Partial<MentorProfileUpdate> }) =>
      updateMentorProfile(params.id, params.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mentorProfile', data.id] });
    },
  });
}
```

## Technical Details

- Function should accept mentorshipId and update payload
- Use apiClient (configured with base URL + auth) for request
- Match backend validation and error responses
- Consider optimistic updates in UI if appropriate

## Acceptance Criteria

- [ ] `updateMentorProfile()` function added to mentor API service
- [ ] Function signature matches backend endpoint contract
- [ ] Optional: `useUpdateMentorProfile()` hook created with query client invalidation
- [ ] TypeScript types exported for MentorProfileUpdate
- [ ] Tests added for API function (mock backend response)
- [ ] Frontend form can successfully call the API
