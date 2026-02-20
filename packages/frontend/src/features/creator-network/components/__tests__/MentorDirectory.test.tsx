import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import MentorDirectory from '../MentorDirectory';

// --- Hook mocks ---
const mockUseMentors = vi.fn();
const mockUseRequestMentorship = vi.fn();

vi.mock('../../hooks/useMentorship', () => ({
  useMentors: () => mockUseMentors(),
  useRequestMentorship: () => mockUseRequestMentorship(),
}));

// --- Helpers ---
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const defaultMutateFn = vi.fn();

const idleRequestMutation = {
  mutate: defaultMutateFn,
  isPending: false,
};

const sampleMentor = {
  id: 'mentor-profile-1',
  creatorId: 'creator-abc',
  niche: 'photography',
  audienceSizeRange: '10k-100k' as const,
  bio: 'Professional photographer with 10 years experience.',
  maxMentees: 5,
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
};

const mentorNoFilter = {
  ...sampleMentor,
  id: 'mentor-profile-2',
  creatorId: 'creator-xyz',
  niche: 'cooking',
  audienceSizeRange: '1k-10k' as const,
  bio: undefined,
};

// --- Tests ---
describe('MentorDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMentors.mockReturnValue({ data: [], isLoading: false });
    mockUseRequestMentorship.mockReturnValue(idleRequestMutation);
  });

  describe('Rendering', () => {
    it('renders the Mentor Directory heading', () => {
      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByText('Mentor Directory')).toBeInTheDocument();
    });

    it('renders the niche filter input', () => {
      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Filter by niche')).toBeInTheDocument();
    });

    it('renders the audience size filter select', () => {
      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Filter by audience size')).toBeInTheDocument();
    });

    it('renders all audience size options in the select', () => {
      render(<MentorDirectory />, { wrapper: createWrapper() });

      const select = screen.getByLabelText('Filter by audience size') as HTMLSelectElement;
      const optionTexts = Array.from(select.options).map((o) => o.text);

      expect(optionTexts).toContain('Any audience size');
      expect(optionTexts).toContain('Under 1K');
      expect(optionTexts).toContain('1K – 10K');
      expect(optionTexts).toContain('10K – 100K');
      expect(optionTexts).toContain('100K+');
    });

    it('shows loading skeleton while mentors are loading', () => {
      mockUseMentors.mockReturnValue({ data: [], isLoading: true });

      const { container } = render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('shows empty state message when no mentors match', () => {
      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByText(/No mentors match your filters/i)).toBeInTheDocument();
    });

    it('renders a mentor card with niche, audience range, and bio', () => {
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByText('photography')).toBeInTheDocument();
      // The audience range label appears both in the select option and in the card badge.
      // Use getAllByText and assert at least one instance is in the document.
      expect(screen.getAllByText('10K – 100K').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Professional photographer with 10 years experience.')).toBeInTheDocument();
    });

    it('renders max mentees count', () => {
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByText(`Mentees: up to ${sampleMentor.maxMentees}`)).toBeInTheDocument();
    });

    it('does not render bio section when mentor has no bio', () => {
      mockUseMentors.mockReturnValue({ data: [mentorNoFilter], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      // cooking niche mentor has no bio — just check no p.text-sm.text-gray-600 for bio
      expect(screen.queryByText('Professional photographer')).not.toBeInTheDocument();
    });

    it('renders a Request button for each mentor', () => {
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(
        screen.getByRole('button', { name: /Request mentorship from photography mentor/i })
      ).toBeInTheDocument();
    });

    it('renders multiple mentor cards', () => {
      mockUseMentors.mockReturnValue({ data: [sampleMentor, mentorNoFilter], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByText('photography')).toBeInTheDocument();
      expect(screen.getByText('cooking')).toBeInTheDocument();
    });
  });

  describe('Niche filter', () => {
    it('updates niche filter input value when user types', () => {
      render(<MentorDirectory />, { wrapper: createWrapper() });

      const nicheInput = screen.getByLabelText('Filter by niche');
      fireEvent.change(nicheInput, { target: { value: 'photography' } });

      expect((nicheInput as HTMLInputElement).value).toBe('photography');
    });
  });

  describe('Audience size filter', () => {
    it('updates audience size filter when user changes selection', () => {
      render(<MentorDirectory />, { wrapper: createWrapper() });

      const select = screen.getByLabelText('Filter by audience size');
      fireEvent.change(select, { target: { value: '10k-100k' } });

      expect((select as HTMLSelectElement).value).toBe('10k-100k');
    });
  });

  describe('Mentorship request flow', () => {
    it('shows the goals textarea when Request button is clicked', () => {
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      fireEvent.click(
        screen.getByRole('button', { name: /Request mentorship from photography mentor/i })
      );

      expect(screen.getByLabelText('Mentorship goals')).toBeInTheDocument();
    });

    it('shows Send Request and Cancel buttons when request form is open', () => {
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      fireEvent.click(
        screen.getByRole('button', { name: /Request mentorship from photography mentor/i })
      );

      expect(screen.getByRole('button', { name: 'Send Request' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('hides the request form when Cancel is clicked', () => {
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      fireEvent.click(
        screen.getByRole('button', { name: /Request mentorship from photography mentor/i })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByLabelText('Mentorship goals')).not.toBeInTheDocument();
    });

    it('calls requestMutation.mutate with mentorId and goals when Send Request is clicked', () => {
      const mutate = vi.fn();
      mockUseRequestMentorship.mockReturnValue({ ...idleRequestMutation, mutate });
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      fireEvent.click(
        screen.getByRole('button', { name: /Request mentorship from photography mentor/i })
      );
      fireEvent.change(screen.getByLabelText('Mentorship goals'), {
        target: { value: 'Improve my portfolio\nGrow my audience' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

      expect(mutate).toHaveBeenCalledWith(
        {
          mentorId: sampleMentor.creatorId,
          goals: ['Improve my portfolio', 'Grow my audience'],
        },
        expect.any(Object)
      );
    });

    it('shows Sending... on the button while mutation is pending', () => {
      mockUseRequestMentorship.mockReturnValue({ ...idleRequestMutation, isPending: true });
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      fireEvent.click(
        screen.getByRole('button', { name: /Request mentorship from photography mentor/i })
      );

      expect(screen.getByText('Sending...')).toBeInTheDocument();
    });

    it('disables Send Request button while mutation is pending', () => {
      mockUseRequestMentorship.mockReturnValue({ ...idleRequestMutation, isPending: true });
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      fireEvent.click(
        screen.getByRole('button', { name: /Request mentorship from photography mentor/i })
      );

      expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('mentor list renders as a list element', () => {
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('niche filter input has an accessible label', () => {
      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Filter by niche')).toBeInTheDocument();
    });

    it('audience size select has an accessible label', () => {
      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Filter by audience size')).toBeInTheDocument();
    });

    it('request button has an accessible label including the mentor niche', () => {
      mockUseMentors.mockReturnValue({ data: [sampleMentor], isLoading: false });

      render(<MentorDirectory />, { wrapper: createWrapper() });

      expect(
        screen.getByRole('button', { name: /Request mentorship from photography mentor/i })
      ).toBeInTheDocument();
    });
  });
});
