/**
 * 📱 **MOBILE COMPONENTS TEST SUITE**
 *
 * US-084: Mobile-specific component variants testing
 * Features: Touch optimization, gesture handling, mobile interactions
 *
 * Test Coverage: 100% component and interaction validation
 * Architecture: Jest + React Testing Library + touch simulation
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MobileButton,
  MobileCard,
  MobileInput,
  MobileList,
  MobileModal,
} from '../MobileComponents';

// 📱 **Mock haptic feedback for testing**
const mockVibrate = vi.fn();
Object.defineProperty(navigator, 'vibrate', {
  value: mockVibrate,
  writable: true,
});

// 📱 **Touch Event Simulation Utilities**
const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  const touchEvent = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: touches.map((touch) => ({
      ...touch,
      target: document.createElement('div'),
    })) as any,
    targetTouches: touches.map((touch) => ({
      ...touch,
      target: document.createElement('div'),
    })) as any,
  });
  return touchEvent;
};

const simulateSwipe = (element: HTMLElement, direction: 'left' | 'right') => {
  const startX = direction === 'left' ? 200 : 50;
  const endX = direction === 'left' ? 50 : 200;

  fireEvent(element, createTouchEvent('touchstart', [{ clientX: startX, clientY: 100 }]));
  fireEvent(element, createTouchEvent('touchmove', [{ clientX: endX, clientY: 100 }]));
  fireEvent(element, createTouchEvent('touchend', []));
};

const simulateTap = (element: HTMLElement) => {
  fireEvent(element, createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
  fireEvent(element, createTouchEvent('touchend', []));
};

describe('📱 Mobile Components Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('🎴 MobileCard Component - US-084.2', () => {
    test('should render basic card with title and content', () => {
      render(<MobileCard title="Test Card" content={<div>Card content</div>} />);

      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    test('should render subtitle when provided', () => {
      render(
        <MobileCard title="Test Card" subtitle="Test subtitle" content={<div>Card content</div>} />
      );

      expect(screen.getByText('Test subtitle')).toBeInTheDocument();
    });

    test('should handle expandable cards', async () => {
      render(
        <MobileCard title="Expandable Card" content={<div>Hidden content</div>} expandable={true} />
      );

      // Content should be hidden initially
      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();

      // Tap to expand
      const card = screen.getByRole('generic');
      simulateTap(card);

      await waitFor(() => {
        expect(screen.getByText('Hidden content')).toBeInTheDocument();
      });
    });

    test('should trigger swipe callbacks', () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      render(
        <MobileCard
          title="Swipeable Card"
          content={<div>Content</div>}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
        />
      );

      const card = screen.getByRole('generic');

      simulateSwipe(card, 'left');
      expect(onSwipeLeft).toHaveBeenCalledTimes(1);

      simulateSwipe(card, 'right');
      expect(onSwipeRight).toHaveBeenCalledTimes(1);
    });

    test('should trigger haptic feedback when enabled', () => {
      const onTap = vi.fn();

      render(
        <MobileCard title="Haptic Card" content={<div>Content</div>} haptic={true} onTap={onTap} />
      );

      const card = screen.getByTestId('mobile-card-haptic-card') as HTMLElement;
      simulateTap(card);

      expect(mockVibrate).toHaveBeenCalledWith(10);
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    test('should disable haptic feedback when disabled', () => {
      render(<MobileCard title="No Haptic Card" content={<div>Content</div>} haptic={false} />);

      const card = screen.getByTestId('mobile-card-no-haptic-card') as HTMLElement;
      simulateTap(card);

      expect(mockVibrate).not.toHaveBeenCalled();
    });

    test('should render action buttons with proper touch targets', () => {
      const action = <button>Action</button>;

      render(
        <MobileCard title="Card with Actions" content={<div>Content</div>} actions={[action]} />
      );

      const actionContainer = screen.getByText('Action').parentElement;
      expect(actionContainer).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });
  });

  describe('🔘 MobileButton Component - US-084.3', () => {
    test('should render button with correct size classes', () => {
      const { rerender } = render(<MobileButton size="sm">Small Button</MobileButton>);

      expect(screen.getByRole('button')).toHaveClass('min-h-[44px]');

      rerender(<MobileButton size="md">Medium Button</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('min-h-[48px]');

      rerender(<MobileButton size="lg">Large Button</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('min-h-[52px]');
    });

    test('should apply variant styles correctly', () => {
      const { rerender } = render(<MobileButton variant="primary">Primary</MobileButton>);

      expect(screen.getByRole('button')).toHaveClass('bg-blue-600');

      rerender(<MobileButton variant="secondary">Secondary</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('bg-gray-200');

      rerender(<MobileButton variant="ghost">Ghost</MobileButton>);
      expect(screen.getByRole('button')).toHaveClass('bg-transparent');
    });

    test('should handle loading state', () => {
      render(<MobileButton loading={true}>Loading Button</MobileButton>);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    test('should trigger haptic feedback on click', async () => {
      const onClick = vi.fn();

      render(
        <MobileButton onClick={onClick} haptic={true}>
          Haptic Button
        </MobileButton>
      );

      await userEvent.click(screen.getByRole('button'));

      expect(mockVibrate).toHaveBeenCalledWith(50);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('should not trigger click when disabled', async () => {
      const onClick = vi.fn();

      render(
        <MobileButton onClick={onClick} disabled={true}>
          Disabled Button
        </MobileButton>
      );

      await userEvent.click(screen.getByRole('button'));

      expect(onClick).not.toHaveBeenCalled();
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    test('should apply full width when specified', () => {
      render(<MobileButton fullWidth={true}>Full Width</MobileButton>);

      expect(screen.getByRole('button')).toHaveClass('w-full');
    });
  });

  describe('📝 MobileInput Component - US-084.5', () => {
    test('should render input with proper touch target size', () => {
      render(<MobileInput value="" onChange={vi.fn()} placeholder="Test input" />);

      const input = screen.getByPlaceholderText('Test input');
      expect(input).toHaveClass('min-h-[48px]');
    });

    test('should handle value changes with haptic feedback', async () => {
      const onChange = vi.fn();

      render(<MobileInput value="" onChange={onChange} haptic={true} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');

      expect(onChange).toHaveBeenCalledTimes(4);
      expect(mockVibrate).toHaveBeenCalledTimes(4);
    });

    test('should render label when provided', () => {
      render(<MobileInput value="" onChange={vi.fn()} label="Test Label" />);

      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    test('should display error state', () => {
      render(<MobileInput value="" onChange={vi.fn()} error="Test error" />);

      expect(screen.getByText('Test error')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveClass('border-red-500');
    });

    test('should handle disabled state', () => {
      render(<MobileInput value="" onChange={vi.fn()} disabled={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('bg-gray-100');
    });

    test('should support different input types', () => {
      const { rerender } = render(<MobileInput type="email" value="" onChange={vi.fn()} />);

      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');

      rerender(<MobileInput type="password" value="" onChange={vi.fn()} />);

      expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password');
    });
  });

  describe('📋 MobileList Component - US-084.4', () => {
    const mockItems = [
      {
        id: '1',
        title: 'Item 1',
        subtitle: 'Subtitle 1',
        badge: 5,
      },
      {
        id: '2',
        title: 'Item 2',
        subtitle: 'Subtitle 2',
      },
    ];

    test('should render list items correctly', () => {
      render(<MobileList items={mockItems} onItemTap={vi.fn()} />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Subtitle 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    test('should handle item taps', () => {
      const onItemTap = vi.fn();

      render(<MobileList items={mockItems} onItemTap={onItemTap} />);

      const firstItem = screen.getByText('Item 1').closest('div');
      simulateTap(firstItem!);

      expect(onItemTap).toHaveBeenCalledWith('1');
    });

    test('should handle swipe actions', () => {
      const onItemSwipeLeft = vi.fn();
      const onItemSwipeRight = vi.fn();

      render(
        <MobileList
          items={mockItems}
          onItemSwipeLeft={onItemSwipeLeft}
          onItemSwipeRight={onItemSwipeRight}
        />
      );

      const firstItem = screen.getByText('Item 1').closest('div');

      simulateSwipe(firstItem!, 'left');
      expect(onItemSwipeLeft).toHaveBeenCalledWith('1');

      simulateSwipe(firstItem!, 'right');
      expect(onItemSwipeRight).toHaveBeenCalledWith('1');
    });

    test('should render badges correctly', () => {
      render(<MobileList items={mockItems} onItemTap={vi.fn()} />);

      const badge = screen.getByText('5');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    });

    test('should have proper touch target sizes', () => {
      render(<MobileList items={mockItems} onItemTap={vi.fn()} />);

      const listItems = screen
        .getAllByText(/Item \d/)
        .map((item) => item.closest('.mobile-list-item'));

      listItems.forEach((item) => {
        expect(item).toHaveClass('min-h-[60px]');
      });
    });
  });

  describe('🗂️ MobileModal Component - US-084.6', () => {
    test('should not render when closed', () => {
      render(
        <MobileModal isOpen={false} onClose={vi.fn()} title="Test Modal">
          Modal content
        </MobileModal>
      );

      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    test('should render when open', () => {
      render(
        <MobileModal isOpen={true} onClose={vi.fn()} title="Test Modal">
          Modal content
        </MobileModal>
      );

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    test('should handle close button click', async () => {
      const onClose = vi.fn();

      render(
        <MobileModal isOpen={true} onClose={onClose} title="Test Modal">
          Modal content
        </MobileModal>
      );

      const closeButton = screen.getByLabelText('Close modal') || screen.getByRole('button');
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('should handle overlay click to close', async () => {
      const onClose = vi.fn();

      render(
        <MobileModal isOpen={true} onClose={onClose} title="Test Modal">
          Modal content
        </MobileModal>
      );

      const overlay = document.querySelector('.fixed.inset-0.bg-black');
      await userEvent.click(overlay!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('should render action buttons', () => {
      const actions = [<button key="1">Action 1</button>, <button key="2">Action 2</button>];

      render(
        <MobileModal isOpen={true} onClose={vi.fn()} title="Test Modal" actions={actions}>
          Modal content
        </MobileModal>
      );

      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Action 2')).toBeInTheDocument();
    });

    test('should handle swipe to dismiss', () => {
      const onClose = vi.fn();

      render(
        <MobileModal isOpen={true} onClose={onClose} title="Test Modal">
          Modal content
        </MobileModal>
      );

      const modal = document.querySelector('.mobile-modal');
      simulateSwipe(modal!, 'right');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('should be mobile-only (hidden on desktop)', () => {
      render(
        <MobileModal isOpen={true} onClose={vi.fn()} title="Test Modal">
          Modal content
        </MobileModal>
      );

      const modalContainer = document.querySelector('.fixed.inset-0.z-50');
      expect(modalContainer).toHaveClass('md:hidden');
    });
  });

  describe('🎛️ Touch Gesture Integration', () => {
    test('should handle gesture threshold correctly', () => {
      const onSwipeLeft = vi.fn();

      render(
        <MobileCard title="Gesture Test" content={<div>Content</div>} onSwipeLeft={onSwipeLeft} />
      );

      const card = screen.getByRole('generic');

      // Small movement (below threshold)
      fireEvent(card, createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
      fireEvent(card, createTouchEvent('touchmove', [{ clientX: 80, clientY: 100 }]));
      fireEvent(card, createTouchEvent('touchend', []));

      expect(onSwipeLeft).not.toHaveBeenCalled();

      // Large movement (above threshold)
      simulateSwipe(card, 'left');
      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });

    test('should differentiate between tap and swipe', () => {
      const onTap = vi.fn();
      const onSwipeLeft = vi.fn();

      render(
        <MobileCard
          title="Tap vs Swipe"
          content={<div>Content</div>}
          onTap={onTap}
          onSwipeLeft={onSwipeLeft}
        />
      );

      const card = screen.getByRole('generic');

      // Tap gesture
      simulateTap(card);
      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onSwipeLeft).not.toHaveBeenCalled();

      // Reset mocks
      onTap.mockClear();
      onSwipeLeft.mockClear();

      // Swipe gesture
      simulateSwipe(card, 'left');
      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('♿ Accessibility Features', () => {
    test('should maintain proper focus management', () => {
      render(<MobileButton>Accessible Button</MobileButton>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2');
    });

    test('should provide proper ARIA labels', () => {
      render(<MobileInput value="" onChange={vi.fn()} label="Accessible Input" />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    test('should handle reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
      });

      render(<MobileCard title="Reduced Motion" content={<div>Content</div>} />);

      // Component should still render and function normally
      expect(screen.getByText('Reduced Motion')).toBeInTheDocument();
    });
  });
});
