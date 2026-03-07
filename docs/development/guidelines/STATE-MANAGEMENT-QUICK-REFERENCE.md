# State Management Quick Reference Card

## 🎯 Decision Matrix

| If you need to...      | Use this... | Example                                      |
| ---------------------- | ----------- | -------------------------------------------- |
| Fetch from API         | React Query | `useQuery(['users'], fetchUsers)`            |
| Update server data     | React Query | `useMutation(updateUser)`                    |
| Store theme preference | Redux       | `dispatch(setTheme('dark'))`                 |
| Toggle modal           | Redux       | `dispatch(openModal('edit'))`                |
| Track form input       | useState    | `const [value, setValue] = useState('')`     |
| Compute derived data   | useMemo     | `useMemo(() => items.filter(x => x.active))` |

## 📦 React Query Patterns

### Basic Query

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => fetchResource(id),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Mutation with Optimistic Update

```typescript
const mutation = useMutation({
  mutationFn: updateResource,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['resource', id]);
    const previous = queryClient.getQueryData(['resource', id]);
    queryClient.setQueryData(['resource', id], newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['resource', id], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries(['resource', id]);
  },
});
```

### Dependent Queries

```typescript
const { data: user } = useQuery(['user', id], fetchUser);
const { data: posts } = useQuery({
  queryKey: ['posts', user?.id],
  queryFn: () => fetchUserPosts(user.id),
  enabled: !!user,
});
```

## 🎨 Redux Patterns

### UI Slice

```typescript
const uiSlice = createSlice({
  name: 'ui',
  initialState: { theme: 'light', sidebarOpen: true },
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});
```

### Selectors

```typescript
// Basic
const theme = useSelector((state) => state.ui.theme);

// Memoized
const filteredItems = useSelector(
  createSelector([(state) => state.items, (state) => state.filter], (items, filter) =>
    items.filter((item) => item.type === filter)
  )
);
```

## 🚫 Anti-Patterns

```typescript
// ❌ Server data in Redux
dispatch(setUserData(apiResponse));

// ✅ Server data in React Query
useQuery(['user'], fetchUser);

// ❌ Duplicating state
const { data } = useQuery(['user'], fetchUser);
const [user, setUser] = useState(data);

// ✅ Use server state directly
const { data: user } = useQuery(['user'], fetchUser);

// ❌ UI state in React Query
useQuery(['theme'], () => localStorage.getItem('theme'));

// ✅ UI state in Redux
const theme = useSelector((state) => state.ui.theme);
```

## 🔑 Query Key Conventions

```typescript
['users'][('users', userId)][('users', { role: 'admin' })][('posts', 'user', userId)][ // All users // Specific user // Filtered users // User's posts
  ('posts', postId, 'comments')
]; // Post comments
```

## ⚡ Performance Tips

1. **Use select for granular subscriptions**

   ```typescript
   useQuery({
     queryKey: ['user'],
     select: (data) => data.name, // Only re-render on name change
   });
   ```

2. **Prefetch on hover**

   ```typescript
   onMouseEnter={() => {
     queryClient.prefetchQuery(['post', id], fetchPost);
   }}
   ```

3. **Batch updates**
   ```typescript
   queryClient.setQueriesData({ queryKey: ['posts'] }, (old) => ({ ...old, liked: true }));
   ```

## 🛠️ Debugging

```typescript
// Enable DevTools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Log query states
queryClient
  .getQueryCache()
  .findAll()
  .forEach((query) => {
    console.log(query.queryKey, query.state);
  });

// Check Redux state
console.log(store.getState());
```

## 📚 Import Reference

```typescript
// React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Redux
import { useSelector, useDispatch } from 'react-redux';
import { createSlice } from '@reduxjs/toolkit';

// Types
import type { RootState, AppDispatch } from '@/store';
```

---

**Remember**: Server state → React Query | UI state → Redux | Local state → useState
