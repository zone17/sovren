import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { creatorsKeys } from './useCreators';

/**
 * Delete creator profile
 */
const deleteCreator = async (creatorId: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`/api/creators/${creatorId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete creator');
  }

  return response.json();
};

/**
 * Hook to delete creator with cache cleanup
 */
export const useDeleteCreator = (
  options?: UseMutationOptions<{ success: boolean; message: string }, Error, string>
) => {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error, string>({
    mutationFn: deleteCreator,
    onSuccess: (_, creatorId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: creatorsKeys.detail(creatorId) });

      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: creatorsKeys.lists() });
    },
    ...options,
  });
};
