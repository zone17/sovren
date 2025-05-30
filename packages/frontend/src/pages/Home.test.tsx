import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: (): { push: jest.Mock } => ({
    push: mockPush,
  }),
}));

// Mock components
jest.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="layout">{children}</div>
  ),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('Home Component', () => {
  describe('Rendering', () => {
    it('renders within Layout component', () => {
      renderWithRouter(<Home />);
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('renders the main heading', () => {
      renderWithRouter(<Home />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Welcome to Sovren');
      expect(heading).toHaveClass('text-4xl', 'font-bold', 'text-gray-900');
    });

    it('renders the main description', () => {
      renderWithRouter(<Home />);
      const description = screen.getByText(
        'The platform for creators to monetize their content using Bitcoin and Nostr.'
      );
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass('text-base', 'text-gray-500');
    });
  });

  describe('Call-to-Action Buttons', () => {
    it('renders Get Started button with correct link', () => {
      renderWithRouter(<Home />);
      const getStartedButton = screen.getByRole('link', { name: /get started/i });
      expect(getStartedButton).toBeInTheDocument();
      expect(getStartedButton).toHaveAttribute('href', '/signup');
      expect(getStartedButton).toHaveClass('bg-blue-600', 'hover:bg-blue-700', 'text-white');
    });

    it('renders Learn More button with correct link', () => {
      renderWithRouter(<Home />);
      const learnMoreButton = screen.getByRole('link', { name: /learn more/i });
      expect(learnMoreButton).toBeInTheDocument();
      expect(learnMoreButton).toHaveAttribute('href', '/about');
      expect(learnMoreButton).toHaveClass('text-blue-600', 'bg-white', 'hover:bg-gray-50');
    });
  });

  describe('Feature Cards', () => {
    it('renders Create Content card', () => {
      renderWithRouter(<Home />);
      const createContentHeading = screen.getByRole('heading', {
        name: /create content/i,
      });
      expect(createContentHeading).toBeInTheDocument();
      expect(createContentHeading).toHaveClass('text-lg', 'font-medium');

      const createContentDescription = screen.getByText(
        'Share your thoughts, ideas, and expertise with your audience.'
      );
      expect(createContentDescription).toBeInTheDocument();
    });

    it('renders Monetize card', () => {
      renderWithRouter(<Home />);
      const monetizeHeading = screen.getByRole('heading', { name: /monetize/i });
      expect(monetizeHeading).toBeInTheDocument();

      const monetizeDescription = screen.getByText(
        'Earn Bitcoin for your content through direct payments and subscriptions.'
      );
      expect(monetizeDescription).toBeInTheDocument();
    });

    it('renders Build Community card', () => {
      renderWithRouter(<Home />);
      const communityHeading = screen.getByRole('heading', {
        name: /build community/i,
      });
      expect(communityHeading).toBeInTheDocument();

      const communityDescription = screen.getByText(
        'Connect with your audience and other creators through Nostr.'
      );
      expect(communityDescription).toBeInTheDocument();
    });

    it('renders all feature card icons', () => {
      renderWithRouter(<Home />);
      const container = screen.getByTestId('layout');
      const svgElements = container.querySelectorAll('svg');
      expect(svgElements).toHaveLength(3);

      // Check that each SVG has the correct styling
      svgElements.forEach((svg) => {
        expect(svg).toHaveClass('h-6', 'w-6', 'text-white');
      });
    });
  });

  describe('Layout and Styling', () => {
    it('has proper responsive grid layout for feature cards', () => {
      renderWithRouter(<Home />);
      const container = screen.getByTestId('layout');
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass(
        'grid',
        'grid-cols-1',
        'gap-8',
        'sm:grid-cols-2',
        'lg:grid-cols-3'
      );
    });

    it('centers the main content', () => {
      renderWithRouter(<Home />);
      const container = screen.getByTestId('layout');
      const mainContent = container.querySelector('.text-center');
      expect(mainContent).toHaveClass('text-center');
    });

    it('has proper spacing between sections', () => {
      renderWithRouter(<Home />);
      const container = screen.getByTestId('layout');
      const secondSection = container.querySelector('.mt-16');
      expect(secondSection).toHaveClass('mt-16');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithRouter(<Home />);
      const mainHeading = screen.getByRole('heading', { level: 1 });
      const featureHeadings = screen.getAllByRole('heading', { level: 3 });

      expect(mainHeading).toBeInTheDocument();
      expect(featureHeadings).toHaveLength(3);
    });

    it('has accessible button styling', () => {
      renderWithRouter(<Home />);
      const buttons = screen.getAllByRole('link');

      buttons.forEach((button) => {
        expect(button).toHaveClass('flex', 'items-center', 'justify-center');
        expect(button).toHaveClass('font-medium', 'rounded-md');
      });
    });

    it('provides meaningful text content for screen readers', () => {
      renderWithRouter(<Home />);

      // Check that all text content is present and accessible
      expect(screen.getByText('Welcome to Sovren')).toBeInTheDocument();
      expect(screen.getByText('Get Started')).toBeInTheDocument();
      expect(screen.getByText('Learn More')).toBeInTheDocument();
      expect(screen.getByText('Create Content')).toBeInTheDocument();
      expect(screen.getByText('Monetize')).toBeInTheDocument();
      expect(screen.getByText('Build Community')).toBeInTheDocument();
    });
  });

  describe('Navigation Integration', () => {
    it('integrates properly with React Router', () => {
      renderWithRouter(<Home />);

      // Verify links are rendered as proper anchor tags
      const signupLink = screen.getByRole('link', { name: /get started/i });
      const aboutLink = screen.getByRole('link', { name: /learn more/i });

      expect(signupLink.tagName).toBe('A');
      expect(aboutLink.tagName).toBe('A');
    });
  });
});
