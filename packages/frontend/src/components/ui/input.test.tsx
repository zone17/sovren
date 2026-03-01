import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Input } from './input';

describe('Input Component', () => {
  it('renders correctly', () => {
    render(<Input placeholder="test" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('has default styling classes', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-input');
  });

  it('applies custom className', () => {
    render(<Input className="custom-class" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-class');
  });

  it('forwards type attribute', () => {
    render(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('handles disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
