import { SupabaseDatabase } from '../config/database';

// 📊 NIP-05 Analytics Types
export interface VerificationAnalytics {
  total_verifications: number;
  successful_verifications: number;
  failed_verifications: number;
  pending_verifications: number;
  success_rate: number;
  average_verification_time: number;
  most_popular_domains: Array<{ domain: string; count: number }>;
  verification_methods: {
    http: number;
    dns: number;
    manual: number;
  };
  daily_stats: Array<{
    date: string;
    total: number;
    successful: number;
    failed: number;
  }>;
  performance_metrics: {
    average_response_time: number;
    p95_response_time: number;
    p99_response_time: number;
    error_rate: number;
  };
}

export interface DomainAnalytics {
  domain: string;
  total_verifications: number;
  verified_count: number;
  pending_count: number;
  failed_count: number;
  success_rate: number;
  first_verification: string;
  last_verification: string;
  verification_methods: {
    http: number;
    dns: number;
    manual: number;
  };
  average_verification_time: number;
  trending_score: number;
}

export interface VerificationInsights {
  success_patterns: {
    best_performing_methods: string[];
    optimal_verification_times: string[];
    high_success_domains: string[];
  };
  failure_patterns: {
    common_failure_reasons: Array<{ reason: string; count: number }>;
    problematic_domains: string[];
    failure_spikes: Array<{ date: string; count: number }>;
  };
  recommendations: {
    performance_improvements: string[];
    domain_optimizations: string[];
    method_suggestions: string[];
  };
}

/**
 * 📊 Elite NIP-05 Analytics Service
 * WHY: Comprehensive analytics and insights for NIP-05 verification performance
 */
export class NIP05AnalyticsService {
  private database: SupabaseDatabase;

  constructor(database?: SupabaseDatabase) {
    this.database = database || new SupabaseDatabase();
  }

  /**
   * 📊 Get Comprehensive Verification Analytics
   * WHY: Provide overview of verification performance and trends
   */
  async getVerificationAnalytics(timeRange: string = '30d'): Promise<{
    success: boolean;
    analytics?: VerificationAnalytics;
    error?: string;
  }> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);

      // Get basic verification counts
      const { data: verificationCounts } = await this.database.client
        .from('nip05_verifications')
        .select('verification_status, verification_method, created_at, verified_at')
        .gte('created_at', timeFilter);

      if (!verificationCounts) {
        return { success: false, error: 'Failed to fetch verification data' };
      }

      // Get domain statistics
      const { data: domainStats } = await this.database.client
        .from('nip05_verifications')
        .select('domain')
        .gte('created_at', timeFilter);

      // Get performance metrics from history
      const { data: performanceData } = await this.database.client
        .from('nip05_verification_history')
        .select('response_time_ms, status_to, created_at')
        .gte('created_at', timeFilter);

      // Calculate analytics
      const analytics = this.calculateAnalytics(
        verificationCounts,
        domainStats || [],
        performanceData || []
      );

      return { success: true, analytics };
    } catch (error) {
      return {
        success: false,
        error: `Analytics calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🌐 Get Domain-Specific Analytics
   * WHY: Analyze performance patterns for specific domains
   */
  async getDomainAnalytics(domain: string): Promise<{
    success: boolean;
    analytics?: DomainAnalytics;
    error?: string;
  }> {
    try {
      const { data: domainData } = await this.database.client
        .from('nip05_verifications')
        .select('*')
        .eq('domain', domain.toLowerCase());

      if (!domainData || domainData.length === 0) {
        return { success: false, error: 'No verification data found for domain' };
      }

      const analytics = this.calculateDomainAnalytics(domain, domainData);

      return { success: true, analytics };
    } catch (error) {
      return {
        success: false,
        error: `Domain analytics failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔍 Get Verification Insights
   * WHY: Provide actionable insights for improving verification success
   */
  async getVerificationInsights(timeRange: string = '30d'): Promise<{
    success: boolean;
    insights?: VerificationInsights;
    error?: string;
  }> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);

      // Get successful verifications
      const { data: successfulVerifications } = await this.database.client
        .from('nip05_verifications')
        .select('verification_method, domain, verified_at, created_at')
        .eq('verification_status', 'verified')
        .gte('created_at', timeFilter);

      // Get failed verifications
      const { data: failedVerifications } = await this.database.client
        .from('nip05_verifications')
        .select('failure_reason, domain, verification_method, created_at')
        .eq('verification_status', 'failed')
        .gte('created_at', timeFilter);

      const insights = this.generateInsights(
        successfulVerifications || [],
        failedVerifications || []
      );

      return { success: true, insights };
    } catch (error) {
      return {
        success: false,
        error: `Insights generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 📈 Track Verification Attempt
   * WHY: Record analytics data for verification attempts
   */
  async trackVerificationAttempt(data: {
    verification_id: string;
    method: string;
    domain: string;
    user_agent?: string;
    ip_address?: string;
    response_time_ms?: number;
    result: 'success' | 'failure';
    error_message?: string;
  }): Promise<void> {
    try {
      await this.database.client.from('nip05_verification_history').insert({
        verification_id: data.verification_id,
        status_from: 'pending',
        status_to: data.result === 'success' ? 'verified' : 'failed',
        verification_method: data.method,
        verification_data: {
          domain: data.domain,
          user_agent: data.user_agent,
          result: data.result,
        },
        error_message: data.error_message,
        response_time_ms: data.response_time_ms,
        ip_address: data.ip_address,
      });
    } catch (error) {
      console.warn('Failed to track verification attempt:', error);
    }
  }

  /**
   * 📊 Get Usage Statistics
   * WHY: Monitor system usage and capacity planning
   */
  async getUsageStatistics(timeRange: string = '24h'): Promise<{
    success: boolean;
    stats?: {
      verification_requests: number;
      unique_domains: number;
      unique_users: number;
      api_calls: number;
      bandwidth_usage: number;
      error_rate: number;
    };
    error?: string;
  }> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);

      const { data: usageData } = await this.database.client
        .from('nip05_verification_history')
        .select('verification_id, verification_data, response_time_ms, error_message')
        .gte('created_at', timeFilter);

      if (!usageData) {
        return { success: false, error: 'Failed to fetch usage data' };
      }

      const stats = {
        verification_requests: usageData.length,
        unique_domains: new Set(usageData.map((d) => d.verification_data?.domain).filter(Boolean))
          .size,
        unique_users: new Set(usageData.map((d) => d.verification_id)).size,
        api_calls: usageData.length,
        bandwidth_usage: usageData.reduce(
          (sum, d) => sum + (d.verification_data ? JSON.stringify(d.verification_data).length : 0),
          0
        ),
        error_rate: usageData.filter((d) => d.error_message).length / usageData.length,
      };

      return { success: true, stats };
    } catch (error) {
      return {
        success: false,
        error: `Usage statistics failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Private helper methods

  private getTimeFilter(timeRange: string): string {
    const now = new Date();
    let timeAgo: Date;

    switch (timeRange) {
      case '1h':
        timeAgo = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        timeAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        timeAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return timeAgo.toISOString();
  }

  private calculateAnalytics(
    verifications: any[],
    domains: any[],
    performance: any[]
  ): VerificationAnalytics {
    const total = verifications.length;
    const successful = verifications.filter((v) => v.verification_status === 'verified').length;
    const failed = verifications.filter((v) => v.verification_status === 'failed').length;
    const pending = verifications.filter((v) => v.verification_status === 'pending').length;

    // Calculate method distribution
    const methodCounts = verifications.reduce(
      (acc, v) => {
        acc[v.verification_method] = (acc[v.verification_method] || 0) + 1;
        return acc;
      },
      { http: 0, dns: 0, manual: 0 }
    );

    // Calculate domain popularity
    const domainCounts = domains.reduce(
      (acc, d) => {
        acc[d.domain] = (acc[d.domain] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const popularDomains = Object.entries(domainCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count: count as number }));

    // Calculate daily stats
    const dailyStats = this.calculateDailyStats(verifications);

    // Calculate performance metrics
    const responseTimes = performance
      .filter((p) => p.response_time_ms)
      .map((p) => p.response_time_ms);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

    responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    // Calculate average verification time
    const verificationTimes = verifications
      .filter((v) => v.verified_at && v.created_at)
      .map((v) => new Date(v.verified_at).getTime() - new Date(v.created_at).getTime());

    const averageVerificationTime =
      verificationTimes.length > 0
        ? verificationTimes.reduce((sum, time) => sum + time, 0) / verificationTimes.length / 1000
        : 0;

    return {
      total_verifications: total,
      successful_verifications: successful,
      failed_verifications: failed,
      pending_verifications: pending,
      success_rate: total > 0 ? successful / total : 0,
      average_verification_time: averageVerificationTime,
      most_popular_domains: popularDomains,
      verification_methods: methodCounts,
      daily_stats: dailyStats,
      performance_metrics: {
        average_response_time: averageResponseTime,
        p95_response_time: responseTimes[p95Index] || 0,
        p99_response_time: responseTimes[p99Index] || 0,
        error_rate:
          performance.filter((p) => p.status_to === 'failed').length / performance.length || 0,
      },
    };
  }

  private calculateDomainAnalytics(domain: string, data: any[]): DomainAnalytics {
    const total = data.length;
    const verified = data.filter((d) => d.verification_status === 'verified').length;
    const pending = data.filter((d) => d.verification_status === 'pending').length;
    const failed = data.filter((d) => d.verification_status === 'failed').length;

    const methodCounts = data.reduce(
      (acc, d) => {
        acc[d.verification_method] = (acc[d.verification_method] || 0) + 1;
        return acc;
      },
      { http: 0, dns: 0, manual: 0 }
    );

    const dates = data.map((d) => new Date(d.created_at)).sort();
    const verificationTimes = data
      .filter((d) => d.verified_at && d.created_at)
      .map((d) => new Date(d.verified_at).getTime() - new Date(d.created_at).getTime());

    const averageTime =
      verificationTimes.length > 0
        ? verificationTimes.reduce((sum, time) => sum + time, 0) / verificationTimes.length / 1000
        : 0;

    return {
      domain,
      total_verifications: total,
      verified_count: verified,
      pending_count: pending,
      failed_count: failed,
      success_rate: total > 0 ? verified / total : 0,
      first_verification: dates[0]?.toISOString() || '',
      last_verification: dates[dates.length - 1]?.toISOString() || '',
      verification_methods: methodCounts,
      average_verification_time: averageTime,
      trending_score: this.calculateTrendingScore(data),
    };
  }

  private calculateDailyStats(verifications: any[]): Array<{
    date: string;
    total: number;
    successful: number;
    failed: number;
  }> {
    const dailyData = verifications.reduce(
      (acc, v) => {
        const date = new Date(v.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { total: 0, successful: 0, failed: 0 };
        }
        acc[date].total++;
        if (v.verification_status === 'verified') acc[date].successful++;
        if (v.verification_status === 'failed') acc[date].failed++;
        return acc;
      },
      {} as Record<string, { total: number; successful: number; failed: number }>
    );

    return Object.entries(dailyData)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateTrendingScore(data: any[]): number {
    const now = Date.now();
    const recentData = data.filter(
      (d) => now - new Date(d.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
    );

    const olderData = data.filter(
      (d) =>
        now - new Date(d.created_at).getTime() >= 7 * 24 * 60 * 60 * 1000 &&
        now - new Date(d.created_at).getTime() < 14 * 24 * 60 * 60 * 1000
    );

    const recentCount = recentData.length;
    const olderCount = olderData.length;

    if (olderCount === 0) return recentCount > 0 ? 1 : 0;
    return (recentCount - olderCount) / olderCount;
  }

  private generateInsights(successful: any[], failed: any[]): VerificationInsights {
    // Analyze successful patterns
    const methodSuccess = successful.reduce(
      (acc, s) => {
        acc[s.verification_method] = (acc[s.verification_method] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const bestMethods = Object.entries(methodSuccess)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([method]) => method);

    const domainSuccess = successful.reduce(
      (acc, s) => {
        acc[s.domain] = (acc[s.domain] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const highSuccessDomains = Object.entries(domainSuccess)
      .filter(([, count]) => (count as number) > 5)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([domain]) => domain);

    // Analyze failure patterns
    const failureReasons = failed.reduce(
      (acc, f) => {
        const reason = f.failure_reason || 'Unknown error';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const commonFailures = Object.entries(failureReasons)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count: count as number }));

    return {
      success_patterns: {
        best_performing_methods: bestMethods,
        optimal_verification_times: ['10:00-12:00', '14:00-16:00'], // Mock data
        high_success_domains: highSuccessDomains,
      },
      failure_patterns: {
        common_failure_reasons: commonFailures,
        problematic_domains: [], // Would calculate from failure rates
        failure_spikes: [], // Would calculate from time series
      },
      recommendations: {
        performance_improvements: [
          'Consider implementing retry logic for failed DNS verifications',
        ],
        domain_optimizations: ['Monitor high-traffic domains for potential rate limiting'],
        method_suggestions: ['Optimize HTTP verification timeout settings'],
      },
    };
  }
}

// 🏭 Service Factory
export const createNIP05AnalyticsService = (database?: SupabaseDatabase): NIP05AnalyticsService => {
  return new NIP05AnalyticsService(database);
};
