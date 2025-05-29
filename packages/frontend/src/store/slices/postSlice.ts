import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Post, PostState } from '../../types';

const initialState: PostState = {
  posts: [],
  currentPost: null,
  loading: false,
  error: null,
};

const postSlice = createSlice({
  name: 'post',
  initialState,
  reducers: {
    setPosts: (state, action: PayloadAction<Post[]>) => {
      state.posts = action.payload;
      state.error = null;
    },
    setCurrentPost: (state, action: PayloadAction<Post>) => {
      state.currentPost = action.payload;
      state.error = null;
    },
    addPost: (state, action: PayloadAction<Post>) => {
      state.posts.push(action.payload);
      state.error = null;
    },
    updatePost: (state, action: PayloadAction<Post>) => {
      const index = state.posts.findIndex((post) => post.id === action.payload.id);
      if (index !== -1) {
        state.posts[index] = action.payload;
      }
      if (state.currentPost?.id === action.payload.id) {
        state.currentPost = action.payload;
      }
      state.error = null;
    },
    deletePost: (state, action: PayloadAction<string>) => {
      state.posts = state.posts.filter((post) => post.id !== action.payload);
      if (state.currentPost?.id === action.payload) {
        state.currentPost = null;
      }
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearCurrentPost: (state) => {
      state.currentPost = null;
      state.error = null;
    },
  },
});

export const {
  setPosts,
  setCurrentPost,
  addPost,
  updatePost,
  deletePost,
  setLoading,
  setError,
  clearCurrentPost,
} = postSlice.actions;

export default postSlice.reducer;
