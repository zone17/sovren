---
status: pending
priority: p2
issue_id: 337
tags: [code-review, agent-native, api]
---

# Missing `GET /marketplace/orders` endpoint — can't list orders

## Problem Statement

There is no route for buyers or sellers to retrieve their order list. The frontend `OrderTracker` component receives orders as props, but there is no API endpoint to fetch them. This means the order list cannot be populated from the backend, making the OrderTracker component non-functional in practice.

## Findings

- No `GET /marketplace/orders` route exists in the marketplace routes
- `OrderTracker` component receives orders as props but no data source exists
- Both buyer and seller roles need to view their orders

## Proposed Solutions

1. Add `getOrders(userId: string, role: 'buyer' | 'seller')` method to `IMarketplaceService` interface
2. Implement the method in `MarketplaceService` with filtering by user and role
3. Add `GET /marketplace/orders` route with authentication and role-based filtering
4. Support pagination (limit/offset) from the start

## Technical Details

- **Affected Files**: packages/backend/src/services/community/IMarketplaceService.ts, packages/backend/src/services/community/MarketplaceService.ts, packages/backend/src/routes/v2/marketplace.routes.ts

## Acceptance Criteria

- [ ] `getOrders()` method added to IMarketplaceService interface
- [ ] Method implemented in MarketplaceService with user and role filtering
- [ ] `GET /marketplace/orders` route added with authentication middleware
- [ ] Route supports pagination parameters
- [ ] Buyers see their purchases, sellers see their sales
- [ ] Response uses `createApiResponse()` helper
