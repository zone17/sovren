import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../services/inboxApi';
import type { CreateTemplatePayload, UpdateTemplatePayload } from '../types/inbox';

export function useReplyToMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      inboxApi.replyToMessage(messageId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages'] });
    },
  });
}

export function useBatchInboxAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      message_ids: string[];
      action: 'mark_read' | 'mark_unread' | 'archive';
    }) => inboxApi.batchAction(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages'] });
    },
  });
}

export function useReplyTemplates() {
  return useQuery({
    queryKey: ['inbox', 'templates'],
    queryFn: () => inboxApi.getTemplates(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplatePayload) => inboxApi.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTemplatePayload }) =>
      inboxApi.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inboxApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'templates'] });
    },
  });
}
