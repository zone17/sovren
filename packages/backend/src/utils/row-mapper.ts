/**
 * Row Mapper — Type-safe Supabase row to domain type conversion
 *
 * Supabase/PostgreSQL returns snake_case rows (user_id, created_at).
 * TypeScript domain types use camelCase (userId, createdAt).
 * This module provides type-safe conversion between the two.
 *
 * Uses the existing snakeToCamel runtime transform with proper generic typing.
 */

import { snakeToCamel } from './case-transform';

/**
 * Convert a single Supabase row (snake_case) to a domain type (camelCase).
 *
 * @example
 * interface InvoiceRow { creator_id: string; total_sats: number; created_at: string }
 * interface Invoice { creatorId: string; totalSats: number; createdAt: string }
 *
 * const row: InvoiceRow = await db.from('invoices').select('*').single();
 * const invoice: Invoice = mapRow<InvoiceRow, Invoice>(row);
 */
export function mapRow<TRow, TDomain>(row: TRow): TDomain {
  return snakeToCamel<TDomain>(row);
}

/**
 * Convert an array of Supabase rows to domain types.
 *
 * @example
 * const rows: InvoiceRow[] = await db.from('invoices').select('*');
 * const invoices: Invoice[] = mapRows<InvoiceRow, Invoice>(rows);
 */
export function mapRows<TRow, TDomain>(rows: TRow[]): TDomain[] {
  return rows.map(row => mapRow<TRow, TDomain>(row));
}

/**
 * Convert a domain object (camelCase) to a Supabase row (snake_case) for inserts/updates.
 *
 * @example
 * const invoice: Partial<Invoice> = { creatorId: 'abc', totalSats: 1000 };
 * const row = toRow<Partial<Invoice>, Partial<InvoiceRow>>(invoice);
 * await db.from('invoices').insert(row);
 */
export { camelToSnake as toRow } from './case-transform';
