/**
 * Follow hooks
 * Slice 8: Creator Network + Notifications
 */

import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { followApi } from '../services/followApi';
import { followKeys } from '@/hooks/query-keys';

export function useIsFollowing(userId: string) {
  return useQuery({
    queryKey: followKeys.isFollowing(userId),
    queryFn: () => followApi.isFollowing(userId),
    select: (res) => res.following,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });
}

export function useFollowCounts(userId: string) {
  return useQuery({
    queryKey: followKeys.counts(userId),
    queryFn: () => followApi.getFollowCounts(userId),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });
}

export function useFollowers(userId: string, page = 1) {
  return useQuery({
    queryKey: followKeys.followers(userId, page),
    queryFn: () => followApi.getFollowers(userId, { page, limit: 20 }),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });
}

export function useFollowing(userId: string, page = 1) {
  return useQuery({
    queryKey: followKeys.following(userId, page),
    queryFn: () => followApi.getFollowing(userId, { page, limit: 20 }),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });
}

export function useFollowMutation(userId: string) {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  return useMutation({
    mutationFn: () => {
      if (inFlightRef.current) return Promise.reject(new Error('Already in progress'));
      inFlightRef.current = true;
      return followApi.follow(userId);
    },
    onMutate: async () => {
      // Optimistic update: set isFollowing to true
      await queryClient.cancelQueries({ queryKey: followKeys.isFollowing(userId) });
      const previousIsFollowing = queryClient.getQueryData<{ following: boolean }>(
        followKeys.isFollowing(userId)
      );
      queryClient.setQueryData(followKeys.isFollowing(userId), { following: true });

      // Optimistic update: increment follower count
      const previousCounts = queryClient.getQueryData<{ followers: number; following: number }>(
        followKeys.counts(userId)
      );
      if (previousCounts) {
        queryClient.setQueryData(followKeys.counts(userId), {
          ...previousCounts,
          followers: previousCounts.followers + 1,
        });
      }

      return { previousIsFollowing, previousCounts };
    },
    onError: (_err, _vars, context) => {
      // Rollback both status AND counts cache (RC-2)
      if (context?.previousIsFollowing !== undefined) {
        queryClient.setQueryData(followKeys.isFollowing(userId), context.previousIsFollowing);
      }
      if (context?.previousCounts !== undefined) {
        queryClient.setQueryData(followKeys.counts(userId), context.previousCounts);
      }
      toast.error('Failed to follow. Please try again.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: followKeys.followers(userId) });
      queryClient.invalidateQueries({ queryKey: followKeys.counts(userId) });
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });
}

export function useUnfollowMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      // Status guard: only unfollow if currently following
      const isFollowing = queryClient.getQueryData<{ following: boolean }>(
        followKeys.isFollowing(userId)
      );
      if (isFollowing?.following === false) {
        return Promise.resolve();
      }
      return followApi.unfollow(userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: followKeys.isFollowing(userId) });
      const previousIsFollowing = queryClient.getQueryData<{ following: boolean }>(
        followKeys.isFollowing(userId)
      );
      queryClient.setQueryData(followKeys.isFollowing(userId), { following: false });

      const previousCounts = queryClient.getQueryData<{ followers: number; following: number }>(
        followKeys.counts(userId)
      );
      if (previousCounts) {
        queryClient.setQueryData(followKeys.counts(userId), {
          ...previousCounts,
          followers: Math.max(0, previousCounts.followers - 1),
        });
      }

      return { previousIsFollowing, previousCounts };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousIsFollowing !== undefined) {
        queryClient.setQueryData(followKeys.isFollowing(userId), context.previousIsFollowing);
      }
      if (context?.previousCounts !== undefined) {
        queryClient.setQueryData(followKeys.counts(userId), context.previousCounts);
      }
      toast.error('Failed to unfollow. Please try again.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: followKeys.followers(userId) });
      queryClient.invalidateQueries({ queryKey: followKeys.counts(userId) });
    },
  });
}
