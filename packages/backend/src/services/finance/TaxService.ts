// @ts-nocheck
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
import type { Expense, ExpenseCategory, QuarterlyTaxSummary } from '@shared/types/finance';
import { getBtcUsdRate, RATE_SOURCE } from '../../utils/btc-rate';
import { NotFoundError } from '../../utils/errors';

// L-5: Characters that trigger formula execution in spreadsheet apps
// #271: Added \t and \r to prevent tab/CR-based injection
const CSV_FORMULA_CHARS = /^[=+\-@\t\r]/;

// #323: Row type interfaces for typed .from<T>() calls
interface RevenueEntryRow {
  id: string;
  creator_id: string;
  source: string;
  amount_sats: number;
  usd_at_time: number | null;
  rate_source: string | null;
  rate_timestamp: string | null;
  recorded_at: string;
}

interface ExpenseRow {
  id: string;
  creator_id: string;
  category_id: string | null;
  description: string;
  amount_sats: number;
  usd_at_time: number | null;
  rate_source: string | null;
  rate_timestamp: string | null;
  expense_date: string;
  created_at: string;
}

// ExpenseCategoryRow schema: { id, creator_id, name, type } — documented in schema.sql

// #659: Typed row interface for getExpensesForExport — replaces any[]
interface ExportExpenseRow {
  id: string;
  creator_id: string;
  category_id: string | null;
  description: string;
  amount_sats: number;
  usd_at_time: number | null;
  expense_date: string;
  created_at: string;
  expense_categories: { name: string; type: string } | null;
}

// #667: Safety cap to prevent OOM on creators with very large expense histories
const MAX_EXPORT_ROWS = 50_000;

export class TaxService implements ITaxService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly cache: ICacheService,
    private readonly logger: ILogger
  ) {}

  async getQuarterlySummary(
    creatorId: string,
    year: number,
    quarter: 1 | 2 | 3 | 4,
    options?: {
      /** #659: Pre-fetched BTC/USD rate to avoid redundant API calls in batch contexts */
      prefetchedRate?: number;
      /** #659: Pre-fetched expenses for this quarter (avoids redundant DB queries in export) */
      prefetchedExpenses?: ExportExpenseRow[];
    }
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

    // #365: Paginated accumulation to prevent OOM on large datasets.
    // Instead of loading all rows into memory, fetch in bounded pages and
    // accumulate totals incrementally. Each page is GC-eligible after processing.
    const PAGE_SIZE = 500;

    // Use recorded usd_at_time (captured at receipt) where available.
    // Fall back to live rate for entries missing USD values — 5-min TTL.
    // #659: Accept pre-fetched rate to avoid redundant API calls in export context
    const btcRateUsd =
      options?.prefetchedRate ?? (await getBtcUsdRate(this.cache, this.logger)).rate;

    // Accumulate revenue totals via pagination
    let totalRevenueSats = 0;
    let usdRevenue = 0;
    let revenueOffset = 0;
    let hasMoreRevenue = true;

    while (hasMoreRevenue) {
      const { data: revPage, error: revenueError } = await this.db
        .from<RevenueEntryRow>('revenue_entries')
        .select('amount_sats, usd_at_time')
        .eq('creator_id', creatorId)
        .gte('recorded_at', startDate)
        .lte('recorded_at', endDate)
        .order('recorded_at', { ascending: true })
        .range(revenueOffset, revenueOffset + PAGE_SIZE - 1);

      if (revenueError) {
        this.logger.error('Failed to fetch quarterly revenue', {
          error: revenueError,
          creatorId,
          year,
          quarter,
        });
        throw new Error('Failed to fetch quarterly revenue');
      }

      const rows = revPage ?? [];
      for (const r of rows) {
        totalRevenueSats += r.amount_sats;
        usdRevenue +=
          r.usd_at_time !== null ? r.usd_at_time : (r.amount_sats / 100_000_000) * btcRateUsd;
      }

      hasMoreRevenue = rows.length === PAGE_SIZE;
      revenueOffset += PAGE_SIZE;
    }

    // Accumulate expense totals — use pre-fetched data when available (#659),
    // otherwise paginate from DB
    let totalExpenseSats = 0;
    let usdExpenses = 0;

    if (options?.prefetchedExpenses) {
      // #659: Use in-memory pre-fetched expenses filtered by quarter date range
      const startDateStr = startDate.split('T')[0];
      const endDateStr = endDate.split('T')[0];
      for (const e of options.prefetchedExpenses) {
        if (e.expense_date >= startDateStr && e.expense_date <= endDateStr) {
          totalExpenseSats += e.amount_sats;
          usdExpenses +=
            e.usd_at_time !== null ? e.usd_at_time : (e.amount_sats / 100_000_000) * btcRateUsd;
        }
      }
    } else {
      let expenseOffset = 0;
      let hasMoreExpenses = true;

      while (hasMoreExpenses) {
        const { data: expPage, error: expenseError } = await this.db
          .from('expenses')
          .select('amount_sats, usd_at_time')
          .eq('creator_id', creatorId)
          .gte('expense_date', startDate.split('T')[0])
          .lte('expense_date', endDate.split('T')[0])
          .order('expense_date', { ascending: true })
          .range(expenseOffset, expenseOffset + PAGE_SIZE - 1);

        if (expenseError) {
          this.logger.error('Failed to fetch quarterly expenses', {
            error: expenseError,
            creatorId,
            year,
            quarter,
          });
          throw new Error('Failed to fetch quarterly expenses');
        }

        const rows = expPage ?? [];
        for (const e of rows) {
          totalExpenseSats += e.amount_sats;
          usdExpenses +=
            e.usd_at_time !== null ? e.usd_at_time : (e.amount_sats / 100_000_000) * btcRateUsd;
        }

        hasMoreExpenses = rows.length === PAGE_SIZE;
        expenseOffset += PAGE_SIZE;
      }
    }

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
  ): Promise<Expense[]> {
    this.logger.info('TaxService.getExpenses', { creatorId, filters });

    // #322: Add limit to prevent unbounded result sets
    // #669: Shared query builder eliminates duplication with getExpensesForExport
    const { data, error } = await this.buildExpenseQuery(creatorId, filters).limit(100);
    if (error) {
      this.logger.error('Failed to fetch expenses', { error, creatorId });
      throw new Error('Failed to fetch expenses');
    }
    return data ?? [];
  }

  /**
   * #660: Server-side paginated expense query with exact count.
   * Returns items for the requested page and total row count for pagination metadata.
   */
  async getExpensesPaginated(
    creatorId: string,
    params: {
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      limit: number;
      offset: number;
    }
  ): Promise<{ items: Expense[]; count: number }> {
    this.logger.info('TaxService.getExpensesPaginated', {
      creatorId,
      limit: params.limit,
      offset: params.offset,
    });

    const { categoryId, startDate, endDate, limit, offset } = params;

    let query = this.db
      .from('expenses')
      .select(
        'id, creator_id, category_id, description, amount_sats, usd_at_time, expense_date, created_at, expense_categories(name, type)',
        { count: 'exact' }
      )
      .eq('creator_id', creatorId);

    if (categoryId) query = query.eq('category_id', categoryId);
    if (startDate) query = query.gte('expense_date', startDate);
    if (endDate) query = query.lte('expense_date', endDate);

    const { data, error, count } = await query
      .order('expense_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to fetch paginated expenses', { error, creatorId });
      throw new Error('Failed to fetch paginated expenses');
    }
    return { items: data ?? [], count: count ?? 0 };
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
    const { rate: btcRateUsd, fetchedAt } = await getBtcUsdRate(this.cache, this.logger);
    const usdAtTime = (data.amountSats / 100_000_000) * btcRateUsd;

    const row: Partial<ExpenseRow> = {
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

    if (error) {
      this.logger.error('Failed to add expense', { error, creatorId });
      throw new Error('Failed to add expense');
    }
    if (!inserted) throw new Error('Failed to add expense');
    return { id: inserted.id };
  }

  async getExpenseCategories(creatorId: string): Promise<ExpenseCategory[]> {
    this.logger.info('TaxService.getExpenseCategories', { creatorId });

    const { data, error } = await this.db
      .from('expense_categories')
      .select('id, creator_id, name, type')
      .eq('creator_id', creatorId)
      .order('name', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch expense categories', { error, creatorId });
      throw new Error('Failed to fetch expense categories');
    }
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

    if (error) {
      this.logger.error('Failed to create expense category', { error, creatorId });
      throw new Error('Failed to create expense category');
    }
    if (!inserted) throw new Error('Failed to create expense category');
    return { id: inserted.id };
  }

  async exportTaxReport(creatorId: string, year: number, format: 'csv' | 'json'): Promise<string> {
    this.logger.info('TaxService.exportTaxReport', { creatorId, year, format });

    // #659: Fetch BTC/USD rate ONCE for the entire report to avoid 4 redundant API calls
    // #679: Single rate fetch ensures consistent USD conversion across all quarters
    const { rate: btcRateUsd } = await getBtcUsdRate(this.cache, this.logger);

    // #659: Fetch all expenses ONCE, then filter by quarter in-memory
    const expenses = await this.getExpensesForExport(creatorId, {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });

    const quarters = await Promise.all(
      ([1, 2, 3, 4] as const).map(async q => ({
        quarter: q,
        summary: await this.getQuarterlySummary(creatorId, year, q, {
          prefetchedRate: btcRateUsd,
          prefetchedExpenses: expenses,
        }),
      }))
    );

    // Annual totals
    const annual = quarters.reduce(
      (acc, { summary }) => ({
        revenue: acc.revenue + summary.revenue,
        expenses: acc.expenses + summary.expenses,
        net: acc.net + summary.net,
        usdRevenue: acc.usdRevenue + summary.usdRevenue,
        usdExpenses: acc.usdExpenses + summary.usdExpenses,
        usdNet: acc.usdNet + summary.usdNet,
      }),
      { revenue: 0, expenses: 0, net: 0, usdRevenue: 0, usdExpenses: 0, usdNet: 0 }
    );
    annual.usdRevenue = Math.round(annual.usdRevenue * 100) / 100;
    annual.usdExpenses = Math.round(annual.usdExpenses * 100) / 100;
    annual.usdNet = Math.round(annual.usdNet * 100) / 100;

    if (format === 'json') {
      return JSON.stringify({ year, quarters, annual, expenses }, null, 2);
    }

    // L-5: CSV injection protection — prefix formula-trigger chars with single quote
    const csvCell = (value: string): string => {
      // #271: Strip embedded tab/CR chars and prefix formula-trigger chars
      let str = String(value).replace(/[\t\r]/g, ' ');
      if (CSV_FORMULA_CHARS.test(str)) str = `'${str}`;
      // #346: Escape double quotes per RFC 4180 to prevent quote-breakout injection
      return str.replace(/"/g, '""');
    };

    const lines: string[] = [
      'Quarter,Revenue (sats),Expenses (sats),Net (sats),Revenue (USD),Expenses (USD),Net (USD)',
      ...quarters.map(
        ({ quarter, summary }) =>
          `Q${quarter},${summary.revenue},${summary.expenses},${summary.net},` +
          `${summary.usdRevenue},${summary.usdExpenses},${summary.usdNet}`
      ),
      `Annual,${annual.revenue},${annual.expenses},${annual.net},` +
        `${annual.usdRevenue},${annual.usdExpenses},${annual.usdNet}`,
      '',
      'Date,Description,Category,Amount (sats),Amount (USD)',
      ...expenses.map((e: ExportExpenseRow) => {
        const date = csvCell(e.expense_date ?? '');
        const desc = csvCell(e.description ?? '');
        const category = csvCell(e.expense_categories?.name ?? 'Uncategorized');
        return `${date},"${desc}","${category}",${e.amount_sats},${e.usd_at_time ?? ''}`;
      }),
    ];

    return lines.join('\n');
  }

  async getAnnualSummary(creatorId: string, year: number): Promise<QuarterlyTaxSummary[]> {
    this.logger.info('TaxService.getAnnualSummary', { creatorId, year });

    const quarters = [1, 2, 3, 4] as const;
    const results = await Promise.all(
      quarters.map(q => this.getQuarterlySummary(creatorId, year, q))
    );
    return results.map((r, i) => ({
      year,
      quarter: `Q${quarters[i]}`,
      totalIncomeSats: r.revenue,
      totalIncomeUsd: r.usdRevenue,
      totalExpensesSats: r.expenses,
      totalExpensesUsd: r.usdExpenses,
      netSats: r.net,
      netUsd: r.usdNet,
    }));
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Shared query builder for expense queries.
   * #669: Extracted to eliminate duplication between getExpenses and getExpensesForExport.
   * Callers append .limit() (getExpenses) or .range() (getExpensesForExport).
   */
  private buildExpenseQuery(
    creatorId: string,
    filters?: { categoryId?: string; startDate?: string; endDate?: string }
  ) {
    let query = this.db
      .from('expenses')
      .select(
        'id, creator_id, category_id, description, amount_sats, usd_at_time, expense_date, created_at, expense_categories(name, type)'
      )
      .eq('creator_id', creatorId);

    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters?.startDate) query = query.gte('expense_date', filters.startDate);
    if (filters?.endDate) query = query.lte('expense_date', filters.endDate);

    return query.order('expense_date', { ascending: false });
  }

  /**
   * Paginated expense fetch for export — no .limit(100) cap.
   * Uses PAGE_SIZE=500 to prevent OOM on large datasets.
   * #659: Typed return (ExportExpenseRow[]) — replaces any[]
   * #667: Hard cap at MAX_EXPORT_ROWS to prevent OOM on very large histories
   * #669: Uses buildExpenseQuery to eliminate duplication with getExpenses
   */
  private async getExpensesForExport(
    creatorId: string,
    filters: { startDate: string; endDate: string }
  ): Promise<ExportExpenseRow[]> {
    const PAGE_SIZE = 500;
    const all: ExportExpenseRow[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.buildExpenseQuery(creatorId, filters).range(
        offset,
        offset + PAGE_SIZE - 1
      );

      if (error) {
        this.logger.error('Failed to fetch expenses for export', { error, creatorId });
        throw new Error('Failed to fetch expenses for export');
      }

      const rows = (data ?? []) as ExportExpenseRow[];

      // #667: Check cap BEFORE pushing to prevent overshoot beyond MAX_EXPORT_ROWS
      if (all.length + rows.length > MAX_EXPORT_ROWS) {
        const remaining = MAX_EXPORT_ROWS - all.length;
        all.push(...rows.slice(0, remaining));
        this.logger.warn('Export row limit reached', { creatorId, limit: MAX_EXPORT_ROWS });
        break;
      }
      all.push(...rows);

      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    return all;
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

  async deleteExpense(expenseId: string, creatorId: string): Promise<void> {
    this.logger.info('TaxService.deleteExpense', { expenseId, creatorId });

    // #657: Use { count: 'exact' } to detect no-op deletes (nonexistent or wrong owner)
    const { error, count } = await this.db
      .from('expenses')
      .delete({ count: 'exact' })
      .eq('id', expenseId)
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to delete expense', { error, expenseId, creatorId });
      throw new Error('Failed to delete expense');
    }
    if (count === 0) {
      throw new NotFoundError('Expense');
    }
  }

  async deleteExpenseCategory(categoryId: string, creatorId: string): Promise<void> {
    this.logger.info('TaxService.deleteExpenseCategory', { categoryId, creatorId });

    // #657: Use { count: 'exact' } to detect no-op deletes
    const { error, count } = await this.db
      .from('expense_categories')
      .delete({ count: 'exact' })
      .eq('id', categoryId)
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to delete expense category', { error, categoryId, creatorId });
      throw new Error('Failed to delete expense category');
    }
    if (count === 0) {
      throw new NotFoundError('Category');
    }
  }
}
