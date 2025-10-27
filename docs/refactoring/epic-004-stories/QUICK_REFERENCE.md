# Quick Reference Guide: Epic 004 - State Management Boundaries

## Story Lookup

### Phase 1: Audit & Guidelines (Foundation)
| Story ID | Title | Duration | Dependencies |
|----------|-------|----------|--------------|
| #001 | Audit Redux Store Structure | 3-4h | None |
| #002 | Audit React Query Usage | 3-4h | None |
| #003 | Create State Management Decision Tree | 2-3h | #001, #002 |
| #004 | Design State Architecture Diagrams | 3-4h | #001, #002, #003 |
| #005 | Team Guidelines Review Session | 2h | #001, #002, #003, #004 |

### Phase 2: Server Data Migration
| Story ID | Title | Duration | Dependencies |
|----------|-------|----------|--------------|
| #006 | Create React Query Hooks for Creators | 3-4h | #005 |
| #007 | Create React Query Hooks for Content | 3-4h | #005 |
| #008 | Create React Query Hooks for Payments | 3-4h | #005 |
| #009 | Remove Server Data from Redux Slices | 2-3h | #006, #007, #008 |
| #010 | Update Components to Use React Query | 4h | #009 |
| #011 | Implement Caching Strategies | 3h | #010 |
| #012 | Implement Error Handling for React Query | 3-4h | #010, #011 |

### Phase 3: Client State Consolidation
| Story ID | Title | Duration | Dependencies |
|----------|-------|----------|--------------|
| #013 | Consolidate UI State in Redux | 3-4h | #005 |
| #014 | Remove UI State from React Query | 2h | #013 |
| #015 | Update Theme and Modal Management | 3h | #013, #014 |
| #016 | Update Notification System | 3h | #015 |
| #017 | Update Form State Management | 3-4h | #016 |

### Phase 4: Testing & Validation
| Story ID | Title | Duration | Dependencies |
|----------|-------|----------|--------------|
| #018 | Integration Tests for Data Flow | 3-4h | #012, #017 |
| #019 | Performance Benchmarking | 2-3h | #018 |
| #020 | Cache Hit Rate Validation | 2-3h | #019 |
| #021 | Bundle Size Impact Check | 2h | #020 |
| #022 | End-to-End Test Coverage | 3-4h | #021 |

### Phase 5: Documentation & Training
| Story ID | Title | Duration | Dependencies |
|----------|-------|----------|--------------|
| #023 | Create Developer Guidelines Document | 3-4h | #022 |
| #024 | Create Training Workshop Materials | 4h | #023 |
| #025 | Create Architecture Decision Record | 2h | #024 |

## Decision Tree: When to Use Redux vs React Query

```
┌─────────────────────────────────────────────────┐
│     Is this data from an external source?      │
│          (API, WebSocket, NOSTR)                │
└───────────┬─────────────────────────────────────┘
            │
     ┌──────▼──────┐
     │    YES      │
     └──────┬──────┘
            │
            ▼
    ┌──────────────────┐
    │ USE REACT QUERY  │
    │                  │
    │ - Server state   │
    │ - API caching    │
    │ - Real-time data │
    │ - Optimistic     │
    │   updates        │
    └──────────────────┘

     ┌──────▼──────┐
     │     NO      │
     └──────┬──────┘
            │
            ▼
┌─────────────────────────────────────────────────┐
│        Is this UI/presentation state?           │
│    (theme, modals, notifications, sidebar)      │
└───────────┬─────────────────────────────────────┘
            │
     ┌──────▼──────┐
     │    YES      │
     └──────┬──────┘
            │
            ▼
    ┌──────────────────┐
    │   USE REDUX      │
    │                  │
    │ - UI state       │
    │ - Theme          │
    │ - Modals         │
    │ - Notifications  │
    └──────────────────┘

     ┌──────▼──────┐
     │     NO      │
     └──────┬──────┘
            │
            ▼
┌─────────────────────────────────────────────────┐
│   Does this need to persist across refreshes?  │
│        (user preferences, settings)             │
└───────────┬─────────────────────────────────────┘
            │
     ┌──────▼──────┐
     │    YES      │
     └──────┬──────┘
            │
            ▼
    ┌──────────────────────┐
    │ USE REDUX +          │
    │ LOCALSTORAGE         │
    │                      │
    │ - Preferences        │
    │ - Settings           │
    │ - Session data       │
    └──────────────────────┘

     ┌──────▼──────┐
     │     NO      │
     └──────┬──────┘
            │
            ▼
┌─────────────────────────────────────────────────┐
│   Is this shared across multiple components?   │
└───────────┬─────────────────────────────────────┘
            │
     ┌──────▼──────┐
     │    YES      │
     └──────┬──────┘
            │
            ▼
    ┌──────────────────┐
    │   USE REDUX      │
    │   or CONTEXT     │
    │                  │
    │ - Shared state   │
    │ - Global flags   │
    └──────────────────┘

     ┌──────▼──────┐
     │     NO      │
     └──────┬──────┘
            │
            ▼
    ┌──────────────────┐
    │ USE LOCAL STATE  │
    │   (useState)     │
    │                  │
    │ - Form inputs    │
    │ - Toggles        │
    │ - Component UI   │
    └──────────────────┘
```

## Code Examples Cheat Sheet

### React Query: Fetching Server Data

```typescript
// ✅ DO: Use React Query for server data
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch list of items
const useCreators = () => {
  return useQuery({
    queryKey: ['creators'],
    queryFn: () => api.creators.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Fetch single item
const useCreator = (id: string) => {
  return useQuery({
    queryKey: ['creator', id],
    queryFn: () => api.creators.get(id),
    enabled: !!id,
  });
};

// Mutation with cache invalidation
const useUpdateCreator = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.creators.update,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['creators']);
      queryClient.invalidateQueries(['creator', variables.id]);
    },
  });
};

// Usage in component
const CreatorList = () => {
  const { data: creators, isLoading, error } = useCreators();
  const updateMutation = useUpdateCreator();

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  const handleUpdate = (id, data) => {
    updateMutation.mutate({ id, ...data });
  };

  return <List items={creators} onUpdate={handleUpdate} />;
};
```

### Redux: Managing UI State

```typescript
// ✅ DO: Use Redux for UI state
import { createSlice } from '@reduxjs/toolkit';
import { useSelector, useDispatch } from 'react-redux';

// Define slice
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: 'light',
    sidebarOpen: true,
    activeModal: null,
    notifications: [],
  },
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    openModal: (state, action) => {
      state.activeModal = action.payload;
    },
    closeModal: (state) => {
      state.activeModal = null;
    },
    addNotification: (state, action) => {
      state.notifications.push(action.payload);
    },
  },
});

export const uiActions = uiSlice.actions;
export default uiSlice.reducer;

// Usage in component
const Header = () => {
  const theme = useSelector((state) => state.ui.theme);
  const dispatch = useDispatch();

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    dispatch(uiActions.setTheme(newTheme));
  };

  return (
    <header>
      <button onClick={toggleTheme}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </header>
  );
};
```

### Local State: Component-Specific

```typescript
// ✅ DO: Use local state for simple forms
import { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.contact.send(formData);
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.name}
        onChange={(e) => handleChange('name', e.target.value)}
      />
      {/* More fields */}
    </form>
  );
};
```

## Anti-Patterns to Avoid

### ❌ DON'T: Server Data in Redux

```typescript
// ❌ BAD: Don't fetch server data with Redux
const creatorsSlice = createSlice({
  name: 'creators',
  initialState: { list: [], loading: false },
  reducers: {
    setLoading: (state) => { state.loading = true; },
    setCreators: (state, action) => {
      state.list = action.payload;
      state.loading = false;
    },
  },
});

export const fetchCreators = () => async (dispatch) => {
  dispatch(creatorsSlice.actions.setLoading());
  const data = await api.creators.list();
  dispatch(creatorsSlice.actions.setCreators(data));
};

// ✅ GOOD: Use React Query instead
const useCreators = () => {
  return useQuery(['creators'], () => api.creators.list());
};
```

### ❌ DON'T: UI State in React Query

```typescript
// ❌ BAD: Don't use React Query for UI state
const { data: theme } = useQuery(['theme'], () => localStorage.getItem('theme'));

queryClient.setQueryData(['modal-open'], true);

// ✅ GOOD: Use Redux instead
const theme = useSelector((state) => state.ui.theme);
const dispatch = useDispatch();
dispatch(uiActions.setTheme('dark'));
```

### ❌ DON'T: Duplicate State

```typescript
// ❌ BAD: Don't store the same data in both
const user = useSelector((state) => state.auth.user);
const { data: userProfile } = useQuery(['user', userId], () => api.users.get(userId));
// These are the same data!

// ✅ GOOD: Choose one source
// Option 1: If it's from server
const { data: user } = useQuery(['user', userId], () => api.users.get(userId));

// Option 2: If it's session/client data
const user = useSelector((state) => state.auth.user);
```

## Common Scenarios

### Scenario 1: User Authentication

```typescript
// ✅ Store session in Redux (client state)
const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, token: null, isAuthenticated: false },
  reducers: {
    setAuth: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },
  },
});

// ✅ Fetch user profile with React Query (server data)
const useUserProfile = (userId: string) => {
  return useQuery(['user-profile', userId], () => api.users.getProfile(userId));
};
```

### Scenario 2: Theme Management

```typescript
// ✅ Redux for theme (UI state with persistence)
const uiSlice = createSlice({
  name: 'ui',
  initialState: { theme: localStorage.getItem('theme') || 'light' },
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
      document.documentElement.setAttribute('data-theme', action.payload);
    },
  },
});
```

### Scenario 3: Content Feed with Real-Time Updates

```typescript
// ✅ React Query for content (server data with real-time)
const useContentFeed = () => {
  return useQuery({
    queryKey: ['content-feed'],
    queryFn: () => api.content.getFeed(),
    refetchInterval: 30000, // Refresh every 30s
    staleTime: 10000, // Consider stale after 10s
  });
};

// ✅ Redux for UI filters (client state)
const contentSlice = createSlice({
  name: 'content',
  initialState: { selectedView: 'grid', filters: {} },
  reducers: {
    setView: (state, action) => {
      state.selectedView = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
  },
});
```

### Scenario 4: Multi-Step Form

```typescript
// ✅ Redux for complex multi-step form (client state)
const formSlice = createSlice({
  name: 'multiStepForm',
  initialState: { currentStep: 0, data: {} },
  reducers: {
    nextStep: (state) => { state.currentStep++; },
    previousStep: (state) => { state.currentStep--; },
    updateData: (state, action) => {
      state.data = { ...state.data, ...action.payload };
    },
  },
});

// ✅ React Query for final submission (server interaction)
const useSubmitForm = () => {
  return useMutation({
    mutationFn: (data) => api.forms.submit(data),
    onSuccess: () => {
      // Clear form after successful submission
      dispatch(formActions.reset());
    },
  });
};
```

## Performance Optimization Quick Tips

### React Query Caching

```typescript
// Configure global defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      refetchOnWindowFocus: true,
    },
  },
});

// Override for specific queries
const useCreators = () => {
  return useQuery({
    queryKey: ['creators'],
    queryFn: () => api.creators.list(),
    staleTime: 1 * 60 * 1000, // 1 minute - fresher data
  });
};

const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => api.users.getProfile(userId),
    staleTime: 15 * 60 * 1000, // 15 minutes - less volatile
  });
};
```

### Redux Performance

```typescript
// Use selectors with memoization
import { createSelector } from '@reduxjs/toolkit';

const selectCreators = (state) => state.creators;
const selectFilters = (state) => state.filters;

const selectFilteredCreators = createSelector(
  [selectCreators, selectFilters],
  (creators, filters) => {
    // Expensive filtering logic
    return creators.filter(/* ... */);
  }
);

// Use in component
const filteredCreators = useSelector(selectFilteredCreators);
```

## Testing Quick Reference

### Testing React Query Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

test('useCreators fetches data', async () => {
  const { result } = renderHook(() => useCreators(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(10);
});
```

### Testing Redux Slices

```typescript
import { configureStore } from '@reduxjs/toolkit';
import uiReducer, { uiActions } from './uiSlice';

test('theme toggle works', () => {
  const store = configureStore({ reducer: { ui: uiReducer } });

  expect(store.getState().ui.theme).toBe('light');

  store.dispatch(uiActions.setTheme('dark'));
  expect(store.getState().ui.theme).toBe('dark');
});
```

## Migration Checklist

When migrating existing code:

- [ ] Identify if state is server data or client state
- [ ] Choose appropriate state management tool
- [ ] Create React Query hook OR Redux slice
- [ ] Update component to use new state source
- [ ] Add proper error handling
- [ ] Configure caching/persistence
- [ ] Write tests for new implementation
- [ ] Remove old state management code
- [ ] Update related components
- [ ] Verify no regressions

## Troubleshooting Guide

### Problem: Stale data in cache

**Solution**: Adjust `staleTime` in React Query
```typescript
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 0, // Always fetch fresh data
});
```

### Problem: Too many API calls

**Solution**: Increase `staleTime` and use cache
```typescript
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
});
```

### Problem: Redux state not persisting

**Solution**: Add persistence middleware
```typescript
import { persistStore, persistReducer } from 'redux-persist';

const persistConfig = {
  key: 'root',
  storage: localStorage,
  whitelist: ['ui', 'preferences'], // Only persist these
};
```

### Problem: Component re-rendering too much

**Solution**: Use memoized selectors
```typescript
import { createSelector } from '@reduxjs/toolkit';

const selectMemoizedData = createSelector(
  [selectRawData],
  (data) => expensiveTransform(data)
);
```

## Resources

- [React Query Documentation](https://tanstack.com/query/latest)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [Full Story Breakdown](/docs/refactoring/epic-004-stories/STORY_BREAKDOWN.md)
- [Story Map](/docs/refactoring/epic-004-stories/STORY_MAP.md)
- [Architecture Diagrams](/docs/refactoring/epic-004-stories/architecture-diagrams.mmd)

## Need Help?

1. Check the decision tree above
2. Review code examples for similar scenarios
3. Consult the full story breakdown for detailed implementation
4. Ask in team Slack channel: #state-management
5. Schedule pairing session with tech lead