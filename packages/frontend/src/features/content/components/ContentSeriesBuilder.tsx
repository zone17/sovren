/**
 * 📚 **CONTENT SERIES BUILDER COMPONENT**
 *
 * Elite Engineering Standards:
 * - Sequential content organization
 * - Drag & drop episode ordering
 * - Progress tracking
 * - Prerequisites management
 * - Mobile-first design
 * - Accessibility compliance
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import { useAppDispatch, useAppSelector } from '../../../store';
import {
  addEpisodeToSeries,
  createContentSeries,
  deleteContentSeries,
  fetchContentSeries,
  removeEpisodeFromSeries,
  reorderSeriesEpisodes,
  updateContentSeries,
  updateEpisodeProgress,
} from '../../../store/slices/tempStubs' // TODO: US-E4-010;
import type { ContentItem, ContentSeries } from '../../../types/content';

// Series difficulty levels
const DIFFICULTY_LEVELS = {
  beginner: { name: 'Beginner', icon: '🌱', color: 'green' },
  intermediate: { name: 'Intermediate', icon: '🌿', color: 'yellow' },
  advanced: { name: 'Advanced', icon: '🌳', color: 'red' },
  expert: { name: 'Expert', icon: '🏔️', color: 'purple' },
};

// Series categories
const SERIES_CATEGORIES = {
  course: { name: 'Course', icon: '🎓', description: 'Structured learning path' },
  tutorial: { name: 'Tutorial', icon: '📖', description: 'Step-by-step guide' },
  workshop: { name: 'Workshop', icon: '🔧', description: 'Hands-on practice' },
  masterclass: { name: 'Masterclass', icon: '👨‍🏫', description: 'Expert-level deep dive' },
  bootcamp: { name: 'Bootcamp', icon: '💪', description: 'Intensive training' },
};

interface ContentSeriesBuilderProps {
  selectedSeries?: string;
  onSeriesSelect?: (seriesId: string) => void;
  onEpisodeSelect?: (episodeId: string) => void;
  allowReordering?: boolean;
  showProgress?: boolean;
  className?: string;
}

export const ContentSeriesBuilder: React.FC<ContentSeriesBuilderProps> = ({
  selectedSeries,
  onSeriesSelect,
  onEpisodeSelect,
  allowReordering = true,
  showProgress = true,
  className = '',
}) => {
  const dispatch = useAppDispatch();
  const { content_series, content_items, loading } = useAppSelector((state) => state.cms);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<keyof typeof SERIES_CATEGORIES | 'all'>(
    'all'
  );
  const [filterDifficulty, setFilterDifficulty] = useState<keyof typeof DIFFICULTY_LEVELS | 'all'>(
    'all'
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSeries, setEditingSeries] = useState<ContentSeries | null>(null);
  const [showAddEpisode, setShowAddEpisode] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Set<string>>(new Set());

  // Load series on mount
  useEffect(() => {
    dispatch(fetchContentSeries());
  }, [dispatch]);

  // Filter series
  const filteredSeries = useMemo(() => {
    return content_series.filter((series) => {
      const matchesSearch =
        series.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        series.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || series.category === filterCategory;
      const matchesDifficulty =
        filterDifficulty === 'all' || series.difficulty_level === filterDifficulty;
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [content_series, searchTerm, filterCategory, filterDifficulty]);

  // Get current series
  const currentSeries = selectedSeries ? content_series.find((s) => s.id === selectedSeries) : null;

  // Get series episodes with content details
  const seriesEpisodes = useMemo(() => {
    if (!currentSeries?.episodes) return [];

    return currentSeries.episodes
      .sort((a, b) => a.order_index - b.order_index)
      .map((episode) => ({
        ...episode,
        content: content_items.find((item) => item.id === episode.content_id),
      }));
  }, [currentSeries, content_items]);

  // Calculate series progress
  const seriesProgress = useMemo(() => {
    if (!currentSeries?.episodes || currentSeries.episodes.length === 0) return 0;

    const completedEpisodes = currentSeries.episodes.filter((ep) => ep.is_completed).length;
    return Math.round((completedEpisodes / currentSeries.episodes.length) * 100);
  }, [currentSeries]);

  // Handle series creation
  const handleCreateSeries = useCallback(
    async (data: {
      title: string;
      description: string;
      category: keyof typeof SERIES_CATEGORIES;
      difficulty_level: keyof typeof DIFFICULTY_LEVELS;
      is_premium: boolean;
      price?: number;
    }) => {
      try {
        const result = await dispatch(createContentSeries(data)).unwrap();
        setShowCreateForm(false);
        onSeriesSelect?.(result.id);
      } catch (error) {
        console.error('Failed to create series:', error);
      }
    },
    [dispatch, onSeriesSelect]
  );

  // Handle series update
  const handleUpdateSeries = useCallback(
    async (id: string, data: Partial<ContentSeries>) => {
      try {
        await dispatch(updateContentSeries({ id, data })).unwrap();
        setEditingSeries(null);
      } catch (error) {
        console.error('Failed to update series:', error);
      }
    },
    [dispatch]
  );

  // Handle series deletion
  const handleDeleteSeries = useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to delete this series?')) return;

      try {
        await dispatch(deleteContentSeries(id)).unwrap();
        if (selectedSeries === id) {
          onSeriesSelect?.('');
        }
      } catch (error) {
        console.error('Failed to delete series:', error);
      }
    },
    [dispatch, selectedSeries, onSeriesSelect]
  );

  // Handle episode reordering
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination || !currentSeries) return;

      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;

      if (sourceIndex === destinationIndex) return;

      dispatch(
        reorderSeriesEpisodes({
          seriesId: currentSeries.id,
          sourceIndex,
          destinationIndex,
        })
      );
    },
    [dispatch, currentSeries]
  );

  // Handle adding episodes to series
  const handleAddEpisodes = useCallback(async () => {
    if (!currentSeries || selectedContent.size === 0) return;

    try {
      for (const contentId of selectedContent) {
        await dispatch(
          addEpisodeToSeries({
            seriesId: currentSeries.id,
            contentId,
            orderIndex: currentSeries.episodes?.length || 0,
          })
        ).unwrap();
      }
      setSelectedContent(new Set());
      setShowAddEpisode(false);
    } catch (error) {
      console.error('Failed to add episodes:', error);
    }
  }, [dispatch, currentSeries, selectedContent]);

  // Handle episode removal
  const handleRemoveEpisode = useCallback(
    async (episodeId: string) => {
      if (!currentSeries || !confirm('Remove this episode from the series?')) return;

      try {
        await dispatch(
          removeEpisodeFromSeries({
            seriesId: currentSeries.id,
            episodeId,
          })
        ).unwrap();
      } catch (error) {
        console.error('Failed to remove episode:', error);
      }
    },
    [dispatch, currentSeries]
  );

  // Handle episode completion toggle
  const handleToggleEpisodeCompletion = useCallback(
    async (episodeId: string, completed: boolean) => {
      if (!currentSeries) return;

      try {
        await dispatch(
          updateEpisodeProgress({
            seriesId: currentSeries.id,
            episodeId,
            isCompleted: completed,
            completedAt: completed ? new Date().toISOString() : null,
          })
        ).unwrap();
      } catch (error) {
        console.error('Failed to update episode progress:', error);
      }
    },
    [dispatch, currentSeries]
  );

  // Get available content for adding to series
  const availableContent = useMemo(() => {
    const usedContentIds = new Set(
      content_series.flatMap((series) => series.episodes?.map((ep) => ep.content_id) || [])
    );

    return content_items.filter(
      (item) =>
        !usedContentIds.has(item.id) &&
        item.status === 'published' &&
        (item.content_type === 'article' ||
          item.content_type === 'video' ||
          item.content_type === 'audio')
    );
  }, [content_items, content_series]);

  return (
    <div className={`content-series-builder h-full flex ${className}`}>
      {/* Series Sidebar */}
      <div className="w-1/3 border-r border-gray-200 bg-gray-50">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Content Series</h2>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              + New Series
            </button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search series..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <div className="flex space-x-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as typeof filterCategory)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(SERIES_CATEGORIES).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.name}
                  </option>
                ))}
              </select>

              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value as typeof filterDifficulty)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Levels</option>
                {Object.entries(DIFFICULTY_LEVELS).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Series List */}
        <div className="overflow-y-auto h-full">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : filteredSeries.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'No series found' : 'No series yet'}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredSeries.map((series) => (
                <div
                  key={series.id}
                  onClick={() => onSeriesSelect?.(series.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedSeries === series.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-white hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">
                          {SERIES_CATEGORIES[series.category]?.icon || '📚'}
                        </span>
                        <span className="font-medium text-gray-900 truncate">{series.title}</span>
                        {series.is_premium && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">
                            Premium
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mb-2">
                        <span
                          className={`text-xs px-2 py-1 rounded text-${DIFFICULTY_LEVELS[series.difficulty_level]?.color}-800 bg-${DIFFICULTY_LEVELS[series.difficulty_level]?.color}-100`}
                        >
                          {DIFFICULTY_LEVELS[series.difficulty_level]?.icon}{' '}
                          {DIFFICULTY_LEVELS[series.difficulty_level]?.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {series.episodes?.length || 0} episodes
                        </span>
                      </div>

                      {showProgress && series.episodes && series.episodes.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>
                              {Math.round(
                                (series.episodes.filter((ep) => ep.is_completed).length /
                                  series.episodes.length) *
                                  100
                              )}
                              %
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div
                              className="bg-green-500 h-1 rounded-full transition-all duration-300"
                              style={{
                                width: `${(series.episodes.filter((ep) => ep.is_completed).length / series.episodes.length) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {series.description && (
                        <p className="text-sm text-gray-600 truncate">{series.description}</p>
                      )}

                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>{new Date(series.created_at).toLocaleDateString()}</span>
                        {series.is_premium && series.price && <span>${series.price}</span>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSeries(series);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        title="Edit series"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSeries(series.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Delete series"
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

      {/* Series Content */}
      <div className="flex-1 flex flex-col">
        {currentSeries ? (
          <>
            {/* Series Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {SERIES_CATEGORIES[currentSeries.category]?.icon || '📚'}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{currentSeries.title}</h3>
                    {currentSeries.description && (
                      <p className="text-sm text-gray-600">{currentSeries.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs px-2 py-1 rounded text-${DIFFICULTY_LEVELS[currentSeries.difficulty_level]?.color}-800 bg-${DIFFICULTY_LEVELS[currentSeries.difficulty_level]?.color}-100`}
                  >
                    {DIFFICULTY_LEVELS[currentSeries.difficulty_level]?.icon}{' '}
                    {DIFFICULTY_LEVELS[currentSeries.difficulty_level]?.name}
                  </span>
                  {currentSeries.is_premium && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Premium ${currentSeries.price}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAddEpisode(true)}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                  >
                    + Add Episode
                  </button>
                </div>
              </div>

              {/* Series Stats */}
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <span>{seriesEpisodes.length} episodes</span>
                {showProgress && (
                  <>
                    <span>{seriesProgress}% complete</span>
                    <div className="flex items-center space-x-2">
                      <span>Progress:</span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${seriesProgress}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
                <span>Created {new Date(currentSeries.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Episodes List */}
            <div className="flex-1 overflow-y-auto">
              {seriesEpisodes.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-4">📺</div>
                  <div className="text-gray-500">No episodes in this series yet</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Add content to create your first episode
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddEpisode(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add First Episode
                  </button>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="series-episodes" isDropDisabled={!allowReordering}>
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="p-4 space-y-2"
                      >
                        {seriesEpisodes.map((episode, index) => (
                          <Draggable
                            key={episode.id}
                            draggableId={episode.id}
                            index={index}
                            isDragDisabled={!allowReordering}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`bg-white border border-gray-200 rounded-lg p-4 transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                                } ${episode.is_completed ? 'bg-green-50 border-green-200' : ''}`}
                              >
                                <div className="flex items-center space-x-3">
                                  {showProgress && (
                                    <input
                                      type="checkbox"
                                      checked={episode.is_completed}
                                      onChange={(e) =>
                                        handleToggleEpisodeCompletion(episode.id, e.target.checked)
                                      }
                                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                  )}

                                  {allowReordering && (
                                    <div
                                      {...provided.dragHandleProps}
                                      className="text-gray-400 hover:text-gray-600 cursor-grab"
                                    >
                                      ⋮⋮
                                    </div>
                                  )}

                                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                    {index + 1}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-lg">
                                        {episode.content?.content_type === 'article'
                                          ? '📄'
                                          : episode.content?.content_type === 'video'
                                            ? '🎬'
                                            : episode.content?.content_type === 'audio'
                                              ? '🎵'
                                              : '📁'}
                                      </span>
                                      <h4 className="font-medium text-gray-900 truncate">
                                        {episode.content?.title || 'Untitled Episode'}
                                      </h4>
                                      {episode.is_required && (
                                        <span className="text-xs bg-red-100 text-red-800 px-1 rounded">
                                          Required
                                        </span>
                                      )}
                                      {episode.is_completed && (
                                        <span className="text-xs bg-green-100 text-green-800 px-1 rounded">
                                          ✓ Complete
                                        </span>
                                      )}
                                    </div>

                                    {episode.content?.excerpt && (
                                      <p className="text-sm text-gray-600 mt-1 truncate">
                                        {episode.content.excerpt}
                                      </p>
                                    )}

                                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                                      <div className="flex items-center space-x-4">
                                        {episode.estimated_duration && (
                                          <span>⏱️ {episode.estimated_duration} min</span>
                                        )}
                                        {episode.content?.view_count && (
                                          <span>👁️ {episode.content.view_count} views</span>
                                        )}
                                        {episode.completed_at && (
                                          <span>
                                            ✅ {new Date(episode.completed_at).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => onEpisodeSelect?.(episode.content_id)}
                                      className="p-2 text-gray-400 hover:text-blue-600 rounded"
                                      title="Edit episode content"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEpisode(episode.id)}
                                      className="p-2 text-gray-400 hover:text-red-600 rounded"
                                      title="Remove episode"
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
              <div className="text-gray-500">Select a series to view its episodes</div>
              <div className="text-sm text-gray-400 mt-1">
                Choose from the series on the left or create a new one
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Series Modal */}
      {showCreateForm && (
        <CreateSeriesModal onClose={() => setShowCreateForm(false)} onSubmit={handleCreateSeries} />
      )}

      {/* Edit Series Modal */}
      {editingSeries && (
        <EditSeriesModal
          series={editingSeries}
          onClose={() => setEditingSeries(null)}
          onSubmit={(data) => handleUpdateSeries(editingSeries.id, data)}
        />
      )}

      {/* Add Episode Modal */}
      {showAddEpisode && currentSeries && (
        <AddEpisodeModal
          availableContent={availableContent}
          selectedContent={selectedContent}
          onContentSelect={setSelectedContent}
          onClose={() => {
            setShowAddEpisode(false);
            setSelectedContent(new Set());
          }}
          onSubmit={handleAddEpisodes}
        />
      )}
    </div>
  );
};

// Create Series Modal Component
const CreateSeriesModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    category: keyof typeof SERIES_CATEGORIES;
    difficulty_level: keyof typeof DIFFICULTY_LEVELS;
    is_premium: boolean;
    price?: number;
  }) => void;
}> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'course' as keyof typeof SERIES_CATEGORIES,
    difficulty_level: 'beginner' as keyof typeof DIFFICULTY_LEVELS,
    is_premium: false,
    price: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Series</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category: e.target.value as keyof typeof SERIES_CATEGORIES,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(SERIES_CATEGORIES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {config.name} - {config.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty Level</label>
            <select
              value={formData.difficulty_level}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  difficulty_level: e.target.value as keyof typeof DIFFICULTY_LEVELS,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(DIFFICULTY_LEVELS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {config.name}
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
                checked={formData.is_premium}
                onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Premium series</span>
            </label>
          </div>

          {formData.is_premium && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

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
              Create Series
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Series Modal Component
const EditSeriesModal: React.FC<{
  series: ContentSeries;
  onClose: () => void;
  onSubmit: (data: Partial<ContentSeries>) => void;
}> = ({ series, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: series.title,
    description: series.description || '',
    category: series.category,
    difficulty_level: series.difficulty_level,
    is_premium: series.is_premium,
    price: series.price || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Series</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category: e.target.value as keyof typeof SERIES_CATEGORIES,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(SERIES_CATEGORIES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {config.name} - {config.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty Level</label>
            <select
              value={formData.difficulty_level}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  difficulty_level: e.target.value as keyof typeof DIFFICULTY_LEVELS,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(DIFFICULTY_LEVELS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {config.name}
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
                checked={formData.is_premium}
                onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Premium series</span>
            </label>
          </div>

          {formData.is_premium && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

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
              Update Series
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Episode Modal Component
const AddEpisodeModal: React.FC<{
  availableContent: ContentItem[];
  selectedContent: Set<string>;
  onContentSelect: (selected: Set<string>) => void;
  onClose: () => void;
  onSubmit: () => void;
}> = ({ availableContent, selectedContent, onContentSelect, onClose, onSubmit }) => {
  const handleContentToggle = (contentId: string) => {
    const newSelected = new Set(selectedContent);
    if (newSelected.has(contentId)) {
      newSelected.delete(contentId);
    } else {
      newSelected.add(contentId);
    }
    onContentSelect(newSelected);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Episodes to Series</h3>

        {availableContent.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📄</div>
            <div className="text-gray-500">No available content</div>
            <div className="text-sm text-gray-400">
              All published content is already in a series
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Select content to add as episodes ({selectedContent.size} selected)
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableContent.map((content) => (
                <div
                  key={content.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedContent.has(content.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleContentToggle(content.id)}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedContent.has(content.id)}
                      onChange={() => handleContentToggle(content.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-lg">
                      {content.content_type === 'article'
                        ? '📄'
                        : content.content_type === 'video'
                          ? '🎬'
                          : content.content_type === 'audio'
                            ? '🎵'
                            : '📁'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{content.title}</h4>
                      {content.excerpt && (
                        <p className="text-sm text-gray-600 truncate">{content.excerpt}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                        <span>{content.content_type}</span>
                        <span>{new Date(content.created_at).toLocaleDateString()}</span>
                        {content.view_count && <span>{content.view_count} views</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={selectedContent.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Add {selectedContent.size} Episode{selectedContent.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentSeriesBuilder;
