/**
 * 📚 **CONTENT COLLECTION MANAGER COMPONENT**
 *
 * Elite Engineering Standards:
 * - Hierarchical content organization
 * - Drag & drop reordering
 * - Bulk operations
 * - Search and filtering
 * - Real-time updates
 * - Mobile-first design
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import { useAppDispatch, useAppSelector } from '../../../store';
import {
  addContentToCollection,
  createContentCollection,
  deleteContentCollection,
  fetchContentCollections,
  removeContentFromCollection,
  reorderCollectionItems,
  updateContentCollection,
} from '../../../store/slices/tempStubs' // TODO: US-E4-010;
import type { CollectionType, ContentCollection, ContentItem } from '../../../types/content';

// Collection type configurations
const COLLECTION_TYPES: Record<
  CollectionType,
  {
    name: string;
    icon: string;
    description: string;
    allowedContentTypes: string[];
  }
> = {
  series: {
    name: 'Series',
    icon: '📚',
    description: 'Sequential content like courses or tutorials',
    allowedContentTypes: ['article', 'video', 'audio', 'course'],
  },
  category: {
    name: 'Category',
    icon: '🏷️',
    description: 'Topical grouping of related content',
    allowedContentTypes: ['article', 'video', 'audio', 'image', 'course'],
  },
  playlist: {
    name: 'Playlist',
    icon: '🎵',
    description: 'Curated list of media content',
    allowedContentTypes: ['video', 'audio'],
  },
  bundle: {
    name: 'Bundle',
    icon: '📦',
    description: 'Premium content package',
    allowedContentTypes: ['article', 'video', 'audio', 'course', 'ebook'],
  },
  tag: {
    name: 'Tag',
    icon: '🔖',
    description: 'Flexible content labeling',
    allowedContentTypes: ['article', 'video', 'audio', 'image', 'course', 'ebook'],
  },
};

interface ContentCollectionManagerProps {
  selectedCollection?: string;
  onCollectionSelect?: (collectionId: string) => void;
  onContentSelect?: (contentId: string) => void;
  showContentDetails?: boolean;
  allowBulkOperations?: boolean;
  className?: string;
}

export const ContentCollectionManager: React.FC<ContentCollectionManagerProps> = ({
  selectedCollection,
  onCollectionSelect,
  onContentSelect,
  showContentDetails = true,
  allowBulkOperations = true,
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { content_collections, content_items, loading } = useAppSelector((state) => state.cms);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<CollectionType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'updated_at' | 'item_count'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<ContentCollection | null>(null);
  const [bulkAction, setBulkAction] = useState<'move' | 'copy' | 'delete' | null>(null);
  const [targetCollection, setTargetCollection] = useState<string>('');

  // Load collections on mount
  useEffect(() => {
    dispatch(fetchContentCollections());
  }, [dispatch]);

  // Filter and sort collections
  const filteredCollections = useMemo(() => {
    let filtered = content_collections.filter((collection) => {
      const matchesSearch =
        collection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collection.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || collection.type === filterType;
      return matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
        case 'item_count':
          aValue = a.content_items?.length || 0;
          bValue = b.content_items?.length || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [content_collections, searchTerm, filterType, sortBy, sortOrder]);

  // Get current collection
  const currentCollection = selectedCollection
    ? content_collections.find((c) => c.id === selectedCollection)
    : null;

  // Get collection content items
  const collectionItems = useMemo(() => {
    if (!currentCollection?.content_items) return [];

    return currentCollection.content_items
      .map((item) => content_items.find((ci) => ci.id === item.content_id))
      .filter(Boolean) as ContentItem[];
  }, [currentCollection, content_items]);

  // Handle collection creation
  const handleCreateCollection = useCallback(
    async (data: {
      name: string;
      description: string;
      type: CollectionType;
      is_public: boolean;
    }) => {
      try {
        const result = await dispatch(createContentCollection(data)).unwrap();
        setShowCreateForm(false);
        onCollectionSelect?.(result.id);
      } catch (error) {
        console.error('Failed to create collection:', error);
      }
    },
    [dispatch, onCollectionSelect]
  );

  // Handle collection update
  const handleUpdateCollection = useCallback(
    async (id: string, data: Partial<ContentCollection>) => {
      try {
        await dispatch(updateContentCollection({ id, data })).unwrap();
        setEditingCollection(null);
      } catch (error) {
        console.error('Failed to update collection:', error);
      }
    },
    [dispatch]
  );

  // Handle collection deletion
  const handleDeleteCollection = useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to delete this collection?')) return;

      try {
        await dispatch(deleteContentCollection(id)).unwrap();
        if (selectedCollection === id) {
          onCollectionSelect?.('');
        }
      } catch (error) {
        console.error('Failed to delete collection:', error);
      }
    },
    [dispatch, selectedCollection, onCollectionSelect]
  );

  // Handle drag and drop reordering
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination || !currentCollection) return;

      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;

      if (sourceIndex === destinationIndex) return;

      dispatch(
        reorderCollectionItems({
          collectionId: currentCollection.id,
          sourceIndex,
          destinationIndex,
        })
      );
    },
    [dispatch, currentCollection]
  );

  // Handle item selection
  const handleItemSelect = useCallback((itemId: string, selected: boolean) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedItems(new Set(collectionItems.map((item) => item.id)));
      } else {
        setSelectedItems(new Set());
      }
    },
    [collectionItems]
  );

  // Handle bulk operations
  const handleBulkOperation = useCallback(async () => {
    if (!bulkAction || selectedItems.size === 0) return;

    try {
      switch (bulkAction) {
        case 'move':
          if (!targetCollection) return;
          // Remove from current collection and add to target
          for (const itemId of selectedItems) {
            if (currentCollection) {
              await dispatch(
                removeContentFromCollection({
                  collectionId: currentCollection.id,
                  contentId: itemId,
                })
              ).unwrap();
            }
            await dispatch(
              addContentToCollection({
                collectionId: targetCollection,
                contentId: itemId,
              })
            ).unwrap();
          }
          break;

        case 'copy':
          if (!targetCollection) return;
          // Add to target collection
          for (const itemId of selectedItems) {
            await dispatch(
              addContentToCollection({
                collectionId: targetCollection,
                contentId: itemId,
              })
            ).unwrap();
          }
          break;

        case 'delete':
          if (!confirm(`Remove ${selectedItems.size} items from this collection?`)) return;
          // Remove from current collection
          if (currentCollection) {
            for (const itemId of selectedItems) {
              await dispatch(
                removeContentFromCollection({
                  collectionId: currentCollection.id,
                  contentId: itemId,
                })
              ).unwrap();
            }
          }
          break;
      }

      // Reset selection and bulk action
      setSelectedItems(new Set());
      setBulkAction(null);
      setTargetCollection('');
    } catch (error) {
      console.error('Bulk operation failed:', error);
    }
  }, [bulkAction, selectedItems, targetCollection, currentCollection, dispatch]);

  return (
    <div className={`content-collection-manager h-full flex ${className}`}>
      {/* Collections Sidebar */}
      <div className="w-1/3 border-r border-gray-200 bg-gray-50">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Collections</h2>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              + New
            </button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search collections..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <div className="flex space-x-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as CollectionType | 'all')}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                {Object.entries(COLLECTION_TYPES).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.name}
                  </option>
                ))}
              </select>

              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as typeof sortBy);
                  setSortOrder(order as typeof sortOrder);
                }}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="created_at-desc">Newest</option>
                <option value="created_at-asc">Oldest</option>
                <option value="updated_at-desc">Recently Updated</option>
                <option value="item_count-desc">Most Items</option>
              </select>
            </div>
          </div>
        </div>

        {/* Collections List */}
        <div className="overflow-y-auto h-full">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : filteredCollections.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'No collections found' : 'No collections yet'}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredCollections.map((collection) => (
                <div
                  key={collection.id}
                  onClick={() => onCollectionSelect?.(collection.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedCollection === collection.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-white hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {COLLECTION_TYPES[collection.type]?.icon || '📁'}
                        </span>
                        <span className="font-medium text-gray-900 truncate">
                          {collection.name}
                        </span>
                        {!collection.is_public && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">
                            Private
                          </span>
                        )}
                      </div>

                      {collection.description && (
                        <p className="text-sm text-gray-600 mt-1 truncate">
                          {collection.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>{collection.content_items?.length || 0} items</span>
                        <span>{new Date(collection.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCollection(collection);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        title="Edit collection"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCollection(collection.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Delete collection"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Collection Content */}
      <div className="flex-1 flex flex-col">
        {currentCollection ? (
          <>
            {/* Collection Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {COLLECTION_TYPES[currentCollection.type]?.icon || '📁'}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {currentCollection.name}
                    </h3>
                    {currentCollection.description && (
                      <p className="text-sm text-gray-600">{currentCollection.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">{collectionItems.length} items</span>
                  {allowBulkOperations && selectedItems.size > 0 && (
                    <div className="flex items-center space-x-2">
                      <select
                        value={bulkAction || ''}
                        onChange={(e) => setBulkAction(e.target.value as typeof bulkAction)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Bulk Actions</option>
                        <option value="move">Move to...</option>
                        <option value="copy">Copy to...</option>
                        <option value="delete">Remove from collection</option>
                      </select>

                      {(bulkAction === 'move' || bulkAction === 'copy') && (
                        <select
                          value={targetCollection}
                          onChange={(e) => setTargetCollection(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Select collection...</option>
                          {content_collections
                            .filter((c) => c.id !== currentCollection.id)
                            .map((collection) => (
                              <option key={collection.id} value={collection.id}>
                                {COLLECTION_TYPES[collection.type]?.icon} {collection.name}
                              </option>
                            ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={handleBulkOperation}
                        disabled={!bulkAction || (bulkAction !== 'delete' && !targetCollection)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bulk Selection Controls */}
              {allowBulkOperations && collectionItems.length > 0 && (
                <div className="flex items-center space-x-4 mt-3 pt-3 border-t border-gray-100">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={
                        selectedItems.size === collectionItems.length && collectionItems.length > 0
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                      Select all ({selectedItems.size} selected)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Collection Items */}
            <div className="flex-1 overflow-y-auto">
              {collectionItems.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-4">📄</div>
                  <div className="text-gray-500">This collection is empty</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Drag content here or use the add button to populate this collection
                  </div>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="collection-items">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="p-4 space-y-2"
                      >
                        {collectionItems.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`bg-white border border-gray-200 rounded-lg p-4 transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  {allowBulkOperations && (
                                    <input
                                      type="checkbox"
                                      checked={selectedItems.has(item.id)}
                                      onChange={(e) => handleItemSelect(item.id, e.target.checked)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  )}

                                  <div
                                    {...provided.dragHandleProps}
                                    className="text-gray-400 hover:text-gray-600 cursor-grab"
                                  >
                                    ⋮⋮
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-lg">
                                        {item.content_type === 'article'
                                          ? '📄'
                                          : item.content_type === 'video'
                                            ? '🎬'
                                            : item.content_type === 'audio'
                                              ? '🎵'
                                              : item.content_type === 'image'
                                                ? '🖼️'
                                                : '📁'}
                                      </span>
                                      <h4 className="font-medium text-gray-900 truncate">
                                        {item.title}
                                      </h4>
                                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                        {item.content_type}
                                      </span>
                                      {item.status !== 'published' && (
                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                          {item.status}
                                        </span>
                                      )}
                                    </div>

                                    {showContentDetails && item.excerpt && (
                                      <p className="text-sm text-gray-600 mt-1 truncate">
                                        {item.excerpt}
                                      </p>
                                    )}

                                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                      {item.view_count && <span>{item.view_count} views</span>}
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => onContentSelect?.(item.id)}
                                      className="p-2 text-gray-400 hover:text-blue-600 rounded"
                                      title="Edit content"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (currentCollection) {
                                          dispatch(
                                            removeContentFromCollection({
                                              collectionId: currentCollection.id,
                                              contentId: item.id,
                                            })
                                          );
                                        }
                                      }}
                                      className="p-2 text-gray-400 hover:text-red-600 rounded"
                                      title="Remove from collection"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">📚</div>
              <div className="text-gray-500">Select a collection to view its contents</div>
              <div className="text-sm text-gray-400 mt-1">
                Choose from the collections on the left
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Collection Modal */}
      {showCreateForm && (
        <CreateCollectionModal
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateCollection}
        />
      )}

      {/* Edit Collection Modal */}
      {editingCollection && (
        <EditCollectionModal
          collection={editingCollection}
          onClose={() => setEditingCollection(null)}
          onSubmit={(data) => handleUpdateCollection(editingCollection.id, data)}
        />
      )}
    </div>
  );
};

// Create Collection Modal Component
const CreateCollectionModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    type: CollectionType;
    is_public: boolean;
  }) => void;
}> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'category' as CollectionType,
    is_public: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Collection</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CollectionType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(COLLECTION_TYPES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {config.name} - {config.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Make this collection public</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Collection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Collection Modal Component
const EditCollectionModal: React.FC<{
  collection: ContentCollection;
  onClose: () => void;
  onSubmit: (data: Partial<ContentCollection>) => void;
}> = ({ collection, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: collection.name,
    description: collection.description || '',
    type: collection.type,
    is_public: collection.is_public,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Collection</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CollectionType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(COLLECTION_TYPES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {config.name} - {config.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Make this collection public</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Update Collection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContentCollectionManager;
