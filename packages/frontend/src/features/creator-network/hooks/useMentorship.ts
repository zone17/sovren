import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mentorshipApi } from '../services/mentorshipApi';

export function useMentors(params?: { niche?: string; audienceSizeRange?: string }) {
  return useQuery({
    queryKey: ['creator-network', 'mentors', params],
    queryFn: () => mentorshipApi.getMentors(params),
    select: (res) => res.data?.mentors ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyMentorships() {
  return useQuery({
    queryKey: ['creator-network', 'my-mentorships'],
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
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'mentors'] });
    },
  });
}

export function useRequestMentorship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mentorshipApi.requestMentorship,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'my-mentorships'] });
    },
  });
}

export function useRespondToMentorship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      mentorshipApi.respondToMentorship(id, { accept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-network', 'my-mentorships'] });
    },
  });
}
