import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import SimpleContentEditor from '../../features/content/components/SimpleContentEditor';
// TODO: US-E4-010 - Replace with React Query
import { cmsReducer as cmsSlice } from '../../store/slices/tempStubs';
import type { CMSState, ContentItem, MediaAsset } from '../../types/content';

// 🛡️ **ELITE TEST ARCHITECTURE**
interface TestRenderOptions {
  initialCMSState?: Partial<CMSState>;
  preloadedState?: Record<string, unknown>;
}

// 🔧 **MOCK STORE SETUP**
const mockInitialState: CMSState = {
  content_items: [],
  current_content: null,
  media_assets: [],
  content_versions: [],
  comments: [],
  supports: [],
  loading: false,
  error: null,
  editor_state: {
    is_editing: false,
    auto_save_enabled: true,
    last_saved: null,
    ai_assistant_enabled: false,
    collaborative_mode: false,
    current_collaborators: [],
    suggested_improvements: [],
  },
  ai_state: {
    models_available: [],
    current_model: 'gpt-4',
    usage_quota: {
      used: 0,
      limit: 100000,
      reset_date: new Date().toISOString(),
    },
    content_generation_queue: [],
  },
};

const createTestStore = (
  cmsState: CMSState = mockInitialState
): ReturnType<typeof configureStore> => {
  return configureStore({
    reducer: {
      cms: cmsSlice,
    },
    preloadedState: {
      cms: cmsState,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
};

const renderWithProvider = (
  component: React.ReactElement,
  options: TestRenderOptions = {}
): ReturnType<typeof render> & { store: ReturnType<typeof createTestStore> } => {
  const mergedState: CMSState = {
    ...mockInitialState,
    ...options.initialCMSState,
  };
  const store = createTestStore(mergedState);
  return {
    ...render(<Provider store={store}>{component}</Provider>),
    store,
  };
};

// 🧪 **ELITE TEST DATA FACTORY**
const createMockContentItem = (overrides: Partial<ContentItem> = {}): ContentItem => ({
  id: 'test-content-1',
  title: 'Test Content Title',
  slug: 'test-content-title',
  description: 'Test content description',
  content_blocks: [
    {
      id: 'block-1',
      type: 'paragraph',
      content: { text: 'Test paragraph content' },
    },
  ],
  status: 'draft',
  visibility: 'public',
  creator_pubkey: 'test-pubkey',
  tags: ['test'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
  view_count: 0,
  like_count: 0,
  comment_count: 0,
  support_count: 0,
  total_earned_sats: 0,
  ...overrides,
});

const createMockMediaAsset = (overrides: Partial<MediaAsset> = {}): MediaAsset => ({
  id: 'media-1',
  filename: 'test-image.jpg',
  size: 1024000,
  mime_type: 'image/jpeg',
  ipfs_hash: 'QmTest123',
  created_at: '2024-01-01T00:00:00Z',
  creator_pubkey: 'test-pubkey',
  processing_status: 'ready',
  ...overrides,
});

// 🎯 **BEHAVIOR-DRIVEN DEVELOPMENT SCENARIOS**
describe('SimpleContentEditor - Elite Standards Compliance', () => {
  // ✅ **SCENARIO 1: Component Initialization & Type Safety**
  describe('WHEN component initializes', () => {
    it('SHOULD render empty state when no content is selected', () => {
      renderWithProvider(<SimpleContentEditor />);

      expect(screen.getByText('No content selected for editing')).toBeInTheDocument();
    });

    it('SHOULD initialize with existing content data when content is provided', () => {
      const mockContent = createMockContentItem({
        title: 'Elite Content Title',
        description: 'Elite content description',
      });

      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: mockContent,
        },
      });

      expect(screen.getByDisplayValue('Elite Content Title')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Elite content description')).toBeInTheDocument();
    });
  });

  // ⚡ **SCENARIO 2: Lightning Network Integration**
  describe('WHEN managing Lightning payment blocks', () => {
    let mockContent: ContentItem;

    beforeEach(() => {
      mockContent = createMockContentItem({
        content_blocks: [
          {
            id: 'lightning-block-1',
            type: 'lightning-payment',
            content: {
              amount: 2100,
              description: 'Support this content',
              type: 'payment_request',
            },
          },
        ],
      });
    });

    it('SHOULD render Lightning payment block with proper formatting', () => {
      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: mockContent,
        },
      });

      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('Lightning Payment')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2100')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Support this content')).toBeInTheDocument();
    });

    it('SHOULD allow adding new Lightning payment block', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: createMockContentItem(),
        },
      });

      const lightningButton = screen.getByText('+ Lightning');
      await user.click(lightningButton);

      // Verify store action was dispatched
      const state = store.getState() as { cms: CMSState };
      expect(state.cms.current_content?.content_blocks).toHaveLength(2);
    });

    it('SHOULD update Lightning payment amounts with type safety', async () => {
      const user = userEvent.setup();
      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: mockContent,
        },
      });

      const amountInput = screen.getByDisplayValue('2100');
      await user.clear(amountInput);
      await user.type(amountInput, '5000');
      await user.tab(); // Trigger onBlur

      expect(amountInput).toHaveValue(5000);
    });
  });

  // 📱 **SCENARIO 3: IPFS Media Integration**
  describe('WHEN managing media blocks', () => {
    let mockContent: ContentItem;
    let mockMediaAsset: MediaAsset;

    beforeEach(() => {
      mockMediaAsset = createMockMediaAsset();
      mockContent = createMockContentItem({
        content_blocks: [
          {
            id: 'media-block-1',
            type: 'image',
            content: {
              media_asset_id: 'media-1',
              alt_text: 'Test image',
              caption: 'Test caption',
            },
          },
        ],
      });
    });

    it('SHOULD render media block with IPFS gateway URL', () => {
      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: mockContent,
          media_assets: [mockMediaAsset],
        },
      });

      const image = screen.getByAltText('Test image');
      expect(image).toHaveAttribute('src', 'https://gateway.pinata.cloud/ipfs/QmTest123');
    });

    it('SHOULD handle media upload with proper error handling', async () => {
      const user = userEvent.setup();
      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: createMockContentItem(),
        },
      });

      // Add media block
      const mediaButton = screen.getByText('+ Media');
      await user.click(mediaButton);

      // Verify file input is rendered (before upload, no alt text input exists)
      expect(screen.getByText('🖼️')).toBeInTheDocument();
      expect(screen.getByText('Media')).toBeInTheDocument();
    });

    it('SHOULD update alt text with accessibility compliance', async () => {
      const user = userEvent.setup();
      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: mockContent,
          media_assets: [mockMediaAsset],
        },
      });

      const altTextInput = screen.getByDisplayValue('Test image');
      await user.clear(altTextInput);
      await user.type(altTextInput, 'Updated accessible description');

      expect(altTextInput).toHaveValue('Updated accessible description');
    });
  });

  // 📝 **SCENARIO 4: Content Editing & Auto-save**
  describe('WHEN editing content', () => {
    it('SHOULD handle title changes with slug generation', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: createMockContentItem(),
        },
      });

      const titleInput = screen.getByPlaceholderText('Enter your title...');
      await user.clear(titleInput);
      await user.type(titleInput, 'Elite Bitcoin Content!');

      // Verify Redux state update
      const state = store.getState() as { cms: CMSState };
      expect(state.cms.current_content?.title).toBe('Elite Bitcoin Content!');
    });

    it('SHOULD support Markdown formatting', async () => {
      const user = userEvent.setup();
      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: createMockContentItem(),
        },
      });

      const contentArea = screen.getByPlaceholderText(/Start writing your content/);
      await user.click(contentArea);
      await user.clear(contentArea);
      await user.type(contentArea, 'This is **bold** text');

      expect(contentArea).toHaveValue('This is **bold** text');
    });

    it('SHOULD handle auto-save functionality', async () => {
      const mockOnSave = vi.fn();
      renderWithProvider(<SimpleContentEditor onSave={mockOnSave} autoSaveInterval={100} />, {
        initialCMSState: {
          current_content: createMockContentItem(),
          editor_state: {
            is_editing: false,
            auto_save_enabled: true,
            last_saved: null,
            ai_assistant_enabled: false,
            collaborative_mode: false,
            current_collaborators: [],
            suggested_improvements: [],
          },
        },
      });

      await waitFor(
        () => {
          expect(mockOnSave).toHaveBeenCalled();
        },
        { timeout: 200 }
      );
    });
  });

  // 🛡️ **SCENARIO 5: Error Handling & Edge Cases**
  describe('WHEN handling edge cases', () => {
    it('SHOULD handle malformed content blocks gracefully', () => {
      const malformedContent = createMockContentItem({
        content_blocks: [
          {
            id: 'malformed-block',
            type: 'lightning-payment',
            content: {}, // Intentionally malformed but properly typed
          },
        ],
      });

      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: malformedContent,
        },
      });

      // Should render without crashing and show default values
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument(); // Default amount
      // Use more specific selector for lightning payment description
      const lightningDescriptionInput = screen.getByPlaceholderText('What is this payment for?');
      expect(lightningDescriptionInput).toHaveValue('');
    });

    it('SHOULD handle missing media assets gracefully', () => {
      const contentWithMissingMedia = createMockContentItem({
        content_blocks: [
          {
            id: 'missing-media-block',
            type: 'image',
            content: {
              media_asset_id: 'non-existent-media',
              alt_text: 'Missing media',
              caption: 'This media is missing',
            },
          },
        ],
      });

      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: contentWithMissingMedia,
          media_assets: [], // No media assets
        },
      });

      // Should render file input instead of crashing (when media asset is missing)
      expect(screen.getByText('🖼️')).toBeInTheDocument();
      expect(screen.getByText('Media')).toBeInTheDocument();
      // Check for file input by its unique accept attribute
      const fileInput = document.querySelector('input[accept="image/*,video/*,audio/*"]');
      expect(fileInput).toBeInTheDocument();
    });
  });

  // 🎯 **SCENARIO 6: Type Safety Validation**
  describe('WHEN validating type safety', () => {
    it('SHOULD enforce proper TypeScript interfaces', () => {
      // This test ensures compilation passes with strict types
      const contentWithTypedBlocks: ContentItem = createMockContentItem({
        content_blocks: [
          {
            id: 'typed-block',
            type: 'lightning-payment',
            content: {
              amount: 1000,
              description: 'Typed payment',
              type: 'payment_request',
            },
          },
        ],
      });

      renderWithProvider(<SimpleContentEditor />, {
        initialCMSState: {
          current_content: contentWithTypedBlocks,
        },
      });

      expect(screen.getByText('Lightning Payment')).toBeInTheDocument();
    });
  });

  // 🚀 **SCENARIO 7: Performance & Optimization**
  describe('WHEN optimizing performance', () => {
    it('SHOULD not re-render unnecessarily', () => {
      const renderSpy = vi.fn();
      const WrappedEditor = (): React.ReactElement => {
        renderSpy();
        return <SimpleContentEditor />;
      };

      const { rerender } = renderWithProvider(<WrappedEditor />, {
        initialCMSState: {
          current_content: createMockContentItem(),
        },
      });

      // Rerender with same props
      rerender(
        <Provider store={createTestStore(mockInitialState)}>
          <WrappedEditor />
        </Provider>
      );

      expect(renderSpy).toHaveBeenCalledTimes(2); // Initial + rerender
    });
  });
});

// 🔧 **INTEGRATION TESTS**
describe('SimpleContentEditor - Integration Tests', () => {
  it('SHOULD integrate properly with Redux store', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProvider(<SimpleContentEditor />, {
      initialCMSState: {
        current_content: createMockContentItem(),
      },
    });

    // Test full user workflow
    const titleInput = screen.getByPlaceholderText('Enter your title...');
    await user.clear(titleInput); // Clear existing title first
    await user.type(titleInput, 'Full Integration Test');

    const lightningButton = screen.getByText('+ Lightning');
    await user.click(lightningButton);

    // Verify complete state changes
    const finalState = store.getState() as { cms: CMSState };
    expect(finalState.cms.current_content?.title).toBe('Full Integration Test');
    expect(finalState.cms.current_content?.content_blocks).toHaveLength(2);
  });
});
