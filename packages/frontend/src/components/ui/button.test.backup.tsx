import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './button';

describe('🎨 Button Component - Code of Craft Elite', () => {
  it('renders with modern default styling', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-[#0969da]');
  });
});
