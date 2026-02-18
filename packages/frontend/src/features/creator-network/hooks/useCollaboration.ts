import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '../services/collaborationApi';

export function useCollaborators(contentId: string) {
  return useQuery({
    queryKey: ['creator-network', 'collaborators', contentId],
    queryFn: () => collaborationApi.getCollaborators(contentId),
    select: (res) => res.data?.collaborators ?? [],
    enabled: Boolean(contentId),
    staleTime: 60 * 1000,
  });
}

export function useInviteCollaborators(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collaborators: Array<{ creatorId: string; revenueSplitBps: number }>) =>
      collaborationApi.inviteCollaborators(contentId, { collaborators }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['creator-network', 'collaborators', contentId],
      });
    },
  });
}

export function useUpdateRevenueSplit(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (splits: Array<{ creatorId: string; revenueSplitBps: number }>) =>
      collaborationApi.updateRevenueSplit(contentId, { splits }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['creator-network', 'collaborators', contentId],
      });
    },
  });
}
