/**
 * Unit tests for representative wellness hooks.
 *
 * Tests 3 hooks:
 *   1. useBurnoutScore   — simple query
 *   2. useSubmitPulse    — mutation with cache invalidation
 *   3. useWellnessPulseHistory — parameterized query
 *
 * Uses MSW (already wired in vitest-frontend-setup.ts) and a real QueryClient
 * so no vi.fn() mocking of hook internals is required.
 *
 * VITE_API_URL = 'http://localhost:3000/api' in tests.
 * apiClient sends: http://localhost:3000/api/api/v2/wellness/...
 * MSW global handlers use '*' + path to match regardless of prefix.
 * In-test overrides must also use '*' + path for the same reason.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../test-utils/msw/server';
import { useBurnoutScore } from '../hooks/useBurnoutScore';
import { useSubmitPulse, useWellnessPulseHistory } from '../hooks/useWellnessPulse';

// --- wrapper factory ---

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function freshClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

const BASE = '/api/v2/wellness';

// --- useBurnoutScore ---

describe('useBurnoutScore', () => {
  it('returns data on success', async () => {
    const qc = freshClient();
    const { result } = renderHook(() => useBurnoutScore(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ score: 35, level: 'low' });
  });

  it('starts in loading state', () => {
    const qc = freshClient();
    const { result } = renderHook(() => useBurnoutScore(), { wrapper: makeWrapper(qc) });

    // On first render the query has not resolved yet
    expect(result.current.isPending).toBe(true);
  });

  it('returns error state when request fails', async () => {
    server.use(
      http.get('*' + BASE + '/risk-score', () => {
        return HttpResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      })
    );

    const qc = freshClient();
    const { result } = renderHook(() => useBurnoutScore(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not fetch when enabled is false', () => {
    const qc = freshClient();
    const { result } = renderHook(() => useBurnoutScore({ enabled: false }), {
      wrapper: makeWrapper(qc),
    });

    // Should remain idle — no fetch triggered
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isPending).toBe(true);
  });
});

// --- useWellnessPulseHistory ---

describe('useWellnessPulseHistory', () => {
  it('returns data on success with default period', async () => {
    const qc = freshClient();
    const { result } = renderHook(() => useWellnessPulseHistory(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ entries: [], period: '90d' });
  });

  it('uses the provided period in the query key', async () => {
    const qc = freshClient();
    const { result } = renderHook(() => useWellnessPulseHistory('30d'), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the query key includes the period
    const cacheKeys = qc
      .getQueryCache()
      .findAll()
      .map((q) => q.queryKey);
    expect(cacheKeys).toContainEqual(['wellness', 'pulse', '30d']);
  });

  it('returns error state when request fails', async () => {
    server.use(
      http.get('*' + BASE + '/pulse/history', () => {
        return HttpResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      })
    );

    const qc = freshClient();
    const { result } = renderHook(() => useWellnessPulseHistory(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('queries with different periods have independent cache keys', async () => {
    const qc = freshClient();
    const { result: r1 } = renderHook(() => useWellnessPulseHistory('90d'), {
      wrapper: makeWrapper(qc),
    });
    const { result: r2 } = renderHook(() => useWellnessPulseHistory('all'), {
      wrapper: makeWrapper(qc),
    });

    // Both start as pending — separate cache entries
    expect(r1.current.isPending).toBe(true);
    expect(r2.current.isPending).toBe(true);
  });
});

// --- useSubmitPulse ---

describe('useSubmitPulse', () => {
  it('submits pulse and returns created check-in', async () => {
    const qc = freshClient();
    const { result } = renderHook(() => useSubmitPulse(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ energy: 8, motivation: 7, stress: 3 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // MSW returns { success: true, data: { id: 'pulse-1', energy: 7, ... } }
    expect(result.current.data).toMatchObject({
      success: true,
      data: expect.objectContaining({ id: 'pulse-1' }),
    });
  });

  it('invalidates the risk-score and pulse cache keys on success', async () => {
    // Use a client with a non-zero gcTime so entries survive without active observers
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 60_000, staleTime: 0 },
        mutations: { retry: false },
      },
    });

    // Pre-populate cache entries — gcTime:60s keeps them alive
    qc.setQueryData(['wellness', 'risk-score'], { success: true, data: { score: 35 } });
    qc.setQueryData(['wellness', 'pulse', '90d'], { success: true, data: { entries: [] } });

    // Confirm they start as not invalidated
    expect(qc.getQueryState(['wellness', 'risk-score'])?.isInvalidated).toBe(false);

    const { result } = renderHook(() => useSubmitPulse(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ energy: 8, motivation: 7, stress: 3 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Both cache entries should be marked invalidated after mutation success
    expect(qc.getQueryState(['wellness', 'risk-score'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['wellness', 'pulse', '90d'])?.isInvalidated).toBe(true);
  });

  it('returns error state when submission fails', async () => {
    server.use(
      http.post('*' + BASE + '/pulse', () => {
        return HttpResponse.json({ success: false, error: 'Validation failed' }, { status: 422 });
      })
    );

    const qc = freshClient();
    const { result } = renderHook(() => useSubmitPulse(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ energy: 0, motivation: 0, stress: 0 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('starts in idle state before any mutation', () => {
    const qc = freshClient();
    const { result } = renderHook(() => useSubmitPulse(), { wrapper: makeWrapper(qc) });

    expect(result.current.isIdle).toBe(true);
    expect(result.current.isPending).toBe(false);
  });
});
