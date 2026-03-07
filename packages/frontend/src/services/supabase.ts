/**
 * Supabase client — frontend singleton (lazy-initialized).
 * Used for Realtime subscriptions only; all DB queries go through backend API.
 *
 * Lazy initialization avoids throwing at module load when env vars are missing
 * (e.g., during SSR, tests, or build-time imports).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
  }

  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

/**
 * Lazy-initialized Supabase client.
 * Throws on first property access if env vars are missing, not on import.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
