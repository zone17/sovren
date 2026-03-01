/**
 * CMS UI State Slice - Editor UI state only (no server data)
 * All content data moved to React Query
 *
 * This slice manages only CMS editor UI state:
 * - Editor modes and preferences
 * - Drafts and auto-save state
 * - Collaboration state
 * - AI assistant UI state
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface EditorState {
  isEditing: boolean;
  editorMode: 'visual' | 'markdown' | 'code';
  selectedBlockId: string | null;
  autoSaveEnabled: boolean;
  lastSavedAt: string | null;
  isDirty: boolean; // Has unsaved changes
  collaborationEnabled: boolean;
  currentCollaborators: string[]; // User IDs of active collaborators
  showAiAssistant: boolean;
  aiSuggestionsEnabled: boolean;
  editorPreferences: {
    fontSize: number;
    fontFamily: string;
    lineHeight: number;
    showLineNumbers: boolean;
    wordWrap: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}

export interface DraftState {
  id: string;
  contentId?: string;
  title: string;
  lastModified: string;
  autoSaveVersion: number;
}

export interface CMSUiState {
  editor: EditorState;
  drafts: Record<string, DraftState>; // Local drafts indexed by ID
  selectedDraftId: string | null;
  showPreview: boolean;
  previewMode: 'desktop' | 'tablet' | 'mobile';
  sidebarView: 'blocks' | 'media' | 'history' | 'settings' | null;
  uploadProgress: Record<string, number>; // Upload progress by file ID
}

const initialState: CMSUiState = {
  editor: {
    isEditing: false,
    editorMode: 'visual',
    selectedBlockId: null,
    autoSaveEnabled: true,
    lastSavedAt: null,
    isDirty: false,
    collaborationEnabled: false,
    currentCollaborators: [],
    showAiAssistant: false,
    aiSuggestionsEnabled: true,
    editorPreferences: {
      fontSize: 16,
      fontFamily: 'Inter, system-ui, sans-serif',
      lineHeight: 1.5,
      showLineNumbers: false,
      wordWrap: true,
      theme: 'auto',
    },
  },
  drafts: {},
  selectedDraftId: null,
  showPreview: false,
  previewMode: 'desktop',
  sidebarView: null,
  uploadProgress: {},
};

const cmsUiSlice = createSlice({
  name: 'cmsUi',
  initialState,
  reducers: {
    // Editor state actions
    setEditing: (state, action: PayloadAction<boolean>) => {
      state.editor.isEditing = action.payload;
    },
    setEditorMode: (state, action: PayloadAction<EditorState['editorMode']>) => {
      state.editor.editorMode = action.payload;
    },
    selectBlock: (state, action: PayloadAction<string | null>) => {
      state.editor.selectedBlockId = action.payload;
    },
    setAutoSave: (state, action: PayloadAction<boolean>) => {
      state.editor.autoSaveEnabled = action.payload;
    },
    markSaved: (state) => {
      state.editor.lastSavedAt = new Date().toISOString();
      state.editor.isDirty = false;
    },
    markDirty: (state) => {
      state.editor.isDirty = true;
    },
    setCollaborationEnabled: (state, action: PayloadAction<boolean>) => {
      state.editor.collaborationEnabled = action.payload;
      if (!action.payload) {
        state.editor.currentCollaborators = [];
      }
    },
    updateCollaborators: (state, action: PayloadAction<string[]>) => {
      state.editor.currentCollaborators = action.payload;
    },
    toggleAiAssistant: (state) => {
      state.editor.showAiAssistant = !state.editor.showAiAssistant;
    },
    setAiSuggestions: (state, action: PayloadAction<boolean>) => {
      state.editor.aiSuggestionsEnabled = action.payload;
    },
    updateEditorPreferences: (
      state,
      action: PayloadAction<Partial<EditorState['editorPreferences']>>
    ) => {
      state.editor.editorPreferences = {
        ...state.editor.editorPreferences,
        ...action.payload,
      };
    },

    // Draft management
    createDraft: (
      state,
      action: PayloadAction<Omit<DraftState, 'lastModified' | 'autoSaveVersion'>>
    ) => {
      const draft: DraftState = {
        ...action.payload,
        lastModified: new Date().toISOString(),
        autoSaveVersion: 1,
      };
      state.drafts[draft.id] = draft;
      state.selectedDraftId = draft.id;
    },
    updateDraft: (state, action: PayloadAction<{ id: string; updates: Partial<DraftState> }>) => {
      const draft = state.drafts[action.payload.id];
      if (draft) {
        state.drafts[action.payload.id] = {
          ...draft,
          ...action.payload.updates,
          lastModified: new Date().toISOString(),
          autoSaveVersion: draft.autoSaveVersion + 1,
        };
      }
    },
    deleteDraft: (state, action: PayloadAction<string>) => {
      delete state.drafts[action.payload];
      if (state.selectedDraftId === action.payload) {
        state.selectedDraftId = null;
      }
    },
    selectDraft: (state, action: PayloadAction<string | null>) => {
      state.selectedDraftId = action.payload;
    },
    clearDrafts: (state) => {
      state.drafts = {};
      state.selectedDraftId = null;
    },

    // Preview controls
    togglePreview: (state) => {
      state.showPreview = !state.showPreview;
    },
    setPreviewMode: (state, action: PayloadAction<CMSUiState['previewMode']>) => {
      state.previewMode = action.payload;
    },

    // Sidebar controls
    setSidebarView: (state, action: PayloadAction<CMSUiState['sidebarView']>) => {
      state.sidebarView = action.payload;
    },
    closeSidebar: (state) => {
      state.sidebarView = null;
    },

    // Upload progress
    setUploadProgress: (state, action: PayloadAction<{ fileId: string; progress: number }>) => {
      if (action.payload.progress >= 100) {
        delete state.uploadProgress[action.payload.fileId];
      } else {
        state.uploadProgress[action.payload.fileId] = action.payload.progress;
      }
    },
    clearUploadProgress: (state, action: PayloadAction<string>) => {
      delete state.uploadProgress[action.payload];
    },

    // Reset editor state
    resetEditor: (state) => {
      state.editor = initialState.editor;
      state.showPreview = false;
      state.sidebarView = null;
      state.uploadProgress = {};
    },
  },
});

export const {
  setEditing,
  setEditorMode,
  selectBlock,
  setAutoSave,
  markSaved,
  markDirty,
  setCollaborationEnabled,
  updateCollaborators,
  toggleAiAssistant,
  setAiSuggestions,
  updateEditorPreferences,
  createDraft,
  updateDraft,
  deleteDraft,
  selectDraft,
  clearDrafts,
  togglePreview,
  setPreviewMode,
  setSidebarView,
  closeSidebar,
  setUploadProgress,
  clearUploadProgress,
  resetEditor,
} = cmsUiSlice.actions;

export default cmsUiSlice.reducer;
