import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { circlesApi } from '../services/circlesApi';

export function useCircles() {
  return useQuery({
    queryKey: ['creator-network', 'circles'],
    queryFn: () => circlesApi.getCircles(),
    select: (res) => res.data?.circles ?? [],
    staleTime: 60 * 1000,
  });
}

export function useSuggestedCircles() {
  return useQuery({
    queryKey: ['creator-network', 'circles', 'suggested'],
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
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'circles'] });
    },
    onError: (error) => {
      console.error('Create circle failed:', error);
    },
  });
}

export function useJoinCircle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (circleId: string) => circlesApi.joinCircle(circleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'circles'] });
    },
    onError: (error) => {
      console.error('Join circle failed:', error);
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ circleId, memberId }: { circleId: string; memberId: string }) =>
      circlesApi.removeMember(circleId, memberId),
    onSuccess: (_data, { circleId }) => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'circles', circleId] });
    },
    onError: (error) => {
      console.error('Remove member failed:', error);
    },
  });
}

export function useCirclePosts(circleId: string, page = 1) {
  return useQuery({
    queryKey: ['creator-network', 'circles', circleId, 'posts', page],
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
        queryKey: ['creator-network', 'circles', circleId, 'posts'],
      });
    },
    onError: (error) => {
      console.error('Post to circle failed:', error);
    },
  });
}
