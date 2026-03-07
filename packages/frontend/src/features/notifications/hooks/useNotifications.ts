/**
 * Server notification hooks
 * Slice 8: Creator Network + Notifications
 *
 * RC-1: StrictMode double-subscribe — cleanup via supabase.removeChannel()
 * RC-3: Use invalidateQueries for Realtime INSERT (not setQueryData + prev + 1)
 * RC-4: markAllRead sends { before: new Date().toISOString() }
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { notificationsApi } from '../services/notificationsApi';
import { notificationKeys } from '@/hooks/query-keys';
import { supabase } from '@/services/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const LIMIT = 20;

export function useServerNotifications(page = 1) {
  return useQuery({
    queryKey: notificationKeys.list(page),
    queryFn: () => notificationsApi.list({ page, limit: LIMIT }),
    staleTime: 30 * 1000,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...notificationKeys.all, 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    select: (res) => res.count,
    staleTime: 30 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (err: Error & { status?: number }) => {
      // RC-4: On 409, invalidate to refresh stale data
      if (err.status === 409) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        return;
      }
      toast.error('Failed to mark notification as read.');
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    // RC-4: Send before timestamp to prevent race where new notification arrives
    // between button click and DB update
    mutationFn: () => notificationsApi.markAllRead(new Date().toISOString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: () => {
      toast.error('Failed to mark all notifications as read.');
    },
  });
}

/** UUID v4 format check — prevents subscribing with malformed user IDs */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Subscribe to realtime notification inserts for the current user.
 *
 * RC-1 fix: uses supabase.removeChannel(channel) in cleanup — safe for StrictMode double-invoke.
 * RC-3 fix: on INSERT, invalidateQueries rather than incrementing count directly.
 * #737 fix: invalidate on SUBSCRIBED (reconnect) not CLOSED (disconnect).
 * #743 fix: validate userId is a non-empty string (UUID) before subscribing.
 */
export function useNotificationRealtime(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // #743: Guard — must be a non-empty string with valid UUID format
    if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) return;

    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // RC-3: invalidateQueries — do NOT increment count manually to avoid stale state
          queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        }
      )
      .subscribe((status) => {
        // #737: Backfill missed notifications when the channel reconnects (SUBSCRIBED),
        // not when it closes (CLOSED). CLOSED fires on disconnect — no point fetching then.
        if (status === 'SUBSCRIBED') {
          queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        }
      });

    return () => {
      // RC-1: removeChannel is safe to call even if subscription is in-flight
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, queryClient]);
}

// #752: Delete a single notification
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: () => {
      toast.error('Failed to delete notification.');
    },
  });
}
