import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import WellnessResources from '../WellnessResources';

describe('WellnessResources', () => {
  it('renders all resources by default', () => {
    render(<WellnessResources />);
    expect(screen.getByText('Wellness Resources')).toBeInTheDocument();
    expect(screen.getByText('Creator Burnout Recovery Group')).toBeInTheDocument();
    expect(screen.getByText('The Sustainable Creator')).toBeInTheDocument();
    expect(screen.getByText('Focus Timer for Creators')).toBeInTheDocument();
    expect(screen.getByText('Creator Mental Health Hotline')).toBeInTheDocument();
  });

  it('filters by category', () => {
    render(<WellnessResources />);

    fireEvent.click(screen.getByText('Tool'));

    expect(screen.getByText('Focus Timer for Creators')).toBeInTheDocument();
    expect(screen.getByText('Batch Content Planner')).toBeInTheDocument();
    expect(screen.queryByText('Creator Burnout Recovery Group')).not.toBeInTheDocument();
  });

  it('shows all when All filter selected', () => {
    render(<WellnessResources />);

    fireEvent.click(screen.getByText('Tool'));
    fireEvent.click(screen.getByText('All'));

    expect(screen.getByText('Creator Burnout Recovery Group')).toBeInTheDocument();
    expect(screen.getByText('Focus Timer for Creators')).toBeInTheDocument();
  });

  it('renders external links with correct attributes', () => {
    render(<WellnessResources />);
    const links = screen.getAllByText('Visit resource');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('accepts initial category prop', () => {
    render(<WellnessResources category="crisis" />);
    expect(screen.getByText('Creator Mental Health Hotline')).toBeInTheDocument();
    expect(screen.getByText('Crisis Text Line')).toBeInTheDocument();
    expect(screen.queryByText('Focus Timer for Creators')).not.toBeInTheDocument();
  });
});
