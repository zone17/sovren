import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { distributionApi } from '../services/distributionApi';
import type { BatchActionPayload, ReplyPayload } from '../types';

export function useInboxMessages(params: {
  platform?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['distribution', 'inbox', params],
    queryFn: () => distributionApi.getInboxMessages(params),
    select: (res) => res.data,
    staleTime: 30 * 1000,
  });
}

export function useReplyToMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, data }: { messageId: string; data: ReplyPayload }) =>
      distributionApi.replyToMessage(messageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution', 'inbox'] });
    },
  });
}

export function useBatchAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BatchActionPayload) => distributionApi.batchAction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution', 'inbox'] });
    },
  });
}
