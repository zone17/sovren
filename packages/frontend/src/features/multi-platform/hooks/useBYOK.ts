import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../services/inboxApi';
import type { BYOKSubmitPayload, BYOKStatus } from '../types/inbox';

export function useBYOKStatus() {
  return useQuery({
    queryKey: ['byok', 'twitter', 'status'],
    queryFn: () => inboxApi.validateBYOK(),
    select: (res) => res.data,
    staleTime: 10 * 60 * 1000,
  });
}

export function useBYOK() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<BYOKStatus>('idle');

  const submitMutation = useMutation({
    mutationFn: (data: BYOKSubmitPayload) => inboxApi.submitBYOK(data),
    onMutate: () => {
      setStatus('validating');
    },
    onSuccess: (res) => {
      const result = res.data;
      if (result.valid) {
        setStatus('valid');
      } else if (result.write_only) {
        setStatus('write_only');
      } else {
        setStatus('invalid');
      }
      queryClient.invalidateQueries({ queryKey: ['byok', 'twitter'] });
    },
    onError: () => {
      setStatus('invalid');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => inboxApi.revokeBYOK(),
    onSuccess: () => {
      setStatus('idle');
      queryClient.invalidateQueries({ queryKey: ['byok', 'twitter'] });
    },
  });

  return {
    status,
    validationResult: submitMutation.data?.data,
    isPending: submitMutation.isPending,
    isRevoking: revokeMutation.isPending,
    submit: (data: BYOKSubmitPayload) => submitMutation.mutate(data),
    revoke: () => revokeMutation.mutate(),
    reset: () => setStatus('idle'),
  };
}
