import { useQuery } from '@tanstack/react-query';
import { inboxApi } from '../services/inboxApi';
import type { InboxFilters } from '../types/inbox';

export function useInboxMessages(filters: Partial<InboxFilters>) {
  return useQuery({
    queryKey: ['inbox', 'messages', filters],
    queryFn: () =>
      inboxApi.getMessages({
        platform: filters.platform,
        sentiment: filters.sentiment,
        priority: filters.priority,
        status: filters.status,
        page: filters.page,
        limit: filters.limit,
      }),
    select: (res) => res.data,
    staleTime: 30 * 1000,
  });
}
