import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import type { SignProvenanceBody } from '../services/shieldApi';
import { shieldApi } from '../services/shieldApi';
import { shieldKeys } from './shieldKeys';

export function useSignProvenance() {
  const queryClient = useQueryClient();
  const submitting = useRef(false);

  return useMutation({
    mutationFn: async (data: SignProvenanceBody) => {
      if (submitting.current) return;
      submitting.current = true;
      try {
        return await shieldApi.signProvenance(data);
      } finally {
        submitting.current = false;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: shieldKeys.provenance() });
      queryClient.invalidateQueries({
        queryKey: shieldKeys.provenanceDetail(variables.content_id),
      });
    },
  });
}
