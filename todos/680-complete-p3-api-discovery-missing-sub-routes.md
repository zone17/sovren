---
status: complete
priority: p3
issue_id: 680
tags: [code-review, slice-7, api-discovery, wellness, routes]
dependencies: []
---

## Problem Statement

Wellness sub-resources (boundaries, schedule, buffer-depth) are not listed in the API root/discovery endpoint. Agents and API consumers cannot discover these endpoints programmatically.

## Findings

- API root/discovery endpoint (typically `GET /api/v2/` or similar) returns a list of available routes
- Wellness sub-resources are missing from this listing:
  - `/api/v2/wellness/boundaries` — creator boundary settings (DND mode, interaction limits)
  - `/api/v2/wellness/schedule` — wellness schedule configuration
  - `/api/v2/wellness/buffer-depth` — buffer depth settings
- This was a recurring finding pattern — see todo #550 (health endpoints missing from API discovery)
- Without discovery entries, automated agents and API documentation generators cannot find these endpoints
- The API discovery response serves as the machine-readable contract for available functionality

## Proposed Solutions

1. Add wellness sub-route entries to the API discovery response:
   ```typescript
   {
     wellness: {
       boundaries: { href: '/api/v2/wellness/boundaries', methods: ['GET', 'PUT'] },
       schedule: { href: '/api/v2/wellness/schedule', methods: ['GET', 'PUT'] },
       bufferDepth: { href: '/api/v2/wellness/buffer-depth', methods: ['GET', 'PUT'] },
     }
   }
   ```
2. Follow the existing pattern used by other resource groups in the discovery response
3. Include HTTP methods supported by each sub-resource for HATEOAS compliance
4. If there is a central route registry or discovery builder, add entries there rather than hardcoding

## Recommended Action

## Technical Details

- The API discovery endpoint pattern was established in common-solutions.md #53 (API root discovery)
- Todo #550 (complete P3) previously added health/monitoring endpoints to discovery — follow the same pattern
- The discovery response should match the actual route registration to avoid drift
- Consider whether the discovery should be auto-generated from route registrations (longer-term improvement) vs. manually maintained (current pattern)
- Sub-resources under `/wellness/` that require authentication should be listed under an authenticated section if the discovery response differentiates

## Acceptance Criteria

- [ ] All wellness sub-routes (boundaries, schedule, buffer-depth) appear in the API discovery response
- [ ] Each entry includes the correct href and supported HTTP methods
- [ ] Discovery response format matches the existing pattern for other resource groups
- [ ] No regression in existing discovery entries
- [ ] API consumers can programmatically discover all wellness endpoints

## Work Log

## Resources

- API root/discovery endpoint handler (likely in `packages/backend/src/routes/` or `packages/backend/src/server.ts`)
- Todo #550 (complete P3 — health endpoints API discovery)
- common-solutions.md #53 (API root discovery pattern)
- Existing wellness route registrations in `packages/backend/src/routes/v2/wellness*.routes.ts`
