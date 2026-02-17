/**
 * API v1 Route Aggregator
 *
 * Combines all v1 API routes into a single router
 * Provides centralized route management and versioning
 */

import { Router } from 'express';
import contentRoutes from './content.routes';
import userRoutes from './user.routes';
import paymentRoutes from './payment.routes';
import metricsRoutes from './metrics.routes';

const router = Router();

/**
 * Mount domain-specific routers
 */
router.use('/content', contentRoutes);
router.use('/users', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/metrics', metricsRoutes);

/**
 * API v1 Info Endpoint
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      version: 'v1',
      name: 'Sovren API',
      description: 'NOSTR-native creator monetization platform',
      endpoints: {
        content: '/api/v1/content',
        users: '/api/v1/users',
        payments: '/api/v1/payments',
        metrics: '/api/v1/metrics',
      },
      documentation: '/api/docs',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
