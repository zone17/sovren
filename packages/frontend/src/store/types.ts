import { User, Post, Payment, UserState, PostState, PaymentState } from '../types';

export interface RootState {
  user: UserState;
  post: PostState;
  payment: PaymentState;
}

export type { User, Post, Payment };
