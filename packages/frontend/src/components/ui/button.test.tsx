import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from './button';

describe('Button Component - Elite CDD Standards', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Button>Test Button</Button>);
      const button = screen.getByRole('button', { name: 'Test Button' });
      expect(button).toBeInTheDocument();
    });

    it('renders with custom children', () => {
      render(<Button>Custom Content</Button>);
      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('applies default variant styling', () => {
      render(<Button variant="default">Default</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary');
    });

    it('applies lightning variant styling', () => {
      render(<Button variant="lightning">Lightning</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-amber-500');
    });

    it('applies sovereign variant styling', () => {
      render(<Button variant="sovereign">Sovereign</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-indigo-500');
    });

    it('applies secondary variant styling', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary');
    });

    it('applies outline variant styling', () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border-input');
    });

    it('applies ghost variant styling', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-muted-foreground');
    });

    it('applies link variant styling', () => {
      render(<Button variant="link">Link</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-primary');
    });
  });

  describe('Sizes', () => {
    it('applies small size styling', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-7');
    });

    it('applies default size styling', () => {
      render(<Button size="default">Default</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8');
    });

    it('applies large size styling', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-9');
    });
  });

  describe('States', () => {
    it('handles disabled state', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // Component properly applies disabled styling
      expect(button).toHaveAttribute('disabled');
    });

    it('is not disabled by default', () => {
      render(<Button>Enabled</Button>);
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Clickable</Button>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible name from children', () => {
      render(<Button>Accessible Button</Button>);
      expect(screen.getByRole('button', { name: 'Accessible Button' })).toBeInTheDocument();
    });

    it('supports custom aria-label', () => {
      render(<Button aria-label="Custom Label">Icon</Button>);
      expect(screen.getByRole('button', { name: 'Custom Label' })).toBeInTheDocument();
    });

    it('indicates disabled state to screen readers', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
    });
  });

  describe('Technical Quality', () => {
    it('forwards refs correctly', () => {
      const ref = { current: null };
      render(<Button ref={ref}>Ref Test</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('spreads additional props', () => {
      render(<Button data-testid="custom-prop">Props Test</Button>);
      expect(screen.getByTestId('custom-prop')).toBeInTheDocument();
    });

    it('maintains consistent styling classes', () => {
      render(<Button>Style Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('rounded-[6px]');
      expect(button).toHaveClass('font-medium');
      expect(button).toHaveClass('text-[13px]');
    });
  });
});
