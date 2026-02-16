import { useQuery } from '@tanstack/react-query';
import { shieldApi } from '../services/shieldApi';

export function useGetProvenanceVerification(contentId: string) {
  return useQuery({
    queryKey: ['shield', 'provenance', 'verify', contentId],
    queryFn: () => shieldApi.getProvenanceVerification(contentId),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
    enabled: !!contentId,
  });
}
