import { useQuery } from '@tanstack/react-query';
import { shieldApi } from '../services/shieldApi';

export function useFingerprintCoverage(creatorId: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['shield', 'fingerprints', creatorId, page],
    queryFn: () => shieldApi.getFingerprintCoverage(creatorId, page, limit),
    staleTime: 5 * 60 * 1000,
    enabled: !!creatorId,
  });
}
