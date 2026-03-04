import { authHandlers } from './auth';
import { contentHandlers } from './content';
import { analyticsHandlers } from './analytics';
import { discoveryHandlers } from './discovery';
import { lightningHandlers } from './lightning';
import { wellnessHandlers } from './wellness';
import { subscriptionHandlers } from './subscriptions';
import { platformHandlers } from './platform';
import { supabaseHandlers } from './supabase';

export const handlers = [
  ...authHandlers,
  ...contentHandlers,
  ...analyticsHandlers,
  ...discoveryHandlers,
  ...lightningHandlers,
  ...wellnessHandlers,
  ...subscriptionHandlers,
  ...platformHandlers,
  ...supabaseHandlers,
];
