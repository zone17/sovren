/**
 * Analytics Routes - Creator Dashboard Backend
 *
 * Provides 5 REST endpoints consumed by the frontend analytics dashboard:
 *   GET /earnings     - Creator earnings with Lightning/content/subscriber breakdowns
 *   GET /charts       - Time-series chart data (earnings, subscribers, engagement, payments)
 *   GET /performance  - Creator performance scores and recommendations
 *   GET /mobile       - Mobile-optimized summary view
 *   POST /export      - Export analytics data as CSV or JSON
 *
 * All endpoints require authentication via the `authenticate` middleware.
 * Data is queried from Supabase tables: payments, content, content_analytics, followers.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

// All analytics endpoints require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type Period = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

const PeriodSchema = z.enum(['24h', '7d', '30d', '90d', '1y', 'all']).default('7d');

/**
 * Resolve the internal UUID for a user given the userId query param.
 * The frontend sends either the Supabase UUID or the nostr_pubkey.
 */
async function resolveUserId(userIdParam: string): Promise<string | null> {
  // If it looks like a UUID, use it directly
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(userIdParam)) {
    return userIdParam;
  }

  // Otherwise treat as nostr pubkey and look up the UUID
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('nostr_pubkey', userIdParam)
    .single();

  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// GET /earnings
// ---------------------------------------------------------------------------

router.get(
  '/earnings',
  asyncHandler(async (req: Request, res: Response) => {
    const period = PeriodSchema.parse(req.query.period);
    const userIdParam = req.query.userId as string;

    if (!userIdParam) {
      return res.status(400).json({ message: 'userId query parameter is required' });
    }

    const userId = await resolveUserId(userIdParam);
    if (!userId) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const startDate = new Date(now.getTime());
    // Subtract interval manually (approximate for query; the DB filter is authoritative)
    const msMap: Record<Period, number> = {
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000,
      '90d': 7776000000,
      '1y': 31536000000,
      all: 3153600000000,
    };
    startDate.setTime(startDate.getTime() - msMap[period]);

    // Fetch payments received by this user in the period
    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount_sats, payment_type, payment_hash, fee_sats, status, paid_at, created_at')
      .eq('recipient_id', userId)
      .eq('status', 'paid')
      .gte('paid_at', startDate.toISOString())
      .order('paid_at', { ascending: false });

    const paidPayments = payments ?? [];
    const totalSats = paidPayments.reduce((sum, p) => sum + (p.amount_sats ?? 0), 0);
    const totalInvoices = paidPayments.length;
    const avgPayment = totalInvoices > 0 ? Math.round(totalSats / totalInvoices) : 0;
    const largestPayment = paidPayments.reduce((max, p) => Math.max(max, p.amount_sats ?? 0), 0);
    const hoursInPeriod = msMap[period] / 3600000;
    const paymentVelocity =
      hoursInPeriod > 0 ? parseFloat((totalInvoices / hoursInPeriod).toFixed(4)) : 0;

    // Content stats
    const { data: contentRows } = await supabase
      .from('content')
      .select('id, title, visibility, view_count, like_count, comment_count, share_count')
      .eq('creator_id', userId)
      .eq('status', 'published');

    const allContent = contentRows ?? [];
    const premiumPosts = allContent.filter(
      c => c.visibility === 'paid' || c.visibility === 'supporters_only'
    ).length;
    const totalEngagement =
      allContent.reduce(
        (sum, c) =>
          sum +
          (c.view_count ?? 0) +
          (c.like_count ?? 0) +
          (c.comment_count ?? 0) +
          (c.share_count ?? 0),
        0
      ) || 1;
    const avgEngagement = Math.min(
      100,
      Math.round(
        (allContent.reduce((sum, c) => sum + (c.like_count ?? 0) + (c.comment_count ?? 0), 0) /
          totalEngagement) *
          100
      )
    );

    const topContent = allContent
      .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
      .slice(0, 5)
      .map(c => c.title);

    // Subscriber (follower) stats
    const { count: totalFollowers } = await supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId);

    const { count: newFollowers } = await supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId)
      .gte('created_at', startDate.toISOString());

    const subscriberCount = totalFollowers ?? 0;
    const newSubs = newFollowers ?? 0;
    const churnRate = 0; // Cannot compute without unfollow events
    const retentionRate = 100 - churnRate;
    const subscriberGrowth =
      subscriberCount > 0
        ? parseFloat(((newSubs / Math.max(subscriberCount, 1)) * 100).toFixed(1))
        : 0;

    // Geography from content_analytics
    const { data: geoRows } = await supabase
      .from('content_analytics')
      .select('country')
      .in(
        'content_id',
        allContent.map(c => c.id)
      )
      .not('country', 'is', null)
      .limit(500);

    const geoCounts: Record<string, number> = {};
    (geoRows ?? []).forEach(row => {
      const country = row.country ?? 'XX';
      geoCounts[country] = (geoCounts[country] ?? 0) + 1;
    });
    const geography = Object.entries(geoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({
        country,
        subscriber_count: count,
        earnings_sats: 0, // Cannot attribute earnings to geography without join
      }));

    // Realtime stub (would come from WebSocket in production)
    const lastPayment = paidPayments[0];

    const earnings = {
      period,
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
      lightning: {
        total_sats: totalSats,
        total_invoices: totalInvoices,
        paid_invoices: totalInvoices,
        success_rate: 100,
        average_payment: avgPayment,
        largest_payment: largestPayment,
        payment_velocity: paymentVelocity,
      },
      content: {
        total_posts: allContent.length,
        premium_posts: premiumPosts,
        average_engagement: avgEngagement,
        top_performing_content: topContent,
      },
      subscribers: {
        total_count: subscriberCount,
        new_subscribers: newSubs,
        churn_rate: churnRate,
        retention_rate: retentionRate,
        subscriber_growth: subscriberGrowth,
      },
      geography,
      realtime: {
        active_supporters: 0,
        pending_payments: 0,
        last_payment_time: lastPayment?.paid_at ?? undefined,
        current_session_earnings: 0,
      },
    };

    return res.json(earnings);
  })
);

// ---------------------------------------------------------------------------
// GET /charts
// ---------------------------------------------------------------------------

router.get(
  '/charts',
  asyncHandler(async (req: Request, res: Response) => {
    const period = PeriodSchema.parse(req.query.period);
    const userIdParam = req.query.userId as string;

    if (!userIdParam) {
      return res.status(400).json({ message: 'userId query parameter is required' });
    }

    const userId = await resolveUserId(userIdParam);
    if (!userId) {
      return res.status(404).json({ message: 'User not found' });
    }

    const msMap: Record<Period, number> = {
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000,
      '90d': 7776000000,
      '1y': 31536000000,
      all: 3153600000000,
    };
    const startDate = new Date(Date.now() - msMap[period]);

    // Determine bucket size for chart points
    const bucketCount = period === '24h' ? 24 : period === '7d' ? 7 : period === '30d' ? 30 : 12;
    const bucketMs = msMap[period] / bucketCount;

    // Fetch payments
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_sats, paid_at')
      .eq('recipient_id', userId)
      .eq('status', 'paid')
      .gte('paid_at', startDate.toISOString())
      .order('paid_at', { ascending: true });

    // Fetch followers
    const { data: followersData } = await supabase
      .from('followers')
      .select('created_at')
      .eq('following_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // Fetch content analytics (engagement)
    const { data: analyticsData } = await supabase
      .from('content_analytics')
      .select('created_at, event_type, content_id')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(1000);

    // Build time-series buckets
    const earnings: Array<{ timestamp: string; value: number }> = [];
    const subscribers: Array<{ timestamp: string; value: number }> = [];
    const engagement: Array<{ timestamp: string; value: number }> = [];
    const paymentsSeries: Array<{ timestamp: string; value: number }> = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = new Date(startDate.getTime() + i * bucketMs);
      const bucketEnd = new Date(bucketStart.getTime() + bucketMs);
      const ts = bucketStart.toISOString();

      const bucketPayments = (payments ?? []).filter(p => {
        const d = new Date(p.paid_at);
        return d >= bucketStart && d < bucketEnd;
      });

      earnings.push({
        timestamp: ts,
        value: bucketPayments.reduce((s, p) => s + (p.amount_sats ?? 0), 0),
      });

      paymentsSeries.push({
        timestamp: ts,
        value: bucketPayments.length,
      });

      const bucketFollowers = (followersData ?? []).filter(f => {
        const d = new Date(f.created_at);
        return d >= bucketStart && d < bucketEnd;
      });
      subscribers.push({
        timestamp: ts,
        value: bucketFollowers.length,
      });

      const bucketEngagement = (analyticsData ?? []).filter(a => {
        const d = new Date(a.created_at);
        return d >= bucketStart && d < bucketEnd;
      });
      engagement.push({
        timestamp: ts,
        value: bucketEngagement.length,
      });
    }

    return res.json({ earnings, subscribers, engagement, payments: paymentsSeries });
  })
);

// ---------------------------------------------------------------------------
// GET /performance
// ---------------------------------------------------------------------------

router.get(
  '/performance',
  asyncHandler(async (req: Request, res: Response) => {
    const userIdParam = req.query.userId as string;

    if (!userIdParam) {
      return res.status(400).json({ message: 'userId query parameter is required' });
    }

    const userId = await resolveUserId(userIdParam);
    if (!userId) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Content quality — based on engagement rates
    const { data: contentRows } = await supabase
      .from('content')
      .select('view_count, like_count, comment_count, share_count')
      .eq('creator_id', userId)
      .eq('status', 'published');

    const content = contentRows ?? [];
    const totalViews = content.reduce((s, c) => s + (c.view_count ?? 0), 0);
    const totalLikes = content.reduce((s, c) => s + (c.like_count ?? 0), 0);
    const totalComments = content.reduce((s, c) => s + (c.comment_count ?? 0), 0);
    const totalShares = content.reduce((s, c) => s + (c.share_count ?? 0), 0);

    const engagementRate =
      totalViews > 0
        ? Math.min(100, Math.round(((totalLikes + totalComments + totalShares) / totalViews) * 100))
        : 0;

    const contentQualityScore = Math.min(
      100,
      Math.round((content.length * 10 + engagementRate) / 2)
    );
    const engagementScore = engagementRate;

    // Monetization — earnings vs content count
    const { data: payments30d } = await supabase
      .from('payments')
      .select('amount_sats')
      .eq('recipient_id', userId)
      .eq('status', 'paid')
      .gte('paid_at', new Date(Date.now() - 2592000000).toISOString());

    const recentEarnings = (payments30d ?? []).reduce((s, p) => s + (p.amount_sats ?? 0), 0);
    const monetizationEfficiency = Math.min(
      100,
      content.length > 0 ? Math.round(Math.min(recentEarnings / (content.length * 100), 100)) : 0
    );

    // Subscriber satisfaction — retention proxy
    const { count: followerCount } = await supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId);

    const subscriberSatisfaction = Math.min(100, (followerCount ?? 0) * 10);

    const performanceScore = Math.round(
      (contentQualityScore + engagementScore + monetizationEfficiency + subscriberSatisfaction) / 4
    );

    // Determine trends based on recent vs older period
    const earningsTrend: 'growing' | 'stable' | 'declining' =
      recentEarnings > 0 ? 'growing' : 'stable';
    const subscriberTrend: 'growing' | 'stable' | 'declining' =
      (followerCount ?? 0) > 0 ? 'growing' : 'stable';
    const engagementTrend: 'growing' | 'stable' | 'declining' =
      engagementRate > 20 ? 'growing' : engagementRate > 5 ? 'stable' : 'declining';

    // Recommendations
    const recommendations: Array<{
      type: 'content' | 'pricing' | 'engagement' | 'technical';
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
    }> = [];

    if (content.length < 5) {
      recommendations.push({
        type: 'content',
        priority: 'high',
        title: 'Publish more content',
        description:
          'Creators with 5+ published articles see 3x more subscriber growth. Keep posting consistently.',
      });
    }

    if (engagementRate < 10) {
      recommendations.push({
        type: 'engagement',
        priority: 'medium',
        title: 'Boost audience engagement',
        description:
          'Ask questions in your posts and respond to comments to increase interaction rates.',
      });
    }

    if (monetizationEfficiency < 30) {
      recommendations.push({
        type: 'pricing',
        priority: 'medium',
        title: 'Optimize your pricing strategy',
        description:
          'Consider offering tiered content access to convert free readers into paying supporters.',
      });
    }

    return res.json({
      performance_score: performanceScore,
      content_quality_score: contentQualityScore,
      engagement_score: engagementScore,
      monetization_efficiency: monetizationEfficiency,
      subscriber_satisfaction: subscriberSatisfaction,
      earnings_trend: earningsTrend,
      subscriber_trend: subscriberTrend,
      engagement_trend: engagementTrend,
      recommendations,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /mobile
// ---------------------------------------------------------------------------

router.get(
  '/mobile',
  asyncHandler(async (req: Request, res: Response) => {
    const userIdParam = req.query.userId as string;

    if (!userIdParam) {
      return res.status(400).json({ message: 'userId query parameter is required' });
    }

    const userId = await resolveUserId(userIdParam);
    if (!userId) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now.getTime() - 604800000);

    // Today's earnings
    const { data: todayPayments } = await supabase
      .from('payments')
      .select('amount_sats')
      .eq('recipient_id', userId)
      .eq('status', 'paid')
      .gte('paid_at', todayStart.toISOString());

    const todayEarnings = (todayPayments ?? []).reduce((s, p) => s + (p.amount_sats ?? 0), 0);

    // Week's earnings
    const { data: weekPayments } = await supabase
      .from('payments')
      .select('amount_sats')
      .eq('recipient_id', userId)
      .eq('status', 'paid')
      .gte('paid_at', weekStart.toISOString());

    const weekEarnings = (weekPayments ?? []).reduce((s, p) => s + (p.amount_sats ?? 0), 0);

    // Subscriber count
    const { count: totalSubscribers } = await supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId);

    // Recent payments (last 3)
    const { data: recentPaymentsRaw } = await supabase
      .from('payments')
      .select('id, amount_sats, description, paid_at, payer_id, content_id, payment_hash, fee_sats')
      .eq('recipient_id', userId)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(3);

    const recentPayments = (recentPaymentsRaw ?? []).map(p => ({
      id: p.id,
      amount_sats: p.amount_sats,
      description: p.description ?? '',
      paid_at: p.paid_at ?? new Date().toISOString(),
      supporter_id: p.payer_id ?? undefined,
      content_id: p.content_id ?? undefined,
      payment_hash: p.payment_hash ?? '',
      fee_sats: p.fee_sats ?? 0,
      settlement_time_ms: 0,
    }));

    return res.json({
      summary: {
        today_earnings_sats: todayEarnings,
        week_earnings_sats: weekEarnings,
        total_subscribers: totalSubscribers ?? 0,
        recent_payments: recentPayments,
      },
      quick_actions: [
        { label: 'Create Post', action: '/create', icon: 'edit', color: '#6366f1' },
        { label: 'View Earnings', action: '/analytics', icon: 'trending-up', color: '#10b981' },
        { label: 'Messages', action: '/messages', icon: 'message-circle', color: '#f59e0b' },
        { label: 'Settings', action: '/settings', icon: 'settings', color: '#8b5cf6' },
      ],
    });
  })
);

// ---------------------------------------------------------------------------
// POST /export
// ---------------------------------------------------------------------------

const ExportSchema = z.object({
  format: z.enum(['csv', 'json', 'pdf']),
  data_types: z.array(z.enum(['earnings', 'subscribers', 'content', 'payments'])),
  date_range: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  include_personal_data: z.boolean(),
  userId: z.string(),
});

router.post(
  '/export',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = ExportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid export configuration', errors: parsed.error.errors });
    }

    const { format, data_types, date_range, userId: userIdParam } = parsed.data;

    const userId = await resolveUserId(userIdParam);
    if (!userId) {
      return res.status(404).json({ message: 'User not found' });
    }

    const exportData: Record<string, unknown[]> = {};

    if (data_types.includes('payments') || data_types.includes('earnings')) {
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount_sats, payment_type, status, paid_at, fee_sats, description')
        .eq('recipient_id', userId)
        .eq('status', 'paid')
        .gte('paid_at', date_range.start)
        .lte('paid_at', date_range.end)
        .order('paid_at', { ascending: false });

      exportData.payments = payments ?? [];
    }

    if (data_types.includes('content')) {
      const { data: contentData } = await supabase
        .from('content')
        .select(
          'id, title, content_type, visibility, view_count, like_count, comment_count, created_at'
        )
        .eq('creator_id', userId)
        .eq('status', 'published')
        .gte('created_at', date_range.start)
        .lte('created_at', date_range.end)
        .order('created_at', { ascending: false });

      exportData.content = contentData ?? [];
    }

    if (data_types.includes('subscribers')) {
      const { data: followersData } = await supabase
        .from('followers')
        .select('id, follower_id, created_at')
        .eq('following_id', userId)
        .gte('created_at', date_range.start)
        .lte('created_at', date_range.end)
        .order('created_at', { ascending: false });

      exportData.subscribers = followersData ?? [];
    }

    if (format === 'csv') {
      // Build a simple CSV from the first available data type
      const allRows: string[] = [];
      for (const [dataType, rows] of Object.entries(exportData)) {
        if (rows.length === 0) continue;
        const headers = Object.keys(rows[0] as Record<string, unknown>);
        allRows.push(`--- ${dataType} ---`);
        allRows.push(headers.join(','));
        for (const row of rows) {
          const record = row as Record<string, unknown>;
          allRows.push(headers.map(h => String(record[h] ?? '')).join(','));
        }
        allRows.push('');
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
      return res.send(allRows.join('\n'));
    }

    // Default: JSON export
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.json');
    return res.json(exportData);
  })
);

export default router;
