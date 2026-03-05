/**
 * API v2 Route Aggregator
 *
 * Combines all v2 API routes into a single router
 * Phase 7: Creator Safety Net + Phase 8: Multi-Platform Hub + Wave 2
 */

import { Router } from 'express';
import wellnessRoutes from './wellness.routes';
import shieldRoutes from './shield.routes';
import discoveryRoutes from './discovery.routes';
import platformsRoutes from './platforms.routes';
import distributeRoutes from './distribute.routes';
import inboxRoutes from './inbox.routes';
import crossPlatformAnalyticsRoutes from './analytics-crossplatform.routes';
// Slice 6: Comments CRUD
import commentsRoutes from './comments.routes';

// EPIC-010: Creator Network
import circlesRoutes from './circles.routes';
import mentorshipRoutes from './mentorship.routes';
import collaborationRoutes from './collaboration.routes';
import marketplaceRoutes from './marketplace.routes';
// EPIC-011: Business Manager
import contractRoutes from './business-contracts.routes';
import invoiceRoutes from './business-invoices.routes';
import revenueRoutes from './business-revenue.routes';
import taxRoutes from './business-tax.routes';

const router = Router();

/**
 * Mount domain-specific routers
 */
router.use('/wellness', wellnessRoutes);
router.use('/shield', shieldRoutes);
router.use('/discovery', discoveryRoutes);

// EPIC-009: Multi-Platform Hub
router.use('/platforms', platformsRoutes);
router.use('/distribute', distributeRoutes);
router.use('/inbox', inboxRoutes);
router.use('/analytics/cross-platform', crossPlatformAnalyticsRoutes);

// Slice 6: Comments CRUD
router.use('/comments', commentsRoutes);

// EPIC-010: Creator Network
router.use('/circles', circlesRoutes);
router.use('/mentorship', mentorshipRoutes);
router.use('/content', collaborationRoutes);
router.use('/marketplace', marketplaceRoutes);

// EPIC-011: Business Manager
router.use('/business/contracts', contractRoutes);
router.use('/business/invoices', invoiceRoutes);
router.use('/business/revenue', revenueRoutes);
router.use('/business/tax', taxRoutes);

/**
 * API v2 Info Endpoint
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      version: 'v2',
      name: 'Sovren API',
      description: 'Creator Safety Net — Wellness, Content Shield, Multi-Platform Hub & Wave 2',
      endpoints: {
        comments: '/api/v2/comments',
        wellness: '/api/v2/wellness',
        shield: '/api/v2/shield',
        discovery: '/api/v2/discovery',
        platforms: '/api/v2/platforms',
        distribute: '/api/v2/distribute',
        inbox: '/api/v2/inbox',
        analytics_crossplatform: '/api/v2/analytics/cross-platform',
        circles: '/api/v2/circles',
        mentorship: '/api/v2/mentorship',
        collaboration: '/api/v2/content',
        marketplace: '/api/v2/marketplace',
        business_contracts: '/api/v2/business/contracts',
        business_invoices: '/api/v2/business/invoices',
        business_revenue: '/api/v2/business/revenue',
        business_tax: '/api/v2/business/tax',
      },
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
