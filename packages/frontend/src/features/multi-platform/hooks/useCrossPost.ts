import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { distributionApi } from '../services/distributionApi';
import type { CrossPostStatus, PublishPayload, RepurposePayload } from '../types';

const TERMINAL_STATUSES: ReadonlySet<CrossPostStatus> = new Set([
  'published',
  'failed',
  'cancelled',
]);

export function usePublish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PublishPayload) => distributionApi.publish(data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['distribution', 'publish-status', variables.content_id],
      });
    },
  });
}

export function usePublishStatus(contentId: string) {
  return useQuery({
    queryKey: ['distribution', 'publish-status', contentId],
    queryFn: () => distributionApi.getPublishStatus(contentId),
    select: (res) => res.data,
    enabled: !!contentId,
    refetchInterval: (query) => {
      const entries = query.state.data?.data;
      if (!entries || entries.length === 0) return 10_000;
      const allTerminal = entries.every((entry) => TERMINAL_STATUSES.has(entry.status));
      return allTerminal ? false : 10_000;
    },
  });
}

export function useRepurpose() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RepurposePayload) => distributionApi.repurpose(data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['distribution', 'repurposed', variables.content_id],
      });
    },
  });
}

export function useRepurposed(contentId: string) {
  return useQuery({
    queryKey: ['distribution', 'repurposed', contentId],
    queryFn: () => distributionApi.getRepurposed(contentId),
    select: (res) => res.data,
    enabled: !!contentId,
    staleTime: 30 * 1000,
  });
}

export function useApproveRepurposed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => distributionApi.approveRepurposed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution', 'repurposed'] });
    },
  });
}
