# Epic 004: State Management Boundaries

## Epic Summary

Define clear architectural boundaries between Redux Toolkit and React Query usage to eliminate confusion, reduce complexity, and improve developer experience.

## Business Value

- **Developer Velocity**: 20% faster feature development with clear patterns
- **Onboarding**: New developers understand state management in < 1 day
- **Bug Reduction**: Fewer state-related bugs from misuse of state libraries
- **Performance**: Optimized data fetching and caching strategies
- **Maintainability**: Clear patterns make refactoring easier

## Current State

### Mixed State Management Patterns

**Redux Toolkit Usage:**

- User authentication state
- UI state (modals, themes, notifications)
- Some feature-specific state (CMS, analytics)
- Local application preferences

**React Query Usage:**

- API data fetching (some areas)
- Server state caching
- Background data synchronization
- Real-time updates (NOSTR events)

**Problems Identified:**

1. **Confusion**: Developers unsure which library to use for new features
2. **Duplication**: Same data stored in both Redux and React Query cache
3. **Inconsistency**: Similar features use different state management approaches
4. **Over-fetching**: Redux used for server data that React Query handles better
5. **Stale Data**: Manual cache invalidation instead of React Query auto-refresh

### Examples of Current Confusion

```typescript
// ❌ Problem 1: Server data in Redux (should be React Query)
const creators = useSelector((state) => state.creators.list);

// ❌ Problem 2: UI state in React Query (should be Redux)
const { data: modalState } = useQuery(['modal-state']);

// ❌ Problem 3: Duplicate data storage
const user = useSelector((state) => state.auth.user);
const { data: userProfile } = useQuery(['user-profile', userId]);
// These often represent the same data!
```

## Desired End State

### Clear Architectural Boundaries

**Redux Toolkit: Client-Side Application State**

- User authentication & session
- UI/UX state (theme, modals, notifications, sidebar state)
- Form state (for complex multi-step forms)
- Client-side feature flags
- User preferences (local settings)
- Derived/computed client state

**React Query: Server State & Real-Time Data**

- All API data fetching
- NOSTR event streams
- Server-side feature flags
- Real-time subscriptions
- Background synchronization
- Optimistic updates
- Cache management

### Decision Matrix

```typescript
/**
 * STATE MANAGEMENT DECISION TREE
 *
 * Question 1: Is this data from a server/external source?
 *   YES → Use React Query
 *   NO → Continue to Question 2
 *
 * Question 2: Is this UI/UX presentation state?
 *   YES → Use Redux
 *   NO → Continue to Question 3
 *
 * Question 3: Does this state need to persist across page refreshes?
 *   YES → Use Redux + localStorage
 *   NO → Consider React useState/Context
 *
 * Question 4: Is this shared across many components?
 *   YES → Use Redux
 *   NO → Use local component state
 */
```

## Success Criteria

- [ ] Clear state management guidelines documented
- [ ] All server data migrated to React Query
- [ ] All UI state consolidated in Redux
- [ ] Zero duplicate data storage
- [ ] Mermaid diagram showing state management architecture
- [ ] Developer guide with examples
- [ ] Team training completed
- [ ] All existing features refactored to follow guidelines

## Technical Scope

### Redux Slices to Maintain

```typescript
store/
├── slices/
│   ├── authSlice.ts           // ✅ Keep - session state
│   ├── uiSlice.ts             // ✅ Keep - UI state
│   ├── preferencesSlice.ts    // ✅ Keep - local settings
│   ├── cmsSlice.ts            // ⚠️  Refactor - split client/server
│   ├── analyticsSlice.ts      // ⚠️  Refactor - split client/server
│   └── creatorsSlice.ts       // ❌ Remove - move to React Query
```

### React Query Queries to Add

```typescript
queries/
├── creators/
│   ├── useCreators.ts         // Server data
│   ├── useCreatorProfile.ts   // Server data
│   └── useCreatorAnalytics.ts // Server data + real-time
├── content/
│   ├── useContent.ts          // Server data
│   ├── useContentStream.ts    // NOSTR real-time
│   └── useContentStats.ts     // Server data
├── payments/
│   ├── useSubscriptions.ts    // Server data
│   ├── useInvoices.ts         // Server data
│   └── usePaymentStatus.ts    // Server data + polling
└── nostr/
    ├── useNostrEvents.ts      // Real-time stream
    └── useNostrProfile.ts     // Cached server data
```

## Technical Approach

### Phase 1: Audit & Categorize (1-2 days)

1. Inventory all Redux slices
2. Inventory all React Query usage
3. Categorize each piece of state (client vs server)
4. Identify duplications and conflicts
5. Create migration plan

### Phase 2: Define Guidelines (1 day)

1. Create state management decision tree
2. Write developer guidelines document
3. Create code examples for common patterns
4. Design Mermaid architecture diagrams
5. Review with team for feedback

### Phase 3: Refactor Server Data → React Query (2-3 days)

1. Create React Query hooks for all server data
2. Add proper caching strategies (stale times, cache keys)
3. Implement optimistic updates where needed
4. Add error handling and retry logic
5. Remove server data from Redux slices

### Phase 4: Consolidate Client State → Redux (1-2 days)

1. Move scattered UI state to centralized Redux slices
2. Remove UI state from React Query
3. Implement proper action creators
4. Add Redux DevTools integration
5. Update components to use new patterns

### Phase 5: Cleanup & Documentation (1 day)

1. Remove unused Redux slices
2. Remove duplicate React Query hooks
3. Update all component imports
4. Write migration guide
5. Create training materials

## Dependencies

### Blockers

- Type Safety Improvements (Epic 001) helps with this refactoring

### Related Work

- NOSTR Service Consolidation (Epic 003) will clarify NOSTR state
- Backend Service Refactoring (Epic 005) may change API contracts

## Risks & Mitigation

| Risk                           | Impact | Likelihood | Mitigation                                    |
| ------------------------------ | ------ | ---------- | --------------------------------------------- |
| Breaking existing features     | High   | Medium     | Feature flags, comprehensive tests            |
| Performance regression         | Medium | Low        | Benchmark before/after, optimize queries      |
| Developer resistance to change | Medium | Medium     | Clear guidelines, training, examples          |
| Cache invalidation bugs        | High   | Medium     | Comprehensive integration tests               |
| Difficult migration            | Medium | Medium     | Incremental migration, keep old code parallel |

## Estimated Effort

- **Total Story Points**: 21-34 points
- **Estimated Calendar Time**: 1.5-2 weeks
- **Team Size**: 2 developers + 1 tech lead for guidelines

## Implementation Order

### Week 1

1. **Days 1-2**: Audit and categorization
2. **Day 3**: Define guidelines and decision tree
3. **Days 4-5**: Begin server data migration (high-traffic queries first)

### Week 2

4. **Days 1-3**: Complete server data migration
5. **Day 4**: Consolidate client state
6. **Day 5**: Cleanup, documentation, training

## Testing Strategy

### Unit Tests

- Test Redux selectors and reducers
- Test React Query hook behavior
- Test cache invalidation logic

### Integration Tests

- Test data flow from API → React Query → Components
- Test Redux state persistence
- Test optimistic update scenarios

### Performance Tests

- Benchmark query response times
- Measure bundle size impact
- Test cache hit rates
- Monitor re-render performance

## Guidelines Document Outline

### Developer Guide: State Management

1. **Decision Tree**: When to use Redux vs React Query
2. **Redux Patterns**:
   - Slice structure
   - Action creators
   - Selectors
   - Async thunks (when to avoid)
3. **React Query Patterns**:
   - Query keys structure
   - Cache configuration
   - Optimistic updates
   - Error handling
4. **Common Pitfalls**: What NOT to do
5. **Code Examples**: Real-world patterns
6. **Migration Guide**: How to refactor existing code

## Architecture Diagrams Required

1. **State Management Overview**: Shows Redux, React Query, and local state
2. **Data Flow Diagram**: API → React Query → Components
3. **Redux Architecture**: Store structure and slice organization
4. **React Query Architecture**: Query organization and caching strategy
5. **Decision Tree Diagram**: Visual guide for choosing state management

## Example Refactoring

### Before (Mixed Patterns)

```typescript
// ❌ Server data in Redux
const creators = useSelector((state) => state.creators.list);
useEffect(() => {
  dispatch(fetchCreators());
}, []);

// ❌ Manual cache invalidation
const handleUpdate = async () => {
  await updateCreator(data);
  dispatch(fetchCreators()); // Manual refetch
};
```

### After (Clear Boundaries)

```typescript
// ✅ Server data in React Query
const { data: creators, isLoading } = useCreators();

// ✅ Automatic cache invalidation
const updateMutation = useUpdateCreator();
const handleUpdate = async () => {
  await updateMutation.mutateAsync(data);
  // React Query auto-invalidates and refetches
};

// ✅ UI state in Redux
const theme = useSelector((state) => state.ui.theme);
const dispatch = useDispatch();
const toggleTheme = () => dispatch(uiActions.toggleTheme());
```

## Performance Targets

- React Query cache hit rate: > 80%
- Redux state updates: < 16ms (60fps)
- API request deduplication: > 90%
- Bundle size impact: < 5KB increase
- Initial page load: No regression

## Team Training Plan

1. **Kickoff Session** (1 hour):
   - Present new guidelines
   - Show architecture diagrams
   - Q&A

2. **Hands-on Workshop** (2 hours):
   - Live code refactoring examples
   - Pair programming exercise
   - Review common patterns

3. **Code Review Focus** (ongoing):
   - Review PRs for compliance
   - Provide feedback on state management choices
   - Update guidelines based on learnings

## Notes

- **Strategic Refactoring** - Improves long-term maintainability
- Consider recording training sessions for future onboarding
- May reveal opportunities for performance optimization
- Good opportunity to add React Query DevTools
- Document this refactoring in ADR
