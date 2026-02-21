import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useBYOK, useBYOKStatus } from '../useBYOK';
import { inboxApi } from '../../services/inboxApi';

vi.mock('../../services/inboxApi', () => ({
  inboxApi: {
    submitBYOK: vi.fn(),
    validateBYOK: vi.fn(),
    revokeBYOK: vi.fn(),
  },
}));

const mockSubmitBYOK = inboxApi.submitBYOK as any;
const mockValidateBYOK = inboxApi.validateBYOK as any;
const mockRevokeBYOK = inboxApi.revokeBYOK as any;

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const validKeys = {
  api_key: 'key',
  api_secret: 'secret',
  access_token: 'token',
  access_token_secret: 'tokensecret',
};

describe('useBYOK', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in idle status', () => {
    const { result } = renderHook(() => useBYOK(), { wrapper: createWrapper() });
    expect(result.current.status).toBe('idle');
  });

  it('transitions to valid status on successful key validation', async () => {
    mockSubmitBYOK.mockResolvedValue({
      data: { valid: true, username: 'testuser' },
    });

    const { result } = renderHook(() => useBYOK(), { wrapper: createWrapper() });

    act(() => {
      result.current.submit(validKeys);
    });

    await waitFor(() => expect(result.current.status).toBe('valid'));
    expect(result.current.validationResult?.username).toBe('testuser');
  });

  it('transitions to write_only status when write-only flag is set', async () => {
    mockSubmitBYOK.mockResolvedValue({
      data: { valid: false, write_only: true },
    });

    const { result } = renderHook(() => useBYOK(), { wrapper: createWrapper() });

    act(() => {
      result.current.submit(validKeys);
    });

    await waitFor(() => expect(result.current.status).toBe('write_only'));
  });

  it('transitions to invalid status on failed validation', async () => {
    mockSubmitBYOK.mockResolvedValue({
      data: { valid: false, error: 'Bad credentials' },
    });

    const { result } = renderHook(() => useBYOK(), { wrapper: createWrapper() });

    act(() => {
      result.current.submit(validKeys);
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
  });

  it('transitions to invalid status on API error', async () => {
    mockSubmitBYOK.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBYOK(), { wrapper: createWrapper() });

    act(() => {
      result.current.submit(validKeys);
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
  });

  it('resets to idle on revoke', async () => {
    mockSubmitBYOK.mockResolvedValue({ data: { valid: true, username: 'u' } });
    mockRevokeBYOK.mockResolvedValue({ data: null });

    const { result } = renderHook(() => useBYOK(), { wrapper: createWrapper() });

    act(() => {
      result.current.submit(validKeys);
    });
    await waitFor(() => expect(result.current.status).toBe('valid'));

    act(() => {
      result.current.revoke();
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
  });

  it('resets to idle when reset() is called', async () => {
    mockSubmitBYOK.mockResolvedValue({
      data: { valid: false, error: 'fail' },
    });

    const { result } = renderHook(() => useBYOK(), { wrapper: createWrapper() });

    act(() => {
      result.current.submit(validKeys);
    });
    await waitFor(() => expect(result.current.status).toBe('invalid'));

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
  });
});

describe('useBYOKStatus', () => {
  it('returns BYOK validation result', async () => {
    mockValidateBYOK.mockResolvedValue({ data: { valid: true, username: 'myuser' } });

    const { result } = renderHook(() => useBYOKStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.username).toBe('myuser');
  });
});
