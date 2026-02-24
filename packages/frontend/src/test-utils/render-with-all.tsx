import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

// Import reducer map from real store — single source of truth
import { reducers, type RootState } from '../store';

export interface RenderWithAllOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  route?: string;
  queryClient?: QueryClient;
}

export interface RenderWithAllResult extends RenderResult {
  store: ReturnType<typeof configureStore>;
  queryClient: QueryClient;
}

export function renderWithAll(
  ui: ReactElement,
  options: RenderWithAllOptions = {}
): RenderWithAllResult {
  const { preloadedState, route = '/', queryClient: providedClient, ...renderOptions } = options;

  const store = configureStore({
    reducer: reducers,
    preloadedState: preloadedState as undefined | RootState,
  });

  const queryClient =
    providedClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
    queryClient,
  };
}
