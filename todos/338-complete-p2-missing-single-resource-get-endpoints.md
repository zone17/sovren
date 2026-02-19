---
status: pending
priority: p2
issue_id: 338
tags: [code-review, agent-native, api]
---

# Missing single-resource GET endpoints (circles, contracts, listings, messages)

## Problem Statement

Several resources lack single-resource GET endpoints, making it impossible for clients or agents to fetch a specific resource by ID. This forces clients to fetch entire lists and filter client-side, which is inefficient and not compatible with agent-native API patterns.

## Findings

- No `GET /circles/:id` route — cannot fetch a single circle
- No `GET /marketplace/listings/:id` route — cannot fetch a single listing
- No `GET /business/contracts/:id` route — cannot fetch a single contract
- No `GET /inbox/messages/:id` route — cannot fetch a single message

## Proposed Solutions

1. Add single-resource GET routes for each resource:
   - `GET /circles/:id`
   - `GET /marketplace/listings/:id`
   - `GET /business/contracts/:id`
   - `GET /inbox/messages/:id`
2. Add corresponding `getById()` methods to each service interface and implementation
3. Return 404 if the resource is not found
4. Include proper authorization checks (user can only access their own resources)

## Technical Details

- **Affected Files**: packages/backend/src/routes/v2/circles.routes.ts, packages/backend/src/routes/v2/marketplace.routes.ts, packages/backend/src/routes/v2/business-contracts.routes.ts, packages/backend/src/routes/v2/inbox.routes.ts, and corresponding service files

## Acceptance Criteria

- [ ] All 4 single-resource GET routes implemented
- [ ] Each route validates the ID parameter
- [ ] Authorization checks ensure users can only access their own resources
- [ ] 404 returned for non-existent resources
- [ ] Response uses `createApiResponse()` helper
- [ ] Routes follow existing patterns and middleware chain
