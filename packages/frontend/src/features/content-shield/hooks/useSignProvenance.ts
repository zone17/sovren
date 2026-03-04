import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SignProvenanceBody } from '../types';
import { shieldApi } from '../services/shieldApi';
import { shieldKeys } from './shieldKeys';

export function useSignProvenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SignProvenanceBody) => shieldApi.signProvenance(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: shieldKeys.provenance() });
      queryClient.invalidateQueries({
        queryKey: shieldKeys.provenanceDetail(variables.content_id),
      });
    },
  });
}
