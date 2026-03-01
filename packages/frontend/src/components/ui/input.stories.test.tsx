import { composeStories } from '@storybook/react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import * as stories from './input.stories';

const { CreatorUsername, LightningPayment, LoadingState } = composeStories(stories);

describe('Input Component Stories', () => {
  it('CreatorUsername renders correctly', () => {
    render(<CreatorUsername />);
    const input = screen.getByPlaceholderText(/enter your creator username/i);
    expect(input).toBeInTheDocument();
  });

  it('LightningPayment renders correctly', () => {
    render(<LightningPayment />);
    const input = screen.getByPlaceholderText('10000');
    expect(input).toBeInTheDocument();
  });

  it('Loading state disables input', () => {
    render(<LoadingState />);
    const input = screen.getByDisplayValue('checking_username');
    expect(input).toBeDisabled();
  });
});
