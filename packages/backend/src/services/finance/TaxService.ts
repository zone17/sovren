/**
 * Tax Service
 * EPIC-011: Business Manager — Tax preparation, expense tracking, quarterly summaries
 *
 * Security:
 * H-5: Records rate_source + rate_timestamp with every USD conversion
 * L-5: CSV export sanitizes formula-injection characters
 */

import type { ITaxService } from '../../interfaces/finance/ITaxService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
import type { ILogger } from '../../interfaces/shared/ILogger';

const BTC_RATE_TTL_ACTIVE = 300;   // 5 minutes for active tax calculations
const BTC_RATE_CACHE_KEY = 'btc:usd:rate';
const RATE_SOURCE = 'coingecko';

// L-5: Characters that trigger formula execution in spreadsheet apps
const CSV_FORMULA_CHARS = /^[=+\-@]/;

export class TaxService implements ITaxService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly cache: ICacheService,
    private readonly logger: ILogger
  ) {}

  async getQuarterlySummary(
    creatorId: string,
    year: number,
    quarter: 1 | 2 | 3 | 4
  ): Promise<{
    revenue: number;
    expenses: number;
    net: number;
    usdRevenue: number;
    usdExpenses: number;
    usdNet: number;
  }> {
    this.logger.info('TaxService.getQuarterlySummary', { creatorId, year, quarter });

    const { startDate, endDate } = this.quarterDateRange(year, quarter);

    const { data: revenueData, error: revenueError } = await this.db
      .from('revenue_entries')
      .select('amount_sats, usd_at_time')
      .eq('creator_id', creatorId)
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate);

    if (revenueError) throw revenueError;

    const { data: expenseData, error: expenseError } = await this.db
      .from('expenses')
      .select('amount_sats, usd_at_time')
      .eq('creator_id', creatorId)
      .gte('expense_date', startDate.split('T')[0])
      .lte('expense_date', endDate.split('T')[0]);

    if (expenseError) throw expenseError;

    const revenues = (revenueData ?? []) as Array<{ amount_sats: number; usd_at_time: number | null }>;
    const expenses = (expenseData ?? []) as Array<{ amount_sats: number; usd_at_time: number | null }>;

    const totalRevenueSats = revenues.reduce((sum, r) => sum + r.amount_sats, 0);
    const totalExpenseSats = expenses.reduce((sum, e) => sum + e.amount_sats, 0);

    // Use recorded usd_at_time (captured at receipt) where available.
    // Fall back to live rate for entries missing USD values — 5-min TTL.
    const { rate: btcRateUsd } = await this.getBtcUsdRate();

    const usdRevenue = revenues.reduce((sum, r) => {
      if (r.usd_at_time !== null) return sum + r.usd_at_time;
      return sum + (r.amount_sats / 100_000_000) * btcRateUsd;
    }, 0);

    const usdExpenses = expenses.reduce((sum, e) => {
      if (e.usd_at_time !== null) return sum + e.usd_at_time;
      return sum + (e.amount_sats / 100_000_000) * btcRateUsd;
    }, 0);

    return {
      revenue: totalRevenueSats,
      expenses: totalExpenseSats,
      net: totalRevenueSats - totalExpenseSats,
      usdRevenue: Math.round(usdRevenue * 100) / 100,
      usdExpenses: Math.round(usdExpenses * 100) / 100,
      usdNet: Math.round((usdRevenue - usdExpenses) * 100) / 100,
    };
  }

  async getExpenses(
    creatorId: string,
    filters?: { categoryId?: string; startDate?: string; endDate?: string }
  ): Promise<any[]> {
    this.logger.info('TaxService.getExpenses', { creatorId, filters });

    let query = this.db
      .from('expenses')
      .select('*, expense_categories(name, type)')
      .eq('creator_id', creatorId);

    if (filters?.categoryId) {
      query = (query as any).eq('category_id', filters.categoryId);
    }
    if (filters?.startDate) {
      query = (query as any).gte('expense_date', filters.startDate);
    }
    if (filters?.endDate) {
      query = (query as any).lte('expense_date', filters.endDate);
    }

    const { data, error } = await (query as any).order('expense_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async addExpense(
    creatorId: string,
    data: {
      categoryId?: string;
      description: string;
      amountSats: number;
      expenseDate?: string;
    }
  ): Promise<{ id: string }> {
    this.logger.info('TaxService.addExpense', { creatorId, description: data.description });

    if (data.amountSats <= 0) {
      throw new Error('Expense amount must be greater than 0 sats');
    }

    // H-5: Record rate with provenance — source + timestamp
    const { rate: btcRateUsd, fetchedAt } = await this.getBtcUsdRate();
    const usdAtTime = (data.amountSats / 100_000_000) * btcRateUsd;

    const row: Record<string, unknown> = {
      creator_id: creatorId,
      description: data.description,
      amount_sats: data.amountSats,
      usd_at_time: Math.round(usdAtTime * 100) / 100,
      rate_source: RATE_SOURCE,
      rate_timestamp: fetchedAt,
      expense_date: data.expenseDate ?? new Date().toISOString().split('T')[0],
    };
    if (data.categoryId) row.category_id = data.categoryId;

    const { data: inserted, error } = await this.db
      .from('expenses')
      .insert(row)
      .select('id')
      .single();

    if (error) throw error;
    if (!inserted) throw new Error('Failed to add expense');
    return { id: (inserted as any).id };
  }

  async getExpenseCategories(creatorId: string): Promise<any[]> {
    this.logger.info('TaxService.getExpenseCategories', { creatorId });

    const { data, error } = await this.db
      .from('expense_categories')
      .select('*')
      .eq('creator_id', creatorId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async createExpenseCategory(
    creatorId: string,
    data: { name: string; type: string }
  ): Promise<{ id: string }> {
    this.logger.info('TaxService.createExpenseCategory', { creatorId, name: data.name });

    const { data: inserted, error } = await this.db
      .from('expense_categories')
      .insert({ creator_id: creatorId, name: data.name, type: data.type })
      .select('id')
      .single();

    if (error) throw error;
    if (!inserted) throw new Error('Failed to create expense category');
    return { id: (inserted as any).id };
  }

  async exportTaxReport(creatorId: string, year: number, format: 'csv' | 'json'): Promise<string> {
    this.logger.info('TaxService.exportTaxReport', { creatorId, year, format });

    const quarters = await Promise.all(
      ([1, 2, 3, 4] as const).map(async (q) => ({
        quarter: q,
        summary: await this.getQuarterlySummary(creatorId, year, q),
      }))
    );

    const expenses = await this.getExpenses(creatorId, {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });

    if (format === 'json') {
      return JSON.stringify({ year, quarters, expenses }, null, 2);
    }

    // L-5: CSV injection protection — prefix formula-trigger chars with single quote
    const csvCell = (value: string): string => {
      const str = String(value);
      return CSV_FORMULA_CHARS.test(str) ? `'${str}` : str;
    };

    const lines: string[] = [
      'Quarter,Revenue (sats),Expenses (sats),Net (sats),Revenue (USD),Expenses (USD),Net (USD)',
      ...quarters.map(({ quarter, summary }) =>
        `Q${quarter},${summary.revenue},${summary.expenses},${summary.net},` +
        `${summary.usdRevenue},${summary.usdExpenses},${summary.usdNet}`
      ),
      '',
      'Date,Description,Category,Amount (sats),Amount (USD)',
      ...expenses.map((e: any) => {
        const date = csvCell(e.expense_date ?? '');
        const desc = csvCell(e.description ?? '');
        const category = csvCell(e.expense_categories?.name ?? 'Uncategorized');
        return `${date},"${desc}","${category}",${e.amount_sats},${e.usd_at_time ?? ''}`;
      }),
    ];

    return lines.join('\n');
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /** H-5: Returns rate + metadata for provenance recording */
  private async getBtcUsdRate(): Promise<{ rate: number; fetchedAt: string }> {
    const cached = await this.cache.get<{ rate: number; fetchedAt: string }>(BTC_RATE_CACHE_KEY);
    if (cached !== null) return cached;

    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
      );
      const json = (await response.json()) as { bitcoin?: { usd?: number } };
      const rate = json?.bitcoin?.usd;

      if (typeof rate !== 'number' || rate <= 0) {
        throw new Error('Invalid BTC/USD rate from API');
      }

      const fetchedAt = new Date().toISOString();
      const entry = { rate, fetchedAt };
      await this.cache.set(BTC_RATE_CACHE_KEY, entry, BTC_RATE_TTL_ACTIVE);
      // Also persist as stale fallback (never expires via set with no TTL arg)
      await this.cache.set(`${BTC_RATE_CACHE_KEY}:stale`, entry);
      return entry;
    } catch (err) {
      this.logger.error('BTC/USD rate fetch failed, using stale fallback', { err });
      const stale = await this.cache.get<{ rate: number; fetchedAt: string }>(
        `${BTC_RATE_CACHE_KEY}:stale`
      );
      // Return stale with original timestamp so callers know it's not fresh
      return stale ?? { rate: 50000, fetchedAt: new Date(0).toISOString() };
    }
  }

  private quarterDateRange(
    year: number,
    quarter: 1 | 2 | 3 | 4
  ): { startDate: string; endDate: string } {
    const quarterMonths: Record<number, [number, number]> = {
      1: [1, 3],
      2: [4, 6],
      3: [7, 9],
      4: [10, 12],
    };
    const [startMonth, endMonth] = quarterMonths[quarter];
    const lastDay = new Date(year, endMonth, 0).getDate();

    return {
      startDate: `${year}-${String(startMonth).padStart(2, '0')}-01T00:00:00Z`,
      endDate: `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}T23:59:59Z`,
    };
  }
}
