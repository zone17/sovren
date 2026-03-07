import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { mentorshipKeys } from '@/hooks/query-keys';
import { mentorshipApi, type UpdateMentorProfileData } from '../services/mentorshipApi';

export function useMentors(params?: { niche?: string; audienceSizeRange?: string }) {
  return useQuery({
    queryKey: mentorshipKeys.list(params as Record<string, string> | undefined),
    queryFn: () => mentorshipApi.getMentors(params),
    select: (res) => res.data?.mentors ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyMentorships() {
  return useQuery({
    queryKey: mentorshipKeys.myMentorships(),
    queryFn: () => mentorshipApi.getMyMentorships(),
    select: (res) => res.data?.mentorships ?? [],
    staleTime: 60 * 1000,
  });
}

export function useRegisterMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mentorshipApi.registerMentor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorshipKeys.all });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Operation failed');
    },
  });
}

export function useRequestMentorship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof mentorshipApi.requestMentorship>[0]) =>
      mentorshipApi.requestMentorship(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorshipKeys.myMentorships() });
      toast.success('Mentorship request sent!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to request mentorship. Please try again.');
    },
  });
}

export function useRespondToMentorship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      mentorshipApi.respondToMentorship(id, { accept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorshipKeys.myMentorships() });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Operation failed');
    },
  });
}

// #751: Update current user's mentor profile
export function useUpdateMentorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateMentorProfileData) => mentorshipApi.updateMentorProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorshipKeys.all });
      toast.success('Mentor profile updated.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update mentor profile. Please try again.');
    },
  });
}
