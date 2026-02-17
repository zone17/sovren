/**
 * Shared Supabase Client Interface
 * Consolidates the duplicated SupabaseClient interface from 8 Phase 7 services
 * Todo 157: P2 Duplication Fix
 * Todo 216: P3 Type Safety — replaced `any` returns with typed query builder
 */

/** Standard Supabase response shape */
export interface SupabaseResponse<T = Record<string, unknown>> {
  data: T | null;
  error: SupabaseError | null;
  count?: number | null;
}

export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/** Chainable query builder matching Supabase's PostgREST interface */
export interface SupabaseQueryBuilder<T = Record<string, unknown>> {
  // Data operations — each returns a filterable builder
  select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): SupabaseFilterBuilder<T>;
  insert(values: Partial<T> | Partial<T>[], options?: { onConflict?: string }): SupabaseFilterBuilder<T>;
  update(values: Partial<T>): SupabaseFilterBuilder<T>;
  delete(): SupabaseFilterBuilder<T>;
  upsert(values: Partial<T> | Partial<T>[], options?: { onConflict?: string }): SupabaseFilterBuilder<T>;
}

/** Filter/modifier builder that resolves to a SupabaseResponse via PromiseLike */
export interface SupabaseFilterBuilder<T = Record<string, unknown>> extends PromiseLike<SupabaseResponse<T[]>> {
  // Filters
  eq(column: string, value: unknown): SupabaseFilterBuilder<T>;
  neq(column: string, value: unknown): SupabaseFilterBuilder<T>;
  gt(column: string, value: unknown): SupabaseFilterBuilder<T>;
  gte(column: string, value: unknown): SupabaseFilterBuilder<T>;
  lt(column: string, value: unknown): SupabaseFilterBuilder<T>;
  lte(column: string, value: unknown): SupabaseFilterBuilder<T>;
  like(column: string, pattern: string): SupabaseFilterBuilder<T>;
  ilike(column: string, pattern: string): SupabaseFilterBuilder<T>;
  is(column: string, value: null | boolean): SupabaseFilterBuilder<T>;
  in(column: string, values: unknown[]): SupabaseFilterBuilder<T>;
  contains(column: string, value: unknown): SupabaseFilterBuilder<T>;
  containedBy(column: string, value: unknown): SupabaseFilterBuilder<T>;
  not(column: string, operator: string, value: unknown): SupabaseFilterBuilder<T>;
  or(filters: string, options?: { foreignTable?: string }): SupabaseFilterBuilder<T>;
  filter(column: string, operator: string, value: unknown): SupabaseFilterBuilder<T>;

  // Modifiers
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): SupabaseFilterBuilder<T>;
  limit(count: number): SupabaseFilterBuilder<T>;
  range(from: number, to: number): SupabaseFilterBuilder<T>;
  single(): PromiseLike<SupabaseResponse<T>>;
  maybeSingle(): PromiseLike<SupabaseResponse<T | null>>;

  // Result access
  select(columns?: string): SupabaseFilterBuilder<T>;
}

export interface ISupabaseClient {
  from<T = Record<string, unknown>>(table: string): SupabaseQueryBuilder<T>;
  rpc<T = unknown>(fn: string, params?: Record<string, unknown>): PromiseLike<SupabaseResponse<T>>;
}
