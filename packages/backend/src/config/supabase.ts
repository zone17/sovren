/**
 * Re-exports the singleton Supabase client for services that import from config/supabase.
 * The actual client is managed by config/database.ts via SupabaseDatabase.
 */
import { getDatabase } from './database';

export const supabase = getDatabase().client;
