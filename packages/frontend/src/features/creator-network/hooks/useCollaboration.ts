import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collaborationApi } from '../services/collaborationApi';
import type { ApiResponse } from '../types/community';
import type { ContentCollaborator } from '@shared/types/community';

export const collaboratorKeys = {
  all: ['creator-network', 'collaborators'] as const,
  detail: (contentId: string) => [...collaboratorKeys.all, contentId] as const,
};

export function useCollaborators(contentId: string) {
  return useQuery({
    queryKey: collaboratorKeys.detail(contentId),
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
      const results = await Promise.allSettled(
        collaborators.map((c) =>
          collaborationApi.inviteCollaborator(contentId, c.creatorId, c.revenueSplitBps)
        )
      );
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failures.length > 0) {
        console.error(`${failures.length}/${results.length} invites failed`);
        if (failures.length === results.length) {
          throw new Error('All invites failed');
        }
      }
      return results
        .filter(
          (r): r is PromiseFulfilledResult<ApiResponse<ContentCollaborator>> =>
            r.status === 'fulfilled'
        )
        .map((r) => r.value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: collaboratorKeys.detail(contentId),
      });
    },
    onError: (error) => {
      console.error('Invite collaborators failed:', error);
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
        queryKey: collaboratorKeys.detail(contentId),
      });
    },
    onError: (error) => {
      console.error('Update revenue split failed:', error);
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
      // Invalidates all collaborator queries — contentId unknown from invitation response
      queryClient.invalidateQueries({ queryKey: [...collaboratorKeys.all] });
    },
    onError: (error) => {
      console.error('Respond to collaboration failed:', error);
    },
  });
}
