import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import CirclesBrowser from '../CirclesBrowser';

// --- Hook mocks ---
const mockUseCircles = vi.fn();
const mockUseSuggestedCircles = vi.fn();
const mockUseJoinCircle = vi.fn();
const mockUseCreateCircle = vi.fn();

vi.mock('../../hooks/useCircles', () => ({
  useCircles: () => mockUseCircles(),
  useSuggestedCircles: () => mockUseSuggestedCircles(),
  useJoinCircle: () => mockUseJoinCircle(),
  useCreateCircle: () => mockUseCreateCircle(),
}));

// --- Helpers ---
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const defaultMutateFn = vi.fn();

const idleCreateMutation = {
  mutate: defaultMutateFn,
  isPending: false,
  isError: false,
  variables: undefined,
};

const idleJoinMutation = {
  mutate: defaultMutateFn,
  isPending: false,
  variables: undefined,
};

const sampleCircle = {
  id: 'circle-1',
  name: 'Indie Musicians',
  description: 'A circle for indie music creators',
  niche: 'indie music',
  maxMembers: 20,
  memberCount: 5,
  createdBy: 'creator-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const fullCircle = {
  ...sampleCircle,
  id: 'circle-full',
  name: 'Full Circle',
  memberCount: 20,
};

// --- Tests ---
describe('CirclesBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCircles.mockReturnValue({ data: [], isLoading: false });
    mockUseSuggestedCircles.mockReturnValue({ data: [], isLoading: false });
    mockUseJoinCircle.mockReturnValue(idleJoinMutation);
    mockUseCreateCircle.mockReturnValue(idleCreateMutation);
  });

  describe('Rendering', () => {
    it('renders the Creator Circles heading', () => {
      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByText('Creator Circles')).toBeInTheDocument();
    });

    it('renders the Create Circle button', () => {
      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: 'Create Circle' })).toBeInTheDocument();
    });

    it('shows loading skeleton while data is loading', () => {
      mockUseCircles.mockReturnValue({ data: [], isLoading: true });
      mockUseSuggestedCircles.mockReturnValue({ data: [], isLoading: true });

      const { container } = render(<CirclesBrowser />, { wrapper: createWrapper() });

      // Loading state uses animate-pulse
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('shows empty state when there are no circles', () => {
      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByText(/No circles yet/i)).toBeInTheDocument();
    });

    it('renders My Circles section with owned circles', () => {
      mockUseCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByRole('region', { name: 'My circles' })).toBeInTheDocument();
      expect(screen.getByText('Indie Musicians')).toBeInTheDocument();
    });

    it('renders Suggested section with suggested circles', () => {
      mockUseSuggestedCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByRole('region', { name: 'Suggested circles' })).toBeInTheDocument();
    });

    it('displays niche badge when a circle has a niche', () => {
      mockUseSuggestedCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByText('indie music')).toBeInTheDocument();
    });

    it('displays member count for each circle', () => {
      mockUseSuggestedCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByText('5/20 members')).toBeInTheDocument();
    });

    it('shows Join button for suggested circles', () => {
      mockUseSuggestedCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: `Join ${sampleCircle.name}` })).toBeInTheDocument();
    });

    it('shows Full label when a circle is at max capacity', () => {
      mockUseSuggestedCircles.mockReturnValue({ data: [fullCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByText('Full')).toBeInTheDocument();
    });

    it('disables Join button when circle is full', () => {
      mockUseSuggestedCircles.mockReturnValue({ data: [fullCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      const joinButton = screen.getByRole('button', { name: `Join ${fullCircle.name}` });
      expect(joinButton).toBeDisabled();
    });

    it('does not show a Join button for my own circles', () => {
      mockUseCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: /Join/ })).not.toBeInTheDocument();
    });
  });

  describe('Create Circle form', () => {
    it('does not render create form initially', () => {
      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.queryByText('New Circle')).not.toBeInTheDocument();
    });

    it('shows create form when Create Circle button is clicked', () => {
      render(<CirclesBrowser />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }));

      expect(screen.getByText('New Circle')).toBeInTheDocument();
      expect(screen.getByLabelText('Circle name')).toBeInTheDocument();
      expect(screen.getByLabelText('Circle niche')).toBeInTheDocument();
      expect(screen.getByLabelText('Circle description')).toBeInTheDocument();
      expect(screen.getByLabelText('Maximum members')).toBeInTheDocument();
    });

    it('hides create form when Cancel is clicked', () => {
      render(<CirclesBrowser />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText('New Circle')).not.toBeInTheDocument();
    });

    it('disables the Create submit button when name is empty', () => {
      render(<CirclesBrowser />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }));

      // The inner "Create" submit button within the form
      const createBtn = screen.getByRole('button', { name: 'Create' });
      expect(createBtn).toBeDisabled();
    });

    it('enables Create button when a name is entered', () => {
      render(<CirclesBrowser />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }));
      fireEvent.change(screen.getByLabelText('Circle name'), { target: { value: 'My Circle' } });

      expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled();
    });

    it('does not call mutate when name is blank and Create is clicked', () => {
      const mutate = vi.fn();
      mockUseCreateCircle.mockReturnValue({ ...idleCreateMutation, mutate });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }));
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      expect(mutate).not.toHaveBeenCalled();
    });

    it('calls createMutation.mutate with name, niche, and maxMembers when submitted', () => {
      const mutate = vi.fn();
      mockUseCreateCircle.mockReturnValue({ ...idleCreateMutation, mutate });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }));
      fireEvent.change(screen.getByLabelText('Circle name'), { target: { value: 'Photographers' } });
      fireEvent.change(screen.getByLabelText('Circle niche'), { target: { value: 'photography' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Photographers',
          niche: 'photography',
        }),
        expect.any(Object)
      );
    });

    it('shows Creating... on the button while mutation is pending', () => {
      mockUseCreateCircle.mockReturnValue({ ...idleCreateMutation, isPending: true });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: 'Create Circle' }));

      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });

  describe('Joining circles', () => {
    it('calls joinMutation.mutate with the circle id when Join is clicked', () => {
      const mutate = vi.fn();
      mockUseJoinCircle.mockReturnValue({ ...idleJoinMutation, mutate });
      mockUseSuggestedCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: `Join ${sampleCircle.name}` }));

      expect(mutate).toHaveBeenCalledWith(sampleCircle.id, expect.objectContaining({ onSettled: expect.any(Function) }));
    });

    it('shows Joining... on the button after Join is clicked', () => {
      const mutate = vi.fn();
      mockUseJoinCircle.mockReturnValue({ ...idleJoinMutation, mutate });
      mockUseSuggestedCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: `Join ${sampleCircle.name}` }));

      expect(screen.getByText('Joining...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('My Circles section has an accessible region label', () => {
      mockUseCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByRole('region', { name: 'My circles' })).toBeInTheDocument();
    });

    it('Suggested Circles section has an accessible region label', () => {
      mockUseSuggestedCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByRole('region', { name: 'Suggested circles' })).toBeInTheDocument();
    });

    it('circle list renders as a list element', () => {
      mockUseSuggestedCircles.mockReturnValue({ data: [sampleCircle], isLoading: false });

      render(<CirclesBrowser />, { wrapper: createWrapper() });

      expect(screen.getByRole('list')).toBeInTheDocument();
    });
  });
});
