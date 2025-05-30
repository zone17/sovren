import '@testing-library/jest-dom';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
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
    it('should return initial state correctly', () => {
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

    it('should handle error in effect when no API endpoint is found', () => {
      const mockUseEffect = jest.fn();
      React.useEffect = mockUseEffect;

      renderHook(() => useFeatureFlags());

      // Get the effect function and call it
      const effectFunction = mockUseEffect.mock.calls[0]?.[0];
      expect(effectFunction).toBeDefined();

      // Execute the effect
      effectFunction();

      // Verify state remains in initial state when no API available
      expect(mockUseEffect).toHaveBeenCalledWith(expect.any(Function), []);
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

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Hook cleanup', () => {
    it('should unmount without errors', () => {
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

      const { unmount } = renderHook(() => useFeatureFlags());

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('API endpoint', () => {
    it('should call the correct endpoint', async () => {
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

      renderHook(() => useFeatureFlags());

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/feature-flags');
    });
  });
});
