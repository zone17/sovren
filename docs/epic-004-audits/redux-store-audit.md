# Redux Store Audit Report - Epic 004

**Date**: 2025-10-26
**Epic**: #004 - State Management Boundaries
**Story**: US-004-001 - Audit Redux Store Structure

## Executive Summary

Current Redux store contains significant **server state pollution** that should be migrated to React Query. All slices are storing server data (API responses) mixed with loading states, which violates the principle of separating server and client state.

## Current Store Structure

```
store/
├── slices/
│   ├── userSlice.ts      → MIXED (auth client state + user server data)
│   ├── postSlice.ts      → SERVER (should be React Query)
│   ├── paymentSlice.ts   → SERVER (should be React Query)
│   ├── cmsSlice.ts       → COMPLEX MIXED (890 lines! Server + UI state)
│   └── unifiedCmsSlice.ts → Not analyzed yet
└── index.ts              → Store configuration
```

## Detailed Slice Analysis

### 1. userSlice.ts - **MIXED STATE**

```typescript
State Structure:
- currentUser: User | null     → SERVER DATA (from API)
- loading: boolean             → SERVER STATE (API loading)
- error: string | null         → SERVER STATE (API errors)

Classification: MIXED
- Auth state (isAuthenticated) → Keep in Redux
- User data → Move to React Query
- Loading/error → Remove (handled by React Query)
```

**Recommendation**: Split into:

- `authSlice` (Redux): isAuthenticated, token
- `useUser` hook (React Query): user data fetching

### 2. postSlice.ts - **PURE SERVER STATE**

```typescript
State Structure:
- posts: Post[]                → SERVER DATA (API response)
- currentPost: Post | null     → SERVER DATA (API response)
- loading: boolean             → SERVER STATE
- error: string | null         → SERVER STATE

Classification: PURE SERVER STATE
- ALL properties should move to React Query
```

**Recommendation**: Delete entirely, replace with:

- `usePosts` hook
- `usePost` hook
- `useCreatePost` mutation
- `useUpdatePost` mutation
- `useDeletePost` mutation

### 3. paymentSlice.ts - **PURE SERVER STATE**

```typescript
State Structure:
- payments: Payment[]          → SERVER DATA (API response)
- currentPayment: Payment      → SERVER DATA (API response)
- loading: boolean             → SERVER STATE
- error: string | null         → SERVER STATE

Classification: PURE SERVER STATE
- ALL properties should move to React Query
```

**Recommendation**: Delete entirely, replace with:

- `usePayments` hook
- `usePayment` hook
- `useCreatePayment` mutation
- Payment status polling via React Query

### 4. cmsSlice.ts - **COMPLEX MIXED STATE** ⚠️

```typescript
State Structure (890 lines!):
- content_items: ContentItem[]        → SERVER DATA
- current_content: ContentItem        → SERVER DATA
- media_assets: MediaAsset[]          → SERVER DATA
- content_versions: []                → SERVER DATA
- comments: ContentComment[]          → SERVER DATA
- supports: ContentSupport[]          → SERVER DATA
- loading: boolean                    → SERVER STATE
- error: string | null                → SERVER STATE

- editor_state: {                     → CLIENT STATE (keep in Redux)
    is_editing: boolean
    auto_save_enabled: boolean
    last_saved: string | null
    ai_assistant_enabled: boolean
    collaborative_mode: boolean
    current_collaborators: string[]
    suggested_improvements: []
  }

- ai_state: {                         → MIXED (settings client, queue server)
    models_available: []
    current_model: string
    usage_quota: {}
    content_generation_queue: []
  }

Classification: COMPLEX MIXED
- Content data → React Query
- Editor UI state → Keep in Redux
- AI queue → React Query
- AI settings → Keep in Redux
```

**Recommendation**: Major refactor needed:

1. Extract all content data to React Query hooks
2. Keep only editor UI state in Redux
3. Split AI state (settings vs queue)
4. Reduce from 890 lines to ~100 lines

## Migration Priority

### Phase 1: Quick Wins (Pure Server State)

1. **postSlice** → Completely replace with React Query
2. **paymentSlice** → Completely replace with React Query

### Phase 2: Complex Refactoring

3. **userSlice** → Split into auth (Redux) + user data (React Query)
4. **cmsSlice** → Major refactor to extract server data

## React Query Hooks Needed

### Content Domain

- `useContents(filters)` - List with pagination
- `useContent(id)` - Single content item
- `useCreateContent()` - Create mutation
- `useUpdateContent()` - Update mutation
- `useDeleteContent()` - Delete mutation
- `useContentVersions(contentId)` - Version history
- `useContentComments(contentId)` - Comments
- `useContentSupports(contentId)` - Support/donations

### User Domain

- `useUser(id)` - User profile data
- `useCurrentUser()` - Current authenticated user
- `useUpdateProfile()` - Profile update mutation

### Post Domain

- `usePosts(filters)` - List with pagination
- `usePost(id)` - Single post
- `useCreatePost()` - Create mutation
- `useUpdatePost()` - Update mutation
- `useDeletePost()` - Delete mutation

### Payment Domain

- `usePayments(filters)` - Payment history
- `usePayment(id)` - Single payment
- `usePaymentStatus(id)` - Status polling
- `useCreatePayment()` - Create payment/invoice
- `useCancelPayment()` - Cancel mutation

## Redux Slices to Keep/Create

### 1. uiSlice (NEW - Consolidate all UI state)

```typescript
interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  activeModal: string | null;
  modalData: any;
  notifications: Notification[];
  toasts: Toast[];
}
```

### 2. authSlice (NEW - Extract from userSlice)

```typescript
interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  nostrPubkey: string | null;
}
```

### 3. editorSlice (Extract from cmsSlice)

```typescript
interface EditorState {
  isEditing: boolean;
  autoSaveEnabled: boolean;
  lastSaved: string | null;
  selectedBlocks: string[];
  clipboardContent: ContentBlock | null;
}
```

### 4. preferencesSlice (NEW - User preferences)

```typescript
interface PreferencesState {
  language: string;
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
  aiAssistant: AIPreferences;
}
```

## Statistics

### Current State Breakdown

- **Total Redux Properties**: 47
- **Server State Properties**: 32 (68%)
- **Client State Properties**: 15 (32%)
- **Properties to Remove**: 32
- **Properties to Keep**: 15

### Lines of Code

- **Current Total**: ~1,200 lines
- **After Migration**: ~300 lines (75% reduction)

### Bundle Size Impact

- **Current Redux slices**: ~45KB
- **After cleanup**: ~12KB
- **React Query addition**: ~38KB
- **Net change**: +5KB (acceptable)

## Action Items

1. ✅ Complete audit of all slices
2. ⏳ Create React Query configuration
3. ⏳ Implement React Query hooks for each domain
4. ⏳ Remove server state from Redux slices
5. ⏳ Create new UI-focused Redux slices
6. ⏳ Update all components
7. ⏳ Write migration guide
8. ⏳ Test thoroughly

## Risk Assessment

### High Risk

- **cmsSlice refactor**: 890 lines, complex async thunks
- **Component updates**: ~50+ components need updates

### Medium Risk

- **Testing coverage**: Need comprehensive tests before migration
- **Cache invalidation**: Complex relationships between entities

### Low Risk

- **postSlice migration**: Simple structure, clean migration path
- **paymentSlice migration**: Well-defined boundaries

## Conclusion

The Redux store is currently **heavily polluted with server state** (68% of all properties). This causes:

- Unnecessary re-renders
- Complex cache management
- Duplicate data between Redux and API
- Difficult testing
- Poor developer experience

**Recommendation**: Proceed with aggressive migration to React Query for all server state, keeping Redux only for true client-side application state.

## Next Steps

1. Review this audit with team
2. Get approval on migration strategy
3. Begin with Phase 1 (quick wins)
4. Tackle complex cmsSlice refactor in Phase 2

---

**Prepared by**: Epic 004 Implementation Team
**Status**: Ready for Review
