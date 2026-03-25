/**
 * 📱 **MOBILE RESPONSIVE LAYOUT TEST SUITE**
 *
 * US-083: Mobile-first responsive layout testing
 * Features: Responsive layouts, breakpoint management, mobile optimization
 *
 * Test Coverage: 100% layout component validation
 * Architecture: Jest + React Testing Library + viewport simulation
 */

import { render, screen, waitFor } from '@testing-library/react';
import {
  ResponsiveCardGrid,
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveLayout,
  ResponsiveMedia,
  ResponsiveSection,
  ResponsiveStack,
  useBreakpoint,
} from '../MobileResponsiveLayout';

// 📱 **Mock window.innerWidth for breakpoint testing**
const mockResizeWindow = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

// 📱 **Test component for breakpoint hook**
const BreakpointTestComponent = () => {
  const breakpoint = useBreakpoint();
  return <div data-testid="breakpoint">{breakpoint}</div>;
};

// 📱 **Mock MobileNavigation component**
vi.mock('../../ui/MobileNavigation', () => {
  return {
    __esModule: true,
    default: ({ breadcrumbs, notificationCount }: any) => (
      <div data-testid="mobile-navigation">
        <span data-testid="notification-count">{notificationCount}</span>
        {breadcrumbs && (
          <div data-testid="breadcrumbs">
            {breadcrumbs.map((crumb: any, index: number) => (
              <span key={index}>{crumb.label}</span>
            ))}
          </div>
        )}
      </div>
    ),
  };
});

describe('📱 Mobile Responsive Layout Test Suite', () => {
  beforeEach(() => {
    // Reset to mobile breakpoint
    mockResizeWindow(375);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('🎯 useBreakpoint Hook - US-083.1', () => {
    test('should detect mobile breakpoint correctly', async () => {
      mockResizeWindow(375);

      render(<BreakpointTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('breakpoint')).toHaveTextContent('mobile');
      });
    });

    test('should detect tablet breakpoint correctly', async () => {
      mockResizeWindow(768);

      render(<BreakpointTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('breakpoint')).toHaveTextContent('tablet');
      });
    });

    test('should detect desktop breakpoint correctly', async () => {
      mockResizeWindow(1024);

      render(<BreakpointTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('breakpoint')).toHaveTextContent('desktop');
      });
    });

    test('should update on window resize', async () => {
      const { rerender } = render(<BreakpointTestComponent />);

      // Start mobile
      expect(screen.getByTestId('breakpoint')).toHaveTextContent('mobile');

      // Resize to desktop
      mockResizeWindow(1200);
      rerender(<BreakpointTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('breakpoint')).toHaveTextContent('desktop');
      });
    });
  });

  describe('🏗️ ResponsiveLayout Component - US-083.2', () => {
    test('should render default layout correctly', () => {
      render(
        <ResponsiveLayout>
          <div>Test content</div>
        </ResponsiveLayout>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-navigation')).toBeInTheDocument();
    });

    test('should apply variant classes correctly', () => {
      const { rerender, container } = render(
        <ResponsiveLayout variant="hero">
          <div>Hero content</div>
        </ResponsiveLayout>
      );

      const layoutDiv = container.firstChild as HTMLElement;
      expect(layoutDiv).toHaveClass('bg-gradient-to-br', 'from-blue-50', 'to-indigo-100');

      rerender(
        <ResponsiveLayout variant="centered">
          <div>Centered content</div>
        </ResponsiveLayout>
      );

      expect(layoutDiv).toHaveClass('flex', 'items-center', 'justify-center');
    });

    test('should hide mobile navigation when specified', () => {
      render(
        <ResponsiveLayout showMobileNav={false}>
          <div>No nav content</div>
        </ResponsiveLayout>
      );

      expect(screen.queryByTestId('mobile-navigation')).not.toBeInTheDocument();
    });

    test('should pass breadcrumbs to mobile navigation', () => {
      const breadcrumbs = [{ label: 'Home', href: '/' }, { label: 'Settings' }];

      render(
        <ResponsiveLayout breadcrumbs={breadcrumbs}>
          <div>Content with breadcrumbs</div>
        </ResponsiveLayout>
      );

      expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    test('should pass notification count to mobile navigation', () => {
      render(
        <ResponsiveLayout notificationCount={5}>
          <div>Content with notifications</div>
        </ResponsiveLayout>
      );

      expect(screen.getByTestId('notification-count')).toHaveTextContent('5');
    });

    test('should apply custom container class', () => {
      render(
        <ResponsiveLayout containerClass="custom-container">
          <div>Custom container content</div>
        </ResponsiveLayout>
      );

      const main = screen.getByRole('main');
      expect(main).toHaveClass('custom-container');
    });
  });

  describe('📦 ResponsiveContainer Component - US-083.3', () => {
    test('should apply size classes correctly', () => {
      const { rerender, container } = render(
        <ResponsiveContainer size="sm">
          <div>Small container</div>
        </ResponsiveContainer>
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveClass('max-w-2xl');

      rerender(
        <ResponsiveContainer size="xl">
          <div>Extra large container</div>
        </ResponsiveContainer>
      );

      expect(containerDiv).toHaveClass('max-w-7xl');
    });

    test('should apply padding classes correctly', () => {
      const { rerender, container } = render(
        <ResponsiveContainer padding="sm">
          <div>Small padding</div>
        </ResponsiveContainer>
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveClass('px-4', 'py-2');

      rerender(
        <ResponsiveContainer padding="lg">
          <div>Large padding</div>
        </ResponsiveContainer>
      );

      expect(containerDiv).toHaveClass('px-6', 'py-6');
    });

    test('should center content by default', () => {
      const { container } = render(
        <ResponsiveContainer>
          <div>Centered content</div>
        </ResponsiveContainer>
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveClass('mx-auto');
    });

    test('should not center when disabled', () => {
      const { container } = render(
        <ResponsiveContainer centered={false}>
          <div>Not centered content</div>
        </ResponsiveContainer>
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).not.toHaveClass('mx-auto');
    });
  });

  describe('🔲 ResponsiveGrid Component - US-083.4', () => {
    test('should render auto grid pattern correctly', () => {
      const { container } = render(
        <ResponsiveGrid pattern="auto" minColumnWidth="250px">
          <div>Grid item 1</div>
          <div>Grid item 2</div>
        </ResponsiveGrid>
      );

      const gridDiv = container.firstChild as HTMLElement;
      expect(gridDiv).toHaveClass('grid', 'grid-cols-1');
    });

    test('should render equal grid pattern correctly', () => {
      const { container } = render(
        <ResponsiveGrid pattern="equal">
          <div>Equal item 1</div>
          <div>Equal item 2</div>
        </ResponsiveGrid>
      );

      const gridDiv = container.firstChild as HTMLElement;
      expect(gridDiv).toHaveClass('grid-cols-1');
    });

    test('should render sidebar grid pattern correctly', () => {
      const { container } = render(
        <ResponsiveGrid pattern="sidebar">
          <div>Sidebar content</div>
          <div>Main content</div>
        </ResponsiveGrid>
      );

      const gridDiv = container.firstChild as HTMLElement;
      expect(gridDiv).toHaveClass('grid-cols-1');
    });

    test('should apply gap classes correctly', () => {
      const { rerender, container } = render(
        <ResponsiveGrid gap="sm">
          <div>Small gap item</div>
        </ResponsiveGrid>
      );

      const gridDiv = container.firstChild as HTMLElement;
      expect(gridDiv).toHaveClass('gap-2');

      rerender(
        <ResponsiveGrid gap="xl">
          <div>Extra large gap item</div>
        </ResponsiveGrid>
      );

      expect(gridDiv).toHaveClass('gap-8');
    });

    test('should render masonry pattern correctly', () => {
      const { container } = render(
        <ResponsiveGrid pattern="masonry">
          <div>Masonry item 1</div>
          <div>Masonry item 2</div>
        </ResponsiveGrid>
      );

      const gridDiv = container.firstChild as HTMLElement;
      expect(gridDiv).toHaveClass('columns-1');
    });
  });

  describe('📚 ResponsiveStack Component - US-083.5', () => {
    test('should render vertical stack on mobile by default', () => {
      const { container } = render(
        <ResponsiveStack>
          <div>Stack item 1</div>
          <div>Stack item 2</div>
        </ResponsiveStack>
      );

      const stackDiv = container.firstChild as HTMLElement;
      expect(stackDiv).toHaveClass('flex', 'flex-col');
    });

    test('should apply spacing classes correctly', () => {
      const { rerender, container } = render(
        <ResponsiveStack spacing="sm">
          <div>Small spacing item</div>
        </ResponsiveStack>
      );

      const stackDiv = container.firstChild as HTMLElement;
      expect(stackDiv).toHaveClass('space-y-2');

      rerender(
        <ResponsiveStack spacing="xl">
          <div>Large spacing item</div>
        </ResponsiveStack>
      );

      expect(stackDiv).toHaveClass('space-y-8');
    });

    test('should apply alignment classes correctly', () => {
      const { rerender, container } = render(
        <ResponsiveStack align="center">
          <div>Centered item</div>
        </ResponsiveStack>
      );

      const stackDiv = container.firstChild as HTMLElement;
      expect(stackDiv).toHaveClass('items-center');

      rerender(
        <ResponsiveStack align="end">
          <div>End aligned item</div>
        </ResponsiveStack>
      );

      expect(stackDiv).toHaveClass('items-end');
    });

    test('should apply justify classes correctly', () => {
      const { rerender, container } = render(
        <ResponsiveStack justify="between">
          <div>Between item 1</div>
          <div>Between item 2</div>
        </ResponsiveStack>
      );

      const stackDiv = container.firstChild as HTMLElement;
      expect(stackDiv).toHaveClass('justify-between');

      rerender(
        <ResponsiveStack justify="center">
          <div>Center justified item</div>
        </ResponsiveStack>
      );

      expect(stackDiv).toHaveClass('justify-center');
    });

    test('should handle custom direction configuration', () => {
      const { container } = render(
        <ResponsiveStack
          direction={{
            mobile: 'horizontal',
            tablet: 'vertical',
            desktop: 'horizontal',
          }}
        >
          <div>Custom direction item</div>
        </ResponsiveStack>
      );

      const stackDiv = container.firstChild as HTMLElement;
      expect(stackDiv).toHaveClass('flex-row');
    });
  });

  describe('📄 ResponsiveSection Component - US-083.6', () => {
    test('should render section with default settings', () => {
      render(
        <ResponsiveSection>
          <div>Section content</div>
        </ResponsiveSection>
      );

      // <section> without aria-label has no ARIA 'region' role; query by element tag
      const section = document.querySelector('section');
      expect(section).toBeInTheDocument();
      expect(screen.getByText('Section content')).toBeInTheDocument();
    });

    test('should apply background classes correctly', () => {
      const { rerender } = render(
        <ResponsiveSection background="white">
          <div>White background</div>
        </ResponsiveSection>
      );

      const section = document.querySelector('section');
      expect(section).toHaveClass('bg-background');

      rerender(
        <ResponsiveSection background="gradient">
          <div>Gradient background</div>
        </ResponsiveSection>
      );

      expect(section).toHaveClass('bg-gradient-to-r');
    });

    test('should apply spacing classes correctly', () => {
      const { rerender } = render(
        <ResponsiveSection spacing="sm">
          <div>Small spacing</div>
        </ResponsiveSection>
      );

      const section = document.querySelector('section');
      expect(section).toHaveClass('py-8');

      rerender(
        <ResponsiveSection spacing="xl">
          <div>Extra large spacing</div>
        </ResponsiveSection>
      );

      expect(section).toHaveClass('py-20');
    });

    test('should apply width constraints correctly', () => {
      const { rerender } = render(
        <ResponsiveSection width="narrow">
          <div>Narrow content</div>
        </ResponsiveSection>
      );

      const container = document.querySelector('section > div');
      expect(container).toHaveClass('max-w-4xl');

      rerender(
        <ResponsiveSection width="full">
          <div>Full width content</div>
        </ResponsiveSection>
      );

      expect(container).toHaveClass('w-full');
    });
  });

  describe('🎴 ResponsiveCardGrid Component - US-083.7', () => {
    test('should render card grid with default settings', () => {
      const { container } = render(
        <ResponsiveCardGrid>
          <div>Card 1</div>
          <div>Card 2</div>
        </ResponsiveCardGrid>
      );

      const gridDiv = container.firstChild as HTMLElement;
      expect(gridDiv).toHaveClass('grid');
    });

    test('should apply gap classes correctly', () => {
      const { rerender, container } = render(
        <ResponsiveCardGrid gap="sm">
          <div>Small gap card</div>
        </ResponsiveCardGrid>
      );

      const gridDiv = container.firstChild as HTMLElement;
      expect(gridDiv).toHaveClass('gap-4');

      rerender(
        <ResponsiveCardGrid gap="lg">
          <div>Large gap card</div>
        </ResponsiveCardGrid>
      );

      expect(gridDiv).toHaveClass('gap-8');
    });

    test('should apply custom minimum column width', () => {
      const { container } = render(
        <ResponsiveCardGrid cardMinWidth="280px">
          <div>Custom width card</div>
        </ResponsiveCardGrid>
      );

      const gridDiv = container.firstChild as HTMLElement;
      const style = getComputedStyle(gridDiv);
      expect(gridDiv.style.gridTemplateColumns).toContain('280px');
    });
  });

  describe('🖼️ ResponsiveMedia Component - US-083.8', () => {
    test('should render image media correctly', () => {
      render(<ResponsiveMedia src="/test-image.jpg" alt="Test image" type="image" />);

      const image = screen.getByAltText('Test image');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', '/test-image.jpg');
    });

    test('should render video media correctly', () => {
      render(<ResponsiveMedia src="/test-video.mp4" alt="Test video" type="video" />);

      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', '/test-video.mp4');
      expect(video).toHaveAttribute('controls');
    });

    test('should apply aspect ratio classes correctly', () => {
      const { rerender, container } = render(
        <ResponsiveMedia src="/test.jpg" alt="Test" aspectRatio="1:1" />
      );

      const mediaContainer = container.firstChild as HTMLElement;
      expect(mediaContainer).toHaveClass('aspect-square');

      rerender(<ResponsiveMedia src="/test.jpg" alt="Test" aspectRatio="16:9" />);

      expect(mediaContainer).toHaveClass('aspect-video');
    });

    test('should apply object fit classes correctly', () => {
      const { rerender } = render(
        <ResponsiveMedia src="/test.jpg" alt="Test" objectFit="contain" />
      );

      const image = screen.getByAltText('Test');
      expect(image).toHaveClass('object-contain');

      rerender(<ResponsiveMedia src="/test.jpg" alt="Test" objectFit="cover" />);

      expect(image).toHaveClass('object-cover');
    });

    test('should apply loading strategy correctly', () => {
      const { rerender } = render(<ResponsiveMedia src="/test.jpg" alt="Test" loading="lazy" />);

      const image = screen.getByAltText('Test');
      expect(image).toHaveAttribute('loading', 'lazy');

      rerender(<ResponsiveMedia src="/test.jpg" alt="Test" loading="eager" />);

      expect(image).toHaveAttribute('loading', 'eager');
    });
  });

  describe('📱 Mobile-First Responsive Behavior', () => {
    test('should adapt grid columns based on breakpoint', async () => {
      const { container } = render(
        <ResponsiveGrid pattern="equal">
          <div>Grid item</div>
        </ResponsiveGrid>
      );

      const gridDiv = container.firstChild as HTMLElement;

      // Mobile: single column
      expect(gridDiv).toHaveClass('grid-cols-1');

      // Should include responsive classes for larger screens
      expect(gridDiv.className).toContain('md:grid-cols-2');
      expect(gridDiv.className).toContain('lg:grid-cols-3');
    });

    test('should adapt container padding based on breakpoint', () => {
      const { container } = render(
        <ResponsiveContainer padding="md">
          <div>Responsive padding</div>
        </ResponsiveContainer>
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveClass('px-4', 'py-4');
      expect(containerDiv.className).toContain('md:px-8');
      expect(containerDiv.className).toContain('lg:px-12');
    });

    test('should handle section spacing responsively', () => {
      render(
        <ResponsiveSection spacing="lg">
          <div>Responsive section</div>
        </ResponsiveSection>
      );

      const section = document.querySelector('section');
      expect(section).toHaveClass('py-16');
      expect(section?.className).toContain('md:py-20');
    });
  });

  describe('♿ Accessibility Features', () => {
    test('should provide proper semantic structure', () => {
      render(
        <ResponsiveLayout>
          <ResponsiveSection>
            <ResponsiveContainer>
              <div>Accessible content structure</div>
            </ResponsiveContainer>
          </ResponsiveSection>
        </ResponsiveLayout>
      );

      const main = screen.getByRole('main');
      const section = document.querySelector('section');

      expect(main).toBeInTheDocument();
      expect(section).toBeInTheDocument();
    });

    test('should handle video accessibility features', () => {
      render(<ResponsiveMedia src="/test-video.mp4" alt="Accessible video" type="video" />);

      const video = document.querySelector('video');
      const track = document.querySelector('track');

      expect(video).toBeInTheDocument();
      expect(track).toHaveAttribute('kind', 'captions');
      expect(track).toHaveAttribute('srcLang', 'en');
    });

    test('should maintain focus order in responsive layouts', () => {
      render(
        <ResponsiveStack>
          <button>First button</button>
          <button>Second button</button>
          <button>Third button</button>
        </ResponsiveStack>
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);

      // Focus order should be maintained regardless of layout
      buttons[0].focus();
      expect(document.activeElement).toBe(buttons[0]);
    });
  });
});
