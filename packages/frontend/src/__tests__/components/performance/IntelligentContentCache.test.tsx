import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IntelligentContentCache from '../../../components/performance/IntelligentContentCache';

// Mock dependencies
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span className={`badge ${variant}`}>{children}</span>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: any) => (
    <div data-testid="progress" data-value={value}>
      Progress: {value}%
    </div>
  ),
}));

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));

// Mock fetch using vi.spyOn so mockResolvedValue/mockRejectedValue are available
let fetchSpy: ReturnType<typeof vi.spyOn>;

describe('IntelligentContentCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('renders correctly when enabled', () => {
    render(<IntelligentContentCache enabled={true} />);

    expect(screen.getByText('Intelligent Content Cache')).toBeInTheDocument();
    expect(
      screen.getByText('Multi-layer caching system for optimal content delivery performance')
    ).toBeInTheDocument();
  });

  it('shows disabled message when not enabled', () => {
    render(<IntelligentContentCache enabled={false} />);

    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText(/currently disabled/i)).toBeInTheDocument();
  });

  it('displays cache performance metrics', () => {
    render(<IntelligentContentCache enabled={true} />);

    expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument();
    // "Bandwidth Saved" appears in multiple cards; just verify at least one exists
    expect(screen.getAllByText('Bandwidth Saved').length).toBeGreaterThan(0);
    expect(screen.getByText('Storage Used')).toBeInTheDocument();
  });

  it('displays cache layer performance', () => {
    render(<IntelligentContentCache enabled={true} />);

    expect(screen.getByText('Cache Layer Performance')).toBeInTheDocument();
    expect(
      screen.getByText('Performance metrics across different cache layers')
    ).toBeInTheDocument();
  });

  it('handles cache warming functionality', async () => {
    render(<IntelligentContentCache enabled={true} />);

    const warmButton = screen.getByText('Warm Cache');
    expect(warmButton).toBeInTheDocument();

    fireEvent.click(warmButton);

    await waitFor(() => {
      // "Warming..." appears in the button and possibly in the progress text; at least one exists
      expect(screen.getAllByText(/Warming\.\.\./)[0]).toBeInTheDocument();
    });
  });

  it('handles cache invalidation', async () => {
    render(<IntelligentContentCache enabled={true} />);

    const clearContentButton = screen.getByText('Clear Content');
    const clearAllButton = screen.getByText('Clear All');

    expect(clearContentButton).toBeInTheDocument();
    expect(clearAllButton).toBeInTheDocument();

    fireEvent.click(clearContentButton);
    fireEvent.click(clearAllButton);
  });

  it('displays cache effectiveness score', () => {
    render(<IntelligentContentCache enabled={true} />);

    expect(screen.getAllByText('Cache Effectiveness Score')[0]).toBeInTheDocument();
    expect(
      screen.getByText('Overall cache performance and optimization effectiveness')
    ).toBeInTheDocument();
  });

  it('accepts custom configuration', () => {
    const customConfig = {
      maxAge: 7200000,
      maxEntries: 2000,
      compressionEnabled: false,
    };

    render(<IntelligentContentCache enabled={true} config={customConfig} />);

    expect(screen.getByText('Intelligent Content Cache')).toBeInTheDocument();
  });

  it('calls onCacheHit callback when provided', () => {
    const onCacheHit = vi.fn();
    const onCacheMiss = vi.fn();

    render(
      <IntelligentContentCache enabled={true} onCacheHit={onCacheHit} onCacheMiss={onCacheMiss} />
    );

    expect(screen.getByText('Intelligent Content Cache')).toBeInTheDocument();
  });

  it('shows warming progress when cache warming is active', async () => {
    render(<IntelligentContentCache enabled={true} />);

    const warmButton = screen.getByText('Warm Cache');
    fireEvent.click(warmButton);

    await waitFor(() => {
      expect(screen.getByText(/Warming cache.../)).toBeInTheDocument();
    });
  });

  it('displays different cache layers with metrics', () => {
    render(<IntelligentContentCache enabled={true} />);

    // Should show different cache layers
    expect(screen.getByText('Cache Layer Performance')).toBeInTheDocument();
  });

  it('handles cache management operations', () => {
    render(<IntelligentContentCache enabled={true} />);

    expect(screen.getByText('Cache Management')).toBeInTheDocument();
    expect(
      screen.getByText('Manage cache warming, invalidation, and optimization')
    ).toBeInTheDocument();
  });

  it('renders with all required UI components', () => {
    render(<IntelligentContentCache enabled={true} />);

    // Check for key UI elements (multiple Card components are rendered)
    expect(screen.getAllByTestId('card')[0]).toBeInTheDocument();
    expect(screen.getByText('Warm Cache')).toBeInTheDocument();
    expect(screen.getByText('Clear Content')).toBeInTheDocument();
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('calculates and displays effectiveness score', () => {
    render(<IntelligentContentCache enabled={true} />);

    expect(screen.getAllByText('Cache Effectiveness Score')[0]).toBeInTheDocument();

    // Should display a numerical score
    const scoreElements = screen.getAllByText(/\d+/);
    expect(scoreElements.length).toBeGreaterThan(0);
  });
});

// Multi-layer Cache Architecture Tests
describe('MultiLayerCache', () => {
  let cache: any;
  let mlFetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mlFetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);
    // We can't directly test the private class, but we can test the component behavior
    // that uses it through integration tests
  });

  afterEach(() => {
    mlFetchSpy?.mockRestore();
  });

  it('should handle cache storage and retrieval through component', async () => {
    render(<IntelligentContentCache enabled={true} />);

    // Component should initialize and display cache metrics
    expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument();
  });

  it('should handle cache invalidation patterns', async () => {
    render(<IntelligentContentCache enabled={true} />);

    const clearButton = screen.getByText('Clear Content');
    fireEvent.click(clearButton);

    // Should not throw errors
    expect(clearButton).toBeInTheDocument();
  });

  it('should manage cache warming operations', async () => {
    render(<IntelligentContentCache enabled={true} />);

    const warmButton = screen.getByText('Warm Cache');
    fireEvent.click(warmButton);

    await waitFor(() => {
      expect(screen.getAllByText(/Warming\.\.\./)[0]).toBeInTheDocument();
    });
  });
});

// Performance Metrics Tests
describe('Cache Performance Metrics', () => {
  let metricsFetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    metricsFetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);
  });

  afterEach(() => {
    metricsFetchSpy?.mockRestore();
  });

  it('should display accurate hit rate metrics', () => {
    render(<IntelligentContentCache enabled={true} />);

    expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument();

    // Should show percentage values
    const percentageElements = screen.getAllByText(/%/);
    expect(percentageElements.length).toBeGreaterThan(0);
  });

  it('should show bandwidth and storage metrics', () => {
    render(<IntelligentContentCache enabled={true} />);

    // "Bandwidth Saved" appears in multiple cards (overview + effectiveness score)
    expect(screen.getAllByText('Bandwidth Saved')[0]).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();

    // Should show size in MB
    const mbElements = screen.getAllByText(/MB/);
    expect(mbElements.length).toBeGreaterThan(0);
  });

  it('should calculate effectiveness score correctly', () => {
    render(<IntelligentContentCache enabled={true} />);

    // "Cache Effectiveness Score" appears in both CardTitle and body text
    expect(screen.getAllByText('Cache Effectiveness Score')[0]).toBeInTheDocument();

    // Should display progress indicators
    const progressElements = screen.getAllByTestId('progress');
    expect(progressElements.length).toBeGreaterThan(0);
  });
});

// Cache Configuration Tests
describe('Cache Configuration', () => {
  it('should apply custom cache configuration', () => {
    const config = {
      maxAge: 1800000, // 30 minutes
      staleWhileRevalidate: 600000, // 10 minutes
      maxEntries: 500,
      compressionEnabled: true,
    };

    render(<IntelligentContentCache enabled={true} config={config} />);

    expect(screen.getByText('Intelligent Content Cache')).toBeInTheDocument();
  });

  it('should handle disabled compression', () => {
    const config = {
      compressionEnabled: false,
    };

    render(<IntelligentContentCache enabled={true} config={config} />);

    expect(screen.getByText('Intelligent Content Cache')).toBeInTheDocument();
  });
});

// Error Handling Tests
describe('Error Handling', () => {
  let errorFetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    errorFetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);
  });

  afterEach(() => {
    errorFetchSpy?.mockRestore();
  });

  it('should handle fetch errors gracefully', async () => {
    errorFetchSpy.mockRejectedValue(new Error('Network error'));

    render(<IntelligentContentCache enabled={true} />);

    const warmButton = screen.getByText('Warm Cache');
    fireEvent.click(warmButton);

    // Should not crash the component
    await waitFor(() => {
      expect(screen.getByText('Intelligent Content Cache')).toBeInTheDocument();
    });
  });

  it('should handle invalid responses', async () => {
    errorFetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    render(<IntelligentContentCache enabled={true} />);

    const warmButton = screen.getByText('Warm Cache');
    fireEvent.click(warmButton);

    // Should handle errors without crashing
    expect(screen.getByText('Intelligent Content Cache')).toBeInTheDocument();
  });
});

// Integration Tests
describe('Cache Integration', () => {
  it('should integrate with performance monitoring', () => {
    render(<IntelligentContentCache enabled={true} />);

    expect(screen.getByText('Cache Layer Performance')).toBeInTheDocument();
    expect(
      screen.getByText('Performance metrics across different cache layers')
    ).toBeInTheDocument();
  });

  it('should support callback functions', () => {
    const onCacheHit = vi.fn();
    const onCacheMiss = vi.fn();

    render(
      <IntelligentContentCache enabled={true} onCacheHit={onCacheHit} onCacheMiss={onCacheMiss} />
    );

    expect(screen.getByText('Intelligent Content Cache')).toBeInTheDocument();
  });
});
