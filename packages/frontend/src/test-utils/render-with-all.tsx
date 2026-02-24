import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

// Real reducers from the store
import uiReducer from '../store/slices/uiSlice';
import cmsUiReducer from '../store/slices/cmsUiSlice';
import userReducer from '../store/slices/userSlice';
import navigationReducer from '../store/slices/navigationSlice';
import layoutReducer from '../store/slices/layoutSlice';
import paginationReducer from '../store/slices/paginationSlice';

import type { RootState } from '../store';

export interface RenderWithAllOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  route?: string;
  queryClient?: QueryClient;
}

export function renderWithAll(ui: ReactElement, options: RenderWithAllOptions = {}) {
  const { preloadedState, route = '/', queryClient: providedClient, ...renderOptions } = options;

  const store = configureStore({
    reducer: {
      ui: uiReducer,
      cmsUi: cmsUiReducer,
      user: userReducer,
      navigation: navigationReducer,
      layout: layoutReducer,
      pagination: paginationReducer,
    },
    preloadedState: preloadedState as RootState,
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
