// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  nostr_pubkey?: string;
  created_at: string;
  updated_at: string;
}

// Post types
export interface Post {
  id: string;
  title: string;
  content: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  author_id: string;
}

// Payment types
export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  user_id: string;
  post_id: string;
  invoice?: string;
  preimage?: string;
}

// State types
export interface UserState {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
}

export interface PostState {
  posts: Post[];
  currentPost: Post | null;
  loading: boolean;
  error: string | null;
}

export interface PaymentState {
  payments: Payment[];
  currentPayment: Payment | null;
  loading: boolean;
  error: string | null;
}
