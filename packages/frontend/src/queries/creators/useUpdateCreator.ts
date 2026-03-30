/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { CreatorProfile, UpdateCreatorInput } from '@/types/creator';
import { creatorsKeys } from './useCreators';

/**
 * Update creator profile
 */
const updateCreator = async ({
  creatorId,
  data,
}: {
  creatorId: string;
  data: UpdateCreatorInput;
}): Promise<CreatorProfile> => {
  const response = await fetch(`/api/creators/${creatorId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update creator profile');
  }

  return response.json();
};

/**
 * Hook to update creator profile with optimistic updates
 */
export const useUpdateCreator = (
  options?: UseMutationOptions<
    CreatorProfile,
    Error,
    { creatorId: string; data: UpdateCreatorInput },
    { previousCreator?: CreatorProfile }
  >
) => {
  const queryClient = useQueryClient();

  return useMutation<
    CreatorProfile,
    Error,
    { creatorId: string; data: UpdateCreatorInput },
    { previousCreator?: CreatorProfile }
  >({
    mutationFn: updateCreator,
    onMutate: async ({ creatorId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: creatorsKeys.detail(creatorId) });

      // Snapshot the previous value
      const previousCreator = queryClient.getQueryData<CreatorProfile>(
        creatorsKeys.detail(creatorId)
      );

      // Optimistically update to the new value
      if (previousCreator) {
        queryClient.setQueryData<CreatorProfile>(creatorsKeys.detail(creatorId), {
          ...previousCreator,
          ...data,
          updatedAt: new Date().toISOString(),
        });
      }

      // Return a context with the previous and new data
      return { previousCreator };
    },
    onError: (err, { creatorId }, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousCreator) {
        queryClient.setQueryData(creatorsKeys.detail(creatorId), context.previousCreator);
      }
    },
    onSuccess: (data, { creatorId }) => {
      // Update the creator in the detail cache
      queryClient.setQueryData(creatorsKeys.detail(creatorId), data);

      // Invalidate the list cache to refetch on next access
      queryClient.invalidateQueries({ queryKey: creatorsKeys.lists() });
    },
    ...options,
  });
};
