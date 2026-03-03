/**
 * Integration tests for wellnessApi — exercises the full chain:
 *   hook / direct call → wellnessApi → apiClient → MSW handler
 *
 * Tests 3 representative methods:
 *   1. getRiskScore   — simple GET
 *   2. getPulseHistory — parameterized GET
 *   3. submitPulse    — mutation POST
 *
 * MSW intercepts at the network level so no mocking of apiClient is needed.
 *
 * NOTE: VITE_API_URL = 'http://localhost:3000/api' in tests.
 * apiClient sends: http://localhost:3000/api/api/v2/wellness/...
 * In-test server.use() overrides MUST use '*' wildcard prefix to match.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../test-utils/msw/server';
import { wellnessApi } from '../services/wellnessApi';
import { useBurnoutScore } from '../hooks/useBurnoutScore';
import { useSubmitPulse, useWellnessPulseHistory } from '../hooks/useWellnessPulse';
import apiClient from '../../../services/api/apiClient';

const BASE = '/api/v2/wellness';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
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

afterEach(() => {
  apiClient.setToken(null);
});

// --- 1. getRiskScore — simple GET ---

describe('wellnessApi.getRiskScore (integration)', () => {
  it('fetches /api/v2/wellness/risk-score and returns ApiResponse envelope', async () => {
    const result = await wellnessApi.getRiskScore();

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ score: 35, level: 'low' });
  });

  it('propagates error when server returns non-2xx', async () => {
    server.use(
      http.get('*' + BASE + '/risk-score', () => {
        return HttpResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      })
    );

    await expect(wellnessApi.getRiskScore()).rejects.toThrow();
  });

  it('useBurnoutScore hook selects data.data through full chain', async () => {
    const qc = freshClient();
    const { result } = renderHook(() => useBurnoutScore(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the select: (res) => res.data transform happened
    expect(result.current.data).toMatchObject({ score: 35, level: 'low' });
    expect((result.current.data as { success?: boolean }).success).toBeUndefined();
  });

  it('sends Authorization header when token is set', async () => {
    let capturedAuthHeader: string | null = null;

    server.use(
      http.get('*' + BASE + '/risk-score', ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization');
        return HttpResponse.json({ success: true, data: { score: 35, level: 'low' } });
      })
    );

    apiClient.setToken('test-bearer-token');
    await wellnessApi.getRiskScore();

    expect(capturedAuthHeader).toBe('Bearer test-bearer-token');
  });
});

// --- 2. getPulseHistory — parameterized GET ---

describe('wellnessApi.getPulseHistory (integration)', () => {
  it('fetches /api/v2/wellness/pulse/history (not /history) with default 90d period', async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get('*' + BASE + '/pulse/history', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ success: true, data: { entries: [], period: '90d' } });
      })
    );

    const result = await wellnessApi.getPulseHistory();

    expect(capturedUrl).toContain('period=90d');
    expect(result.data).toMatchObject({ entries: [], period: '90d' });
  });

  it('passes custom period as query parameter', async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get('*' + BASE + '/pulse/history', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ success: true, data: { entries: [], period: '30d' } });
      })
    );

    await wellnessApi.getPulseHistory('30d');

    expect(capturedUrl).toContain('period=30d');
  });

  it('passes pagination params when provided', async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get('*' + BASE + '/pulse/history', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ success: true, data: { entries: [], period: '90d' } });
      })
    );

    await wellnessApi.getPulseHistory('90d', { limit: 10, offset: 20 });

    expect(capturedUrl).toContain('limit=10');
    expect(capturedUrl).toContain('offset=20');
  });

  it('useWellnessPulseHistory hook selects data through full chain', async () => {
    const qc = freshClient();
    const { result } = renderHook(() => useWellnessPulseHistory('90d'), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ entries: [], period: '90d' });
  });
});

// --- 3. submitPulse — mutation POST ---

describe('wellnessApi.submitPulse (integration)', () => {
  it('POSTs to /api/v2/wellness/pulse with the payload', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post('*' + BASE + '/pulse', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          success: true,
          data: { id: 'pulse-1', energy: 8, motivation: 7, stress: 3, created_at: '2026-01-01' },
        });
      })
    );

    const payload = { energy: 8, motivation: 7, stress: 3 };
    const result = await wellnessApi.submitPulse(payload);

    expect(capturedBody).toEqual(payload);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ id: 'pulse-1' });
  });

  it('useSubmitPulse hook invalidates risk-score after successful submission', async () => {
    // Use a client with gcTime:60s so entries survive without active observers
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 60_000, staleTime: 0 },
        mutations: { retry: false },
      },
    });

    // Pre-populate risk-score in cache
    qc.setQueryData(['wellness', 'risk-score'], { success: true, data: { score: 35 } });

    const { result } = renderHook(() => useSubmitPulse(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ energy: 8, motivation: 7, stress: 3 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(qc.getQueryState(['wellness', 'risk-score'])?.isInvalidated).toBe(true);
  });

  it('returns error on failed submission', async () => {
    server.use(
      http.post('*' + BASE + '/pulse', () => {
        return HttpResponse.json({ success: false, error: 'Validation error' }, { status: 422 });
      })
    );

    await expect(
      wellnessApi.submitPulse({ energy: 0, motivation: 0, stress: 0 })
    ).rejects.toThrow();
  });
});
