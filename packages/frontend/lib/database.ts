import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase client for server-side operations
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database types (you can generate these from Supabase CLI later)
export interface User {
  id: string;
  email: string;
  name?: string;
  nostr_pubkey?: string;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  author_id: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  post_id: string;
  invoice?: string;
  preimage?: string;
}

export interface FeatureFlag {
  id: string;
  key: string;
  value: boolean;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
