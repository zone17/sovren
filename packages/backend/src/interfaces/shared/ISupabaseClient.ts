/**
 * Shared Supabase Client Interface
 * Consolidates the duplicated SupabaseClient interface from 8 Phase 7 services
 * Todo 157: P2 Duplication Fix
 */

export interface ISupabaseClient {
  from(table: string): any;
  rpc(fn: string, params?: any): any;
}
