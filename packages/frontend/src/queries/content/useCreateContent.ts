import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { ContentItemDetail, CreateContentInput } from '@/types/content-query';
import { contentKeys } from './useContent';

/**
 * Create new content
 */
const createContent = async (data: CreateContentInput): Promise<ContentItemDetail> => {
  const response = await fetch('/api/content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create content');
  }

  return response.json();
};

/**
 * Hook to create content with optimistic updates
 */
export const useCreateContent = (
  options?: UseMutationOptions<ContentItemDetail, Error, CreateContentInput>
) => {
  const queryClient = useQueryClient();

  return useMutation<ContentItemDetail, Error, CreateContentInput>({
    mutationFn: createContent,
    onSuccess: (newContent) => {
      // Add to cache immediately
      queryClient.setQueryData(contentKeys.detail(newContent.id), newContent);

      // Invalidate and refetch content lists
      queryClient.invalidateQueries({
        queryKey: contentKeys.lists(),
        refetchType: 'active',
      });

      // If this is content for a specific creator, invalidate their content list
      if (newContent.creatorId) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.list({ creatorId: newContent.creatorId }),
        });
      }
    },
    ...options,
  });
};