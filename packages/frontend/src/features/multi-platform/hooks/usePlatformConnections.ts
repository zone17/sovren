import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { distributionApi } from '../services/distributionApi';

export function usePlatformStatus() {
  return useQuery({
    queryKey: ['distribution', 'platform-status'],
    queryFn: () => distributionApi.getPlatformStatus(),
    select: (res) => res.data,
    staleTime: 60 * 1000,
  });
}

export function useConnectPlatform() {
  return useMutation({
    mutationFn: (platform: string) => distributionApi.connectPlatform(platform),
  });
}

export function useDisconnectPlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (platform: string) => distributionApi.disconnectPlatform(platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution', 'platform-status'] });
    },
  });
}
