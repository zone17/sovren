# Team Guidelines Review - Epic 004

**Date**: 2025-10-26
**Epic**: #004 - State Management Boundaries
**Story**: US-004-005 - Team Guidelines Review Session

## Meeting Agenda

### 1. Current State Analysis (15 min)

- Review Redux audit findings
- Review React Query audit findings
- Discuss pain points and developer friction

### 2. Proposed Architecture (30 min)

- Present decision tree
- Walk through architecture diagrams
- Demonstrate migration examples

### 3. Guidelines Discussion (30 min)

- Review proposed guidelines
- Gather team feedback
- Address concerns

### 4. Implementation Planning (15 min)

- Agree on migration priority
- Assign responsibilities
- Set timeline

## State Management Guidelines v1.0

### Core Principles

#### 1. Separation of Concerns

```
Server State → React Query
Client State → Redux
Component State → useState/useReducer
```

#### 2. No Duplication

- **NEVER** store the same data in both Redux and React Query
- **NEVER** store loading/error states for API calls in Redux
- **NEVER** manually cache API responses in Redux

#### 3. Performance First

- Use appropriate cache times for each data type
- Implement optimistic updates for better UX
- Prefetch predictable user navigation

### Approved Patterns

#### Pattern A: Fetching Server Data

```typescript
// ✅ APPROVED: React Query for all API calls
export const usePosts = (filters?: PostFilters) => {
  return useQuery({
    queryKey: ['posts', 'list', filters],
    queryFn: () => api.posts.list(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000  // 5 minutes
  });
};

// Component usage
const PostList = () => {
  const { data: posts, isLoading, error } = usePosts();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <List items={posts} />;
};
```

#### Pattern B: Managing UI State

```typescript
// ✅ APPROVED: Redux for shared UI state
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: 'light',
    sidebarOpen: true,
    activeModal: null
  },
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    }
  }
});

// Component usage
const ThemeToggle = () => {
  const theme = useSelector(state => state.ui.theme);
  const dispatch = useDispatch();

  return (
    <button onClick={() => dispatch(setTheme(theme === 'light' ? 'dark' : 'light'))}>
      Toggle Theme
    </button>
  );
};
```

#### Pattern C: Handling Forms

```typescript
// ✅ APPROVED: Simple forms use local state
const ContactForm = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const { mutate: sendContact } = useSendContact();

  const handleSubmit = (e) => {
    e.preventDefault();
    sendContact({ email, message });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
      <button type="submit">Send</button>
    </form>
  );
};

// ✅ APPROVED: Complex multi-step forms use Redux
const multiStepFormSlice = createSlice({
  name: 'contentCreation',
  initialState: {
    currentStep: 1,
    data: {},
    validation: {}
  },
  reducers: {
    updateStep: (state, action) => {
      state.data[state.currentStep] = action.payload;
      state.currentStep++;
    }
  }
});
```

### Forbidden Patterns

#### ❌ Anti-Pattern 1: Server Data in Redux

```typescript
// ❌ FORBIDDEN: Never store API data in Redux
const postsSlice = createSlice({
  name: 'posts',
  initialState: {
    posts: [], // ❌ API data
    loading: false, // ❌ API state
    error: null, // ❌ API state
  },
});
```

#### ❌ Anti-Pattern 2: UI State in React Query

```typescript
// ❌ FORBIDDEN: Never store UI state in React Query cache
queryClient.setQueryData(['ui', 'modal'], { open: true });
```

#### ❌ Anti-Pattern 3: Manual API Caching

```typescript
// ❌ FORBIDDEN: Never manually cache API responses
useEffect(() => {
  fetch('/api/users')
    .then((res) => res.json())
    .then((data) => {
      dispatch(setUsers(data)); // ❌ Wrong
      localStorage.setItem('users', JSON.stringify(data)); // ❌ Wrong
    });
}, []);
```

### Migration Checklist

When migrating existing code, follow this checklist:

#### For Each Redux Slice:

- [ ] Identify all server data properties
- [ ] Create corresponding React Query hooks
- [ ] Remove server data from slice
- [ ] Remove loading/error states
- [ ] Update all components using the slice
- [ ] Test thoroughly
- [ ] Update documentation

#### For Each Component:

- [ ] Replace Redux selectors for server data with React Query hooks
- [ ] Replace dispatch calls for API operations with mutations
- [ ] Keep Redux for UI state only
- [ ] Use local state for component-specific state
- [ ] Add proper error handling
- [ ] Add loading states
- [ ] Test all user flows

### Query Key Convention

All React Query keys must follow this structure:

```typescript
const queryKeys = {
  // [domain, operation, ...params]
  users: {
    all: ['users'] as const,
    lists: () => ['users', 'list'] as const,
    list: (filters: UserFilters) => ['users', 'list', filters] as const,
    details: () => ['users', 'detail'] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },

  posts: {
    all: ['posts'] as const,
    lists: () => ['posts', 'list'] as const,
    list: (filters: PostFilters) => ['posts', 'list', filters] as const,
    detail: (id: string) => ['posts', 'detail', id] as const,
    comments: (postId: string) => ['posts', postId, 'comments'] as const,
  },
};

// Usage
queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
```

### Cache Strategy Guidelines

| Data Type    | Stale Time | Cache Time | Background Refetch |
| ------------ | ---------- | ---------- | ------------------ |
| User Profile | 15 min     | 30 min     | On focus           |
| Posts List   | 1 min      | 5 min      | On focus           |
| Post Detail  | 5 min      | 10 min     | Manual             |
| Payments     | 10 min     | 20 min     | Manual             |
| Real-time    | 0          | 5 min      | Polling/WS         |
| Static       | 1 hour     | 24 hours   | Never              |

### Testing Requirements

#### Unit Tests

```typescript
// Test React Query hooks
describe('usePosts', () => {
  it('should fetch posts successfully', async () => {
    const { result } = renderHook(() => usePosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(10);
  });
});

// Test Redux slices
describe('uiSlice', () => {
  it('should toggle theme', () => {
    const state = uiReducer(initialState, setTheme('dark'));
    expect(state.theme).toBe('dark');
  });
});
```

#### Integration Tests

```typescript
// Test data flow from API to component
it('should display posts from API', async () => {
  render(<PostList />);

  await waitFor(() => {
    expect(screen.getByText('Post Title')).toBeInTheDocument();
  });
});
```

### Performance Targets

All implementations must meet these targets:

- **Cache Hit Rate**: >80%
- **Bundle Size Impact**: <5KB increase
- **Redux Update Time**: <16ms (60fps)
- **Initial Load**: <2s TTI
- **Test Coverage**: >95% for state code

### Code Review Checklist

Before approving any PR:

- [ ] No server data in Redux
- [ ] No UI state in React Query
- [ ] Proper query key structure
- [ ] Appropriate cache times
- [ ] Optimistic updates where applicable
- [ ] Error handling implemented
- [ ] Loading states present
- [ ] Tests written and passing
- [ ] Documentation updated

### Rollout Plan

#### Phase 1: Foundation (Wave 1) ✅

- Audits complete
- Guidelines approved
- Architecture defined

#### Phase 2: Quick Wins (Wave 2)

- Migrate `postSlice` to React Query
- Migrate `paymentSlice` to React Query
- Split `userSlice`

#### Phase 3: Complex Migration (Wave 3)

- Refactor `cmsSlice`
- Consolidate UI state
- Clean up mixed state

#### Phase 4: Testing (Wave 4)

- Integration tests
- Performance validation
- Bundle size check

#### Phase 5: Documentation (Wave 5)

- Update developer guide
- Create training materials
- Record workshop

## Team Feedback Section

### Concerns Raised

1. **Learning Curve**: Team needs React Query training
2. **Migration Risk**: Need feature flags for gradual rollout
3. **Testing Complexity**: Need more testing examples

### Agreements

1. ✅ React Query for all server state
2. ✅ Redux only for client state
3. ✅ Follow query key convention
4. ✅ Implement gradually with feature flags
5. ✅ Comprehensive testing required

### Action Items

1. Schedule React Query workshop
2. Create migration tracking dashboard
3. Set up feature flags
4. Write more test examples
5. Create troubleshooting guide

## Sign-off

By approving these guidelines, the team agrees to:

- Follow the state management patterns
- Complete migration by end of sprint
- Maintain 95%+ test coverage
- Document all exceptions

### Approvals

- [ ] Frontend Lead
- [ ] Backend Lead
- [ ] QA Lead
- [ ] Product Manager
- [ ] Tech Lead

---

**Status**: Ready for Team Review
**Next Step**: Begin Wave 2 implementation
