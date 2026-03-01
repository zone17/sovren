/**
 * Pagination State Slice - Client-side pagination state
 * Following Elite Engineering Standards
 *
 * This slice manages pagination-related UI state that was previously
 * mixed with server data in React Query:
 * - Current page numbers per section
 * - Page size preferences
 * - Sorting preferences
 * - Filter state for lists
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SortDirection = 'asc' | 'desc';

export interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface FilterConfig {
  [key: string]: any;
}

export interface PaginationState {
  // Pagination configs per section/query
  pages: Record<string, PaginationConfig>;

  // Sort configs per section
  sorting: Record<string, SortConfig>;

  // Filter configs per section
  filters: Record<string, FilterConfig>;

  // Default page sizes
  defaultPageSizes: {
    content: number;
    creators: number;
    payments: number;
    analytics: number;
    [key: string]: number;
  };
}

const initialState: PaginationState = {
  pages: {},
  sorting: {},
  filters: {},
  defaultPageSizes: {
    content: 20,
    creators: 12,
    payments: 25,
    analytics: 50,
  },
};

const paginationSlice = createSlice({
  name: 'pagination',
  initialState,
  reducers: {
    // Pagination actions
    setPage: (state, action: PayloadAction<{ section: string; page: number }>) => {
      if (!state.pages[action.payload.section]) {
        state.pages[action.payload.section] = {
          currentPage: 1,
          pageSize: state.defaultPageSizes[action.payload.section] || 20,
          totalItems: 0,
          totalPages: 0,
        };
      }
      state.pages[action.payload.section].currentPage = action.payload.page;
    },

    setPageSize: (state, action: PayloadAction<{ section: string; pageSize: number }>) => {
      if (!state.pages[action.payload.section]) {
        state.pages[action.payload.section] = {
          currentPage: 1,
          pageSize: action.payload.pageSize,
          totalItems: 0,
          totalPages: 0,
        };
      } else {
        state.pages[action.payload.section].pageSize = action.payload.pageSize;
        // Reset to page 1 when page size changes
        state.pages[action.payload.section].currentPage = 1;
      }
    },

    updatePaginationInfo: (
      state,
      action: PayloadAction<{
        section: string;
        totalItems: number;
        totalPages: number;
      }>
    ) => {
      if (!state.pages[action.payload.section]) {
        state.pages[action.payload.section] = {
          currentPage: 1,
          pageSize: state.defaultPageSizes[action.payload.section] || 20,
          totalItems: 0,
          totalPages: 0,
        };
      }
      state.pages[action.payload.section].totalItems = action.payload.totalItems;
      state.pages[action.payload.section].totalPages = action.payload.totalPages;
    },

    resetPagination: (state, action: PayloadAction<string>) => {
      if (state.pages[action.payload]) {
        state.pages[action.payload].currentPage = 1;
      }
    },

    // Sorting actions
    setSorting: (
      state,
      action: PayloadAction<{
        section: string;
        field: string;
        direction: SortDirection;
      }>
    ) => {
      state.sorting[action.payload.section] = {
        field: action.payload.field,
        direction: action.payload.direction,
      };
      // Reset to page 1 when sorting changes
      if (state.pages[action.payload.section]) {
        state.pages[action.payload.section].currentPage = 1;
      }
    },

    toggleSortDirection: (state, action: PayloadAction<{ section: string; field: string }>) => {
      const currentSort = state.sorting[action.payload.section];
      if (currentSort && currentSort.field === action.payload.field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sorting[action.payload.section] = {
          field: action.payload.field,
          direction: 'asc',
        };
      }
      // Reset to page 1 when sorting changes
      if (state.pages[action.payload.section]) {
        state.pages[action.payload.section].currentPage = 1;
      }
    },

    clearSorting: (state, action: PayloadAction<string>) => {
      delete state.sorting[action.payload];
    },

    // Filter actions
    setFilters: (state, action: PayloadAction<{ section: string; filters: FilterConfig }>) => {
      state.filters[action.payload.section] = action.payload.filters;
      // Reset to page 1 when filters change
      if (state.pages[action.payload.section]) {
        state.pages[action.payload.section].currentPage = 1;
      }
    },

    updateFilter: (
      state,
      action: PayloadAction<{
        section: string;
        filterKey: string;
        value: any;
      }>
    ) => {
      if (!state.filters[action.payload.section]) {
        state.filters[action.payload.section] = {};
      }
      if (action.payload.value === null || action.payload.value === undefined) {
        delete state.filters[action.payload.section][action.payload.filterKey];
      } else {
        state.filters[action.payload.section][action.payload.filterKey] = action.payload.value;
      }
      // Reset to page 1 when filters change
      if (state.pages[action.payload.section]) {
        state.pages[action.payload.section].currentPage = 1;
      }
    },

    clearFilters: (state, action: PayloadAction<string>) => {
      delete state.filters[action.payload];
      // Reset to page 1 when filters are cleared
      if (state.pages[action.payload]) {
        state.pages[action.payload].currentPage = 1;
      }
    },

    // Clear all state for a section
    clearSection: (state, action: PayloadAction<string>) => {
      delete state.pages[action.payload];
      delete state.sorting[action.payload];
      delete state.filters[action.payload];
    },

    // Reset all pagination state
    resetAll: (state) => {
      state.pages = {};
      state.sorting = {};
      state.filters = {};
    },
  },
});

// Export actions
export const {
  setPage,
  setPageSize,
  updatePaginationInfo,
  resetPagination,
  setSorting,
  toggleSortDirection,
  clearSorting,
  setFilters,
  updateFilter,
  clearFilters,
  clearSection,
  resetAll,
} = paginationSlice.actions;

// Selectors
export const selectPagination = (section: string) => (state: { pagination: PaginationState }) =>
  state.pagination.pages[section] || {
    currentPage: 1,
    pageSize: state.pagination.defaultPageSizes[section] || 20,
    totalItems: 0,
    totalPages: 0,
  };

export const selectCurrentPage = (section: string) => (state: { pagination: PaginationState }) =>
  state.pagination.pages[section]?.currentPage || 1;

export const selectPageSize = (section: string) => (state: { pagination: PaginationState }) =>
  state.pagination.pages[section]?.pageSize || state.pagination.defaultPageSizes[section] || 20;

export const selectSorting = (section: string) => (state: { pagination: PaginationState }) =>
  state.pagination.sorting[section] || null;

export const selectFilters = (section: string) => (state: { pagination: PaginationState }) =>
  state.pagination.filters[section] || {};

export const selectHasFilters = (section: string) => (state: { pagination: PaginationState }) =>
  Object.keys(state.pagination.filters[section] || {}).length > 0;

export default paginationSlice.reducer;
