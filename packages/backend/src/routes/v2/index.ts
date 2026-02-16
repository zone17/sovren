/**
 * API v2 Route Aggregator
 *
 * Combines all v2 API routes into a single router
 * Phase 7: Creator Safety Net
 */

import { Router } from 'express';
import wellnessRoutes from './wellness.routes';
import shieldRoutes from './shield.routes';

const router = Router();

/**
 * Mount domain-specific routers
 */
router.use('/wellness', wellnessRoutes);
router.use('/shield', shieldRoutes);

/**
 * API v2 Info Endpoint
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      version: 'v2',
      name: 'Sovren API',
      description: 'Creator Safety Net — Wellness & Content Shield',
      endpoints: {
        wellness: '/api/v2/wellness',
        shield: '/api/v2/shield',
      },
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
