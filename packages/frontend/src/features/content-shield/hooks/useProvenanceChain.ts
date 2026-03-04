import { useQuery } from '@tanstack/react-query';
import { shieldApi } from '../services/shieldApi';
import { shieldKeys } from './shieldKeys';

export function useProvenanceChain(contentId: string) {
  return useQuery({
    queryKey: shieldKeys.provenanceDetail(contentId),
    queryFn: () => shieldApi.getProvenance(contentId),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
    enabled: !!contentId,
  });
}
