/**
 * Main Route Aggregator
 *
 * Entry point for all API routes
 * Handles API versioning and route organization
 */

import { Router } from 'express';
import v1Routes from './v1';

const router = Router();

// Mount API version routers
router.use('/v1', v1Routes);

// Default to v1 for backward compatibility
router.use('/', v1Routes);

// API Root Endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Sovren API',
      version: 'latest',
      availableVersions: ['v1'],
      defaultVersion: 'v1',
      endpoints: {
        v1: '/api/v1',
        docs: '/api/docs',
        health: '/health',
      },
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
