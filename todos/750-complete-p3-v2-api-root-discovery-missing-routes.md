---
status: pending
priority: p3
issue_id: 750
tags: [code-review, slice-8, api, discovery, routes]
dependencies: []
---

# P3: v2 API root discovery missing new sub-routes

## Problem Statement

The v2 API root endpoint (`/api/v2` or similar) provides a discovery response listing available routes, but it does not include the newly added circle, mentorship, follow, and notification routes. This breaks API discoverability for clients that rely on the root endpoint to dynamically discover available operations.

## Findings

- File: `routes/v2/index.ts` or equivalent API root handler
- Missing routes in discovery response:
  - `/api/v2/circles` (and sub-endpoints)
  - `/api/v2/mentorships` (and sub-endpoints)
  - `/api/v2/follows` (and sub-endpoints)
  - `/api/v2/notifications` (and sub-endpoints)
- Current state: Root endpoint returns stale route list without new Slice 8 routes

## Proposed Solutions

Update the v2 root endpoint to include all new routes:

```typescript
export function handleV2Root(req: Request) {
  return createApiResponse({
    message: 'Sovren API v2',
    routes: {
      circles: '/api/v2/circles',
      mentorships: '/api/v2/mentorships',
      follows: '/api/v2/follows',
      notifications: '/api/v2/notifications',
      // ... existing routes
    },
  });
}
```

## Technical Details

- API discovery endpoint should list all public routes
- Enables clients to auto-discover available operations
- Best practice for REST APIs to provide navigation/HATEOAS link discovery
- Update required whenever new major resource endpoints are added

## Acceptance Criteria

- [ ] v2 root endpoint includes all 4 new route categories
- [ ] Each route entry includes correct URL path
- [ ] Routes are discoverable by HEAD/GET request to `/api/v2`
- [ ] Documentation updated to reflect new routes
- [ ] E2E test verifies discovery response contains all expected routes
