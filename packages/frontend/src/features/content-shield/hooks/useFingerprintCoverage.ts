import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { shieldApi } from '../services/shieldApi';
import { shieldKeys } from './shieldKeys';

export function useFingerprintCoverage(creatorId: string, page = 1, limit = 20) {
  const hasInitialData = useRef(false);
  const prevCreatorId = useRef(creatorId);

  // #617: Reset keepPreviousData gate when filter changes to prevent stale data flash
  if (prevCreatorId.current !== creatorId) {
    hasInitialData.current = false;
    prevCreatorId.current = creatorId;
  }

  const query = useQuery({
    queryKey: shieldKeys.fingerprintCoverage(creatorId, page),
    queryFn: () => shieldApi.getFingerprintCoverage(creatorId, page, limit),
    staleTime: 5 * 60 * 1000,
    enabled: !!creatorId,
    placeholderData: hasInitialData.current ? keepPreviousData : undefined,
  });

  if (query.data) {
    hasInitialData.current = true;
  }

  return query;
}
