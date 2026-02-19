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

/**
 * #312: Backend expects flat shape per collaborator (not array).
 * Sends one POST per collaborator sequentially.
 */
export function useInviteCollaborators(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (collaborators: Array<{ creatorId: string; revenueSplitBps: number }>) => {
      const results = [];
      for (const c of collaborators) {
        const result = await collaborationApi.inviteCollaborator(
          contentId,
          c.creatorId,
          c.revenueSplitBps
        );
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['creator-network', 'collaborators', contentId],
      });
    },
  });
}

/** #311: Backend expects { splits: [{ creatorId, bps }] }, not revenueSplitBps */
export function useUpdateRevenueSplit(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (splits: Array<{ creatorId: string; revenueSplitBps: number }>) =>
      collaborationApi.updateRevenueSplit(contentId, {
        splits: splits.map((s) => ({ creatorId: s.creatorId, bps: s.revenueSplitBps })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['creator-network', 'collaborators', contentId],
      });
    },
  });
}

/** #313: Hook for responding to collaboration invitations */
export function useRespondToCollaboration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invitationId, accept }: { invitationId: string; accept: boolean }) =>
      collaborationApi.respondToInvitation(invitationId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'collaborators'] });
    },
  });
}
