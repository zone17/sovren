import { User, Post, Payment } from '@sovren/shared';

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

export interface RootState {
  user: UserState;
  post: PostState;
  payment: PaymentState;
}
