import { authHandlers } from './auth';
import { contentHandlers } from './content';
import { analyticsHandlers } from './analytics';
import { lightningHandlers } from './lightning';
import { wellnessHandlers } from './wellness';
import { subscriptionHandlers } from './subscriptions';
import { platformHandlers } from './platform';
import { supabaseHandlers } from './supabase';

export const handlers = [
  ...authHandlers,
  ...contentHandlers,
  ...analyticsHandlers,
  ...lightningHandlers,
  ...wellnessHandlers,
  ...subscriptionHandlers,
  ...platformHandlers,
  ...supabaseHandlers,
];
