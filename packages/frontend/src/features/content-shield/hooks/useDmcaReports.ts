import { useQuery } from '@tanstack/react-query';
import { shieldApi } from '../services/shieldApi';

export function useGetDmcaReports(creatorId: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['shield', 'dmca', 'reports', creatorId, page],
    queryFn: () => shieldApi.getDmcaReports(creatorId, page, limit),
    staleTime: 5 * 60 * 1000,
    enabled: !!creatorId,
  });
}
