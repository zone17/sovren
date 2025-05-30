import type { Post, PostState } from '../../types';
import postReducer, {
  addPost,
  clearCurrentPost,
  deletePost,
  setCurrentPost,
  setError,
  setLoading,
  setPosts,
  updatePost,
} from './postSlice';

describe('postSlice', () => {
  const initialState: PostState = {
    posts: [],
    currentPost: null,
    loading: false,
    error: null,
  };

  const mockPost: Post = {
    id: '1',
    title: 'Test Post',
    content: 'This is a test post content',
    published: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    author_id: 'user1',
  };

  const mockPost2: Post = {
    id: '2',
    title: 'Another Post',
    content: 'Another test post content',
    published: false,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    author_id: 'user2',
  };

  describe('Initial state', () => {
    it('should have correct initial state', () => {
      expect(postReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });
  });

  describe('setPosts action', () => {
    it('should set posts array and clear error', () => {
      const posts = [mockPost, mockPost2];
      const action = setPosts(posts);
      const newState = postReducer(initialState, action);

      expect(newState.posts).toEqual(posts);
      expect(newState.error).toBe(null);
      expect(newState.loading).toBe(false);
      expect(newState.currentPost).toBe(null);
    });

    it('should replace existing posts', () => {
      const stateWithPosts: PostState = {
        ...initialState,
        posts: [mockPost],
      };

      const newPosts = [mockPost2];
      const action = setPosts(newPosts);
      const newState = postReducer(stateWithPosts, action);

      expect(newState.posts).toEqual(newPosts);
    });
  });

  describe('setCurrentPost action', () => {
    it('should set current post and clear error', () => {
      const action = setCurrentPost(mockPost);
      const newState = postReducer(initialState, action);

      expect(newState.currentPost).toEqual(mockPost);
      expect(newState.error).toBe(null);
    });

    it('should replace existing current post', () => {
      const stateWithCurrentPost: PostState = {
        ...initialState,
        currentPost: mockPost,
      };

      const action = setCurrentPost(mockPost2);
      const newState = postReducer(stateWithCurrentPost, action);

      expect(newState.currentPost).toEqual(mockPost2);
    });
  });

  describe('addPost action', () => {
    it('should add post to the array and clear error', () => {
      const action = addPost(mockPost);
      const newState = postReducer(initialState, action);

      expect(newState.posts).toEqual([mockPost]);
      expect(newState.error).toBe(null);
    });

    it('should add post to existing array', () => {
      const stateWithPosts: PostState = {
        ...initialState,
        posts: [mockPost],
      };

      const action = addPost(mockPost2);
      const newState = postReducer(stateWithPosts, action);

      expect(newState.posts).toEqual([mockPost, mockPost2]);
    });
  });

  describe('updatePost action', () => {
    it('should update post in array', () => {
      const stateWithPosts: PostState = {
        ...initialState,
        posts: [mockPost, mockPost2],
      };

      const updatedPost: Post = {
        ...mockPost,
        title: 'Updated Title',
        content: 'Updated content',
        published: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        author_id: 'user1',
      };

      const action = updatePost(updatedPost);
      const newState = postReducer(stateWithPosts, action);

      expect(newState.posts[0]).toEqual(updatedPost);
      expect(newState.posts[1]).toEqual(mockPost2);
      expect(newState.error).toBe(null);
    });

    it('should update current post if it matches', () => {
      const stateWithCurrentPost: PostState = {
        ...initialState,
        posts: [mockPost],
        currentPost: mockPost,
      };

      const updatedPost: Post = {
        ...mockPost,
        title: 'Updated Current Post',
        published: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        author_id: 'user1',
      };

      const action = updatePost(updatedPost);
      const newState = postReducer(stateWithCurrentPost, action);

      expect(newState.currentPost).toEqual(updatedPost);
      expect(newState.posts[0]).toEqual(updatedPost);
    });

    it('should not crash if post not found', () => {
      const action = updatePost(mockPost);
      const newState = postReducer(initialState, action);

      expect(newState.posts).toEqual([]);
      expect(newState.error).toBe(null);
    });
  });

  describe('deletePost action', () => {
    it('should remove post from array', () => {
      const stateWithPosts: PostState = {
        ...initialState,
        posts: [mockPost, mockPost2],
      };

      const action = deletePost('1');
      const newState = postReducer(stateWithPosts, action);

      expect(newState.posts).toEqual([mockPost2]);
      expect(newState.error).toBe(null);
    });

    it('should clear current post if it matches deleted ID', () => {
      const stateWithCurrentPost: PostState = {
        ...initialState,
        posts: [mockPost],
        currentPost: mockPost,
      };

      const action = deletePost('1');
      const newState = postReducer(stateWithCurrentPost, action);

      expect(newState.posts).toEqual([]);
      expect(newState.currentPost).toBe(null);
    });

    it('should not crash if post to delete not found', () => {
      const action = deletePost('nonexistent');
      const newState = postReducer(initialState, action);

      expect(newState.posts).toEqual([]);
      expect(newState.currentPost).toBe(null);
      expect(newState.error).toBe(null);
    });
  });

  describe('setLoading action', () => {
    it('should set loading to true', () => {
      const action = setLoading(true);
      const newState = postReducer(initialState, action);

      expect(newState.loading).toBe(true);
      expect(newState.posts).toEqual([]);
      expect(newState.currentPost).toBe(null);
      expect(newState.error).toBe(null);
    });

    it('should set loading to false', () => {
      const loadingState: PostState = {
        ...initialState,
        loading: true,
      };

      const action = setLoading(false);
      const newState = postReducer(loadingState, action);

      expect(newState.loading).toBe(false);
    });

    it('should not affect other state properties', () => {
      const stateWithData: PostState = {
        posts: [mockPost],
        currentPost: mockPost,
        loading: false,
        error: 'Some error',
      };

      const action = setLoading(true);
      const newState = postReducer(stateWithData, action);

      expect(newState.loading).toBe(true);
      expect(newState.posts).toEqual([mockPost]);
      expect(newState.currentPost).toEqual(mockPost);
      expect(newState.error).toBe('Some error');
    });
  });

  describe('setError action', () => {
    it('should set error and stop loading', () => {
      const loadingState: PostState = {
        ...initialState,
        loading: true,
      };

      const errorMessage = 'Failed to load posts';
      const action = setError(errorMessage);
      const newState = postReducer(loadingState, action);

      expect(newState.error).toBe(errorMessage);
      expect(newState.loading).toBe(false);
      expect(newState.posts).toEqual([]);
      expect(newState.currentPost).toBe(null);
    });

    it('should update error without affecting posts', () => {
      const stateWithPosts: PostState = {
        ...initialState,
        posts: [mockPost],
        currentPost: mockPost,
      };

      const errorMessage = 'Update failed';
      const action = setError(errorMessage);
      const newState = postReducer(stateWithPosts, action);

      expect(newState.error).toBe(errorMessage);
      expect(newState.loading).toBe(false);
      expect(newState.posts).toEqual([mockPost]);
      expect(newState.currentPost).toEqual(mockPost);
    });

    it('should replace previous error', () => {
      const stateWithError: PostState = {
        ...initialState,
        loading: true,
        error: 'Previous error',
      };

      const newError = 'New error';
      const action = setError(newError);
      const newState = postReducer(stateWithError, action);

      expect(newState.error).toBe(newError);
      expect(newState.loading).toBe(false);
    });
  });

  describe('clearCurrentPost action', () => {
    it('should clear current post and error', () => {
      const stateWithCurrentPost: PostState = {
        ...initialState,
        currentPost: mockPost,
        error: 'Some error',
      };

      const action = clearCurrentPost();
      const newState = postReducer(stateWithCurrentPost, action);

      expect(newState.currentPost).toBe(null);
      expect(newState.error).toBe(null);
      expect(newState.posts).toEqual([]); // Should not affect posts array
      expect(newState.loading).toBe(false);
    });

    it('should not affect loading state', () => {
      const loadingStateWithPost: PostState = {
        ...initialState,
        currentPost: mockPost,
        loading: true,
        error: 'Error message',
      };

      const action = clearCurrentPost();
      const newState = postReducer(loadingStateWithPost, action);

      expect(newState.currentPost).toBe(null);
      expect(newState.error).toBe(null);
      expect(newState.loading).toBe(true); // Should preserve loading state
    });

    it('should work when current post is already null', () => {
      const emptyState: PostState = {
        ...initialState,
        error: 'Some error',
      };

      const action = clearCurrentPost();
      const newState = postReducer(emptyState, action);

      expect(newState.currentPost).toBe(null);
      expect(newState.error).toBe(null);
      expect(newState.loading).toBe(false);
    });
  });

  describe('Action creators', () => {
    it('should create correct action types', () => {
      expect(setPosts([]).type).toBe('post/setPosts');
      expect(setCurrentPost(mockPost).type).toBe('post/setCurrentPost');
      expect(addPost(mockPost).type).toBe('post/addPost');
      expect(updatePost(mockPost).type).toBe('post/updatePost');
      expect(deletePost('1').type).toBe('post/deletePost');
      expect(setLoading(true).type).toBe('post/setLoading');
      expect(setError('error').type).toBe('post/setError');
      expect(clearCurrentPost().type).toBe('post/clearCurrentPost');
    });

    it('should create actions with correct payloads', () => {
      const posts = [mockPost, mockPost2];

      expect(setPosts(posts).payload).toEqual(posts);
      expect(setCurrentPost(mockPost).payload).toEqual(mockPost);
      expect(addPost(mockPost).payload).toEqual(mockPost);
      expect(updatePost(mockPost).payload).toEqual(mockPost);
      expect(deletePost('1').payload).toBe('1');
      expect(setLoading(true).payload).toBe(true);
      expect(setError('test error').payload).toBe('test error');
      expect(clearCurrentPost().payload).toBeUndefined();
    });
  });
});
