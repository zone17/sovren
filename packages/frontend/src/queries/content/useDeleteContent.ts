import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { contentKeys } from './useContent';

/**
 * Delete content
 */
const deleteContent = async (contentId: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`/api/content/${contentId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete content');
  }

  return response.json();
};

/**
 * Hook to delete content with cache cleanup
 */
export const useDeleteContent = (
  options?: UseMutationOptions<{ success: boolean; message: string }, Error, string>
) => {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error, string>({
    mutationFn: deleteContent,
    onSuccess: (_, contentId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: contentKeys.detail(contentId) });

      // Invalidate all content lists to ensure they're refreshed
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    },
    ...options,
  });
};