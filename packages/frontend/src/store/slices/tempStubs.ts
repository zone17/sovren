/**
 * Temporary stubs for removed slices
 * These will be removed in US-E4-010 when components are updated to use React Query
 */

import { createSlice } from '@reduxjs/toolkit';

// Temporary post slice stub
const postSlice = createSlice({
  name: 'post',
  initialState: {
    posts: [],
    currentPost: null,
    loading: false,
    error: null,
  },
  reducers: {
    setPosts: () => {},
    setCurrentPost: () => {},
    addPost: () => {},
    updatePost: () => {},
    deletePost: () => {},
    setLoading: () => {},
    setError: () => {},
  },
});

// Temporary payment slice stub
const paymentSlice = createSlice({
  name: 'payment',
  initialState: {
    payments: [],
    currentPayment: null,
    loading: false,
    error: null,
  },
  reducers: {
    setPayments: () => {},
    setCurrentPayment: () => {},
    addPayment: () => {},
    updatePayment: () => {},
    deletePayment: () => {},
    setLoading: () => {},
    setError: () => {},
  },
});

// Temporary CMS slice stub
const cmsSlice = createSlice({
  name: 'cms',
  initialState: {
    contentItems: [],
    currentContent: null,
    mediaAssets: [],
    loading: false,
    error: null,
  },
  reducers: {
    loadContentItems: () => {},
    setCurrentContent: () => {},
    createContentItem: () => {},
    updateCurrentContent: () => {},
    publishContentItem: () => {},
    addContentBlock: () => {},
    uploadMedia: () => {},
    supportContent: () => {},
    clearFilter: () => {},
    setActiveCollection: () => {},
    createCollection: () => {},
    updateCollection: () => {},
    addContentToCollection: () => {},
    loadCollections: () => {},
    deleteCollection: () => {},
    removeContentFromCollection: () => {},
    publishCollection: () => {},
    deleteContentBlock: () => {},
    updateContentBlock: () => {},
  },
});

export const postReducer = postSlice.reducer;
export const paymentReducer = paymentSlice.reducer;
export const cmsReducer = cmsSlice.reducer;

export const { setPosts } = postSlice.actions;
export const {
  loadContentItems,
  setCurrentContent,
  createContentItem,
  updateCurrentContent,
  publishContentItem,
  addContentBlock,
  uploadMedia,
  supportContent,
  clearFilter,
  setActiveCollection,
  createCollection,
  updateCollection,
  addContentToCollection,
  loadCollections,
  deleteCollection,
  removeContentFromCollection,
  publishCollection,
  deleteContentBlock,
  updateContentBlock,
} = cmsSlice.actions;

export default {
  postSlice,
  paymentSlice,
  cmsSlice,
};