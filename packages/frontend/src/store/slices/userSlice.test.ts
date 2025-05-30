import type { User, UserState } from '../../types';
import userReducer, { clearUser, setError, setLoading, setUser } from './userSlice';

describe('userSlice', () => {
  const initialState: UserState = {
    currentUser: null,
    loading: false,
    error: null,
  };

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    nostr_pubkey: 'npub1testpubkey',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  describe('Initial state', () => {
    it('should have correct initial state', () => {
      expect(userReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });
  });

  describe('setUser action', () => {
    it('should set user and clear error', () => {
      const action = setUser(mockUser);
      const newState = userReducer(initialState, action);

      expect(newState.currentUser).toEqual(mockUser);
      expect(newState.error).toBe(null);
      expect(newState.loading).toBe(false);
    });

    it('should update user when one already exists', () => {
      const previousState: UserState = {
        currentUser: mockUser,
        loading: false,
        error: 'Previous error',
      };

      const updatedUser: User = {
        ...mockUser,
        name: 'Updated User',
        email: 'updated@example.com',
      };

      const action = setUser(updatedUser);
      const newState = userReducer(previousState, action);

      expect(newState.currentUser).toEqual(updatedUser);
      expect(newState.error).toBe(null);
    });

    it('should clear error when setting user', () => {
      const stateWithError: UserState = {
        currentUser: null,
        loading: false,
        error: 'Login failed',
      };

      const action = setUser(mockUser);
      const newState = userReducer(stateWithError, action);

      expect(newState.currentUser).toEqual(mockUser);
      expect(newState.error).toBe(null);
    });
  });

  describe('setLoading action', () => {
    it('should set loading to true', () => {
      const action = setLoading(true);
      const newState = userReducer(initialState, action);

      expect(newState.loading).toBe(true);
      expect(newState.currentUser).toBe(null);
      expect(newState.error).toBe(null);
    });

    it('should set loading to false', () => {
      const loadingState: UserState = {
        currentUser: null,
        loading: true,
        error: null,
      };

      const action = setLoading(false);
      const newState = userReducer(loadingState, action);

      expect(newState.loading).toBe(false);
    });

    it('should not affect other state properties', () => {
      const stateWithData: UserState = {
        currentUser: mockUser,
        loading: false,
        error: 'Some error',
      };

      const action = setLoading(true);
      const newState = userReducer(stateWithData, action);

      expect(newState.loading).toBe(true);
      expect(newState.currentUser).toEqual(mockUser);
      expect(newState.error).toBe('Some error');
    });
  });

  describe('setError action', () => {
    it('should set error and stop loading', () => {
      const loadingState: UserState = {
        currentUser: null,
        loading: true,
        error: null,
      };

      const errorMessage = 'Authentication failed';
      const action = setError(errorMessage);
      const newState = userReducer(loadingState, action);

      expect(newState.error).toBe(errorMessage);
      expect(newState.loading).toBe(false);
      expect(newState.currentUser).toBe(null);
    });

    it('should update error without affecting user', () => {
      const stateWithUser: UserState = {
        currentUser: mockUser,
        loading: false,
        error: null,
      };

      const errorMessage = 'Profile update failed';
      const action = setError(errorMessage);
      const newState = userReducer(stateWithUser, action);

      expect(newState.error).toBe(errorMessage);
      expect(newState.loading).toBe(false);
      expect(newState.currentUser).toEqual(mockUser);
    });

    it('should replace previous error', () => {
      const stateWithError: UserState = {
        currentUser: null,
        loading: true,
        error: 'Previous error',
      };

      const newError = 'New error';
      const action = setError(newError);
      const newState = userReducer(stateWithError, action);

      expect(newState.error).toBe(newError);
      expect(newState.loading).toBe(false);
    });
  });

  describe('clearUser action', () => {
    it('should clear user and error', () => {
      const stateWithUser: UserState = {
        currentUser: mockUser,
        loading: false,
        error: 'Some error',
      };

      const action = clearUser();
      const newState = userReducer(stateWithUser, action);

      expect(newState.currentUser).toBe(null);
      expect(newState.error).toBe(null);
      expect(newState.loading).toBe(false);
    });

    it('should not affect loading state', () => {
      const loadingStateWithUser: UserState = {
        currentUser: mockUser,
        loading: true,
        error: 'Error message',
      };

      const action = clearUser();
      const newState = userReducer(loadingStateWithUser, action);

      expect(newState.currentUser).toBe(null);
      expect(newState.error).toBe(null);
      expect(newState.loading).toBe(true); // Should preserve loading state
    });

    it('should work when user is already null', () => {
      const emptyState: UserState = {
        currentUser: null,
        loading: false,
        error: 'Some error',
      };

      const action = clearUser();
      const newState = userReducer(emptyState, action);

      expect(newState.currentUser).toBe(null);
      expect(newState.error).toBe(null);
      expect(newState.loading).toBe(false);
    });
  });

  describe('Action creators', () => {
    it('should create setUser action', () => {
      const action = setUser(mockUser);
      expect(action.type).toBe('user/setUser');
      expect(action.payload).toEqual(mockUser);
    });

    it('should create setLoading action', () => {
      const action = setLoading(true);
      expect(action.type).toBe('user/setLoading');
      expect(action.payload).toBe(true);
    });

    it('should create setError action', () => {
      const errorMessage = 'Test error';
      const action = setError(errorMessage);
      expect(action.type).toBe('user/setError');
      expect(action.payload).toBe(errorMessage);
    });

    it('should create clearUser action', () => {
      const action = clearUser();
      expect(action.type).toBe('user/clearUser');
      expect(action.payload).toBeUndefined();
    });
  });
});
