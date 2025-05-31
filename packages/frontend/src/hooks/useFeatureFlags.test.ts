import '@testing-library/jest-dom';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlags } from './useFeatureFlags';

// Mock fetch
const mockFetch = jest.fn();
Object.defineProperty(window, 'fetch', {
  value: mockFetch,
  writable: true,
});

describe('useFeatureFlags', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should return initial state correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            enablePayments: false,
            enableAIRecommendations: false,
            enableNostrIntegration: false,
            enableExperimentalUI: false,
          }),
      });

      const { result } = renderHook(() => useFeatureFlags());

      expect(result.current.flags).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();

      // Wait for the effect to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Successful API calls', () => {
    it('should fetch and set feature flags correctly', async () => {
      const mockFlags = {
        enablePayments: true,
        enableAIRecommendations: false,
        enableNostrIntegration: true,
        enableExperimentalUI: false,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFlags),
      });

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags).toEqual(mockFlags);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('/api/feature-flags');
    });

    it('should handle all flags being enabled', async () => {
      const mockFlags = {
        enablePayments: true,
        enableAIRecommendations: true,
        enableNostrIntegration: true,
        enableExperimentalUI: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFlags),
      });

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags).toEqual(mockFlags);
    });

    it('should handle all flags being disabled', async () => {
      const mockFlags = {
        enablePayments: false,
        enableAIRecommendations: false,
        enableNostrIntegration: false,
        enableExperimentalUI: false,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFlags),
      });

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags).toEqual(mockFlags);
    });
  });

  describe('Error handling', () => {
    it('should handle fetch network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags).toBeNull();
      expect(result.current.error).toBe('Network error');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags).toBeNull();
      expect(result.current.error).toBe('Failed to fetch feature flags');
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags).toBeNull();
      expect(result.current.error).toBe('Invalid JSON');
    });

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValue('String error');

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags).toBeNull();
      expect(result.current.error).toBe('String error');
    });
  });

  describe('Loading states', () => {
    it('should start in loading state and finish when complete', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            enablePayments: true,
            enableAIRecommendations: false,
            enableNostrIntegration: true,
            enableExperimentalUI: false,
          }),
      });

      const { result } = renderHook(() => useFeatureFlags());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.flags).not.toBeNull();
    });

    it('should handle loading to error state transition', async () => {
      mockFetch.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useFeatureFlags());

      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Server error');
      expect(result.current.flags).toBeNull();
    });
  });

  describe('Feature flag properties', () => {
    it('should return correct flag structure', async () => {
      const mockFlags = {
        enablePayments: true,
        enableAIRecommendations: false,
        enableNostrIntegration: true,
        enableExperimentalUI: false,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFlags),
      });

      const { result } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(result.current.flags).toEqual(mockFlags);
      });

      // Test individual flag properties
      expect(result.current.flags?.enablePayments).toBe(true);
      expect(result.current.flags?.enableAIRecommendations).toBe(false);
      expect(result.current.flags?.enableNostrIntegration).toBe(true);
      expect(result.current.flags?.enableExperimentalUI).toBe(false);
    });
  });

  describe('API endpoint configuration', () => {
    it('should call the correct API endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            enablePayments: false,
            enableAIRecommendations: false,
            enableNostrIntegration: false,
            enableExperimentalUI: false,
          }),
      });

      renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/feature-flags');
      });
    });

    it('should only call API once on mount', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            enablePayments: false,
            enableAIRecommendations: false,
            enableNostrIntegration: false,
            enableExperimentalUI: false,
          }),
      });

      const { rerender } = renderHook(() => useFeatureFlags());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Rerender shouldn't trigger additional API calls
      rerender();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });
  });
});
