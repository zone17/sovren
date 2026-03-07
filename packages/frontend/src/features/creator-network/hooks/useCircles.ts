import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { circleKeys } from '@/hooks/query-keys';
import { circlesApi } from '../services/circlesApi';

export { circleKeys };

export function useCircles() {
  return useQuery({
    queryKey: circleKeys.lists(),
    queryFn: () => circlesApi.getCircles(),
    select: (res) => res.data?.circles ?? [],
    staleTime: 60 * 1000,
  });
}

export function useSuggestedCircles() {
  return useQuery({
    queryKey: circleKeys.suggested(),
    queryFn: () => circlesApi.getSuggestedCircles(),
    select: (res) => res.data?.circles ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCircle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: circlesApi.createCircle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circleKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create circle. Please try again.');
    },
  });
}

export function useJoinCircle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (circleId: string) => circlesApi.joinCircle(circleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circleKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to join circle. Please try again.');
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ circleId, memberId }: { circleId: string; memberId: string }) =>
      circlesApi.removeMember(circleId, memberId),
    onSuccess: (_data, { circleId }) => {
      queryClient.invalidateQueries({ queryKey: circleKeys.detail(circleId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member. Please try again.');
    },
  });
}

export function useLeaveCircle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (circleId: string) => circlesApi.leaveCircle(circleId),
    onSuccess: (_data, circleId) => {
      queryClient.invalidateQueries({ queryKey: circleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: circleKeys.detail(circleId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to leave circle. Please try again.');
    },
  });
}

export function useCirclePosts(circleId: string, page = 1) {
  return useQuery({
    queryKey: [...circleKeys.posts(circleId), page],
    queryFn: () => circlesApi.getCirclePosts(circleId, { page, limit: 20 }),
    select: (res) => res.data,
    enabled: Boolean(circleId),
    staleTime: 30 * 1000,
  });
}

export function usePostToCircle(circleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => circlesApi.postToCircle(circleId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: circleKeys.posts(circleId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to post to circle. Please try again.');
    },
  });
}
