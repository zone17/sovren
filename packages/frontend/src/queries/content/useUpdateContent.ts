import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { ContentItemDetail, UpdateContentInput } from '@/types/content-query';
import { contentKeys } from './useContent';

/**
 * Update content
 */
const updateContent = async ({
  contentId,
  data,
}: {
  contentId: string;
  data: UpdateContentInput;
}): Promise<ContentItemDetail> => {
  const response = await fetch(`/api/content/${contentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update content');
  }

  return response.json();
};

/**
 * Hook to update content with optimistic updates
 */
export const useUpdateContent = (
  options?: UseMutationOptions<
    ContentItemDetail,
    Error,
    { contentId: string; data: UpdateContentInput },
    { previousContent?: ContentItemDetail }
  >
) => {
  const queryClient = useQueryClient();

  return useMutation<
    ContentItemDetail,
    Error,
    { contentId: string; data: UpdateContentInput },
    { previousContent?: ContentItemDetail }
  >({
    mutationFn: updateContent,
    onMutate: async ({ contentId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: contentKeys.detail(contentId) });

      // Snapshot the previous value
      const previousContent = queryClient.getQueryData<ContentItemDetail>(
        contentKeys.detail(contentId)
      );

      // Optimistically update
      if (previousContent) {
        queryClient.setQueryData<ContentItemDetail>(contentKeys.detail(contentId), {
          ...previousContent,
          ...data,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousContent };
    },
    onError: (err, { contentId }, context) => {
      // Rollback on error
      if (context?.previousContent) {
        queryClient.setQueryData(contentKeys.detail(contentId), context.previousContent);
      }
    },
    onSuccess: (data, { contentId }) => {
      // Update cache with server response
      queryClient.setQueryData(contentKeys.detail(contentId), data);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    },
    ...options,
  });
};