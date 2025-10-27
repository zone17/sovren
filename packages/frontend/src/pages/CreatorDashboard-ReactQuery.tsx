import React, { useMemo, useState } from 'react';
import { useAuth } from '../features/auth';
import { useAppDispatch, useAppSelector } from '../store';

// React Query hooks from Wave 2a
import { useContent } from '../queries/content/useContent';
import { useContentItem } from '../queries/content/useContentItem';
import { useContentStream } from '../queries/content/useContentStream';

// UI state selectors (client-side state remains in Redux)
import {
  selectEditorState,
  selectPreviewMode,
  selectDrafts
} from '../store';

import type { ContentFilter, ContentItem, ContentPublishOptions } from '../types/content';

// Import UI components from new structure
import UniversalContentEditor from '../features/content/components/ContentEditor';

// Enhanced Analytics Dashboard Component
const AnalyticsDashboard: React.FC<{
  contentItems: ContentItem[];
}> = ({ contentItems }) => {
  const totalViews = useMemo(
    () => contentItems.reduce((sum, item) => sum + item.view_count, 0),
    [contentItems]
  );

  const totalEarnings = useMemo(
    () => contentItems.reduce((sum, item) => sum + item.total_earned_sats, 0),
    [contentItems]
  );

  const avgQualityScore = useMemo(() => {
    const itemsWithScores = contentItems.filter(
      (item) => item.ai_quality_score !== undefined
    );
    if (itemsWithScores.length === 0) return 85;
    const totalScore = itemsWithScores.reduce(
      (sum, item) => sum + (item.ai_quality_score || 0),
      0
    );
    return Math.round(totalScore / itemsWithScores.length);
  }, [contentItems]);

  const publishedCount = useMemo(
    () => contentItems.filter((item) => item.status === 'published').length,
    [contentItems]
  );

  // Same JSX as before...
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Views */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">Total Views</p>
            <p className="text-3xl font-bold">{totalViews.toLocaleString()}</p>
          </div>
          <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
        <div className="mt-4 flex items-center text-blue-100 text-sm">
          <span className="text-green-300">↗ +12.5%</span>
          <span className="ml-2">vs last month</span>
        </div>
      </div>

      {/* Total Earnings */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm font-medium">Earnings</p>
            <p className="text-3xl font-bold">{totalEarnings.toLocaleString()}</p>
            <p className="text-green-100 text-xs">sats</p>
          </div>
          <div className="bg-green-400 bg-opacity-30 rounded-lg p-3">
            <span className="text-2xl">⚡</span>
          </div>
        </div>
        <div className="mt-4 flex items-center text-green-100 text-sm">
          <span className="text-yellow-300">↗ +8.2%</span>
          <span className="ml-2">vs last month</span>
        </div>
      </div>

      {/* Content Quality */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100 text-sm font-medium">AI Quality Score</p>
            <p className="text-3xl font-bold">{avgQualityScore}</p>
            <p className="text-purple-100 text-xs">/100</p>
          </div>
          <div className="bg-purple-400 bg-opacity-30 rounded-lg p-3">
            <span className="text-2xl">🤖</span>
          </div>
        </div>
        <div className="mt-4 flex items-center text-purple-100 text-sm">
          <span className="text-green-300">↗ Quality improving</span>
        </div>
      </div>

      {/* Published Content */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-sm font-medium">Published</p>
            <p className="text-3xl font-bold">{publishedCount}</p>
            <p className="text-orange-100 text-xs">pieces</p>
          </div>
          <div className="bg-orange-400 bg-opacity-30 rounded-lg p-3">
            <span className="text-2xl">📝</span>
          </div>
        </div>
        <div className="mt-4 flex items-center text-orange-100 text-sm">
          <span className="text-green-300">↗ Keep creating!</span>
        </div>
      </div>
    </div>
  );
};

const EnhancedContentList: React.FC<{
  contentItems: ContentItem[];
  onSelectContent: (content: ContentItem) => void;
  selectedContent: ContentItem | null;
  onDeleteContent: (id: string) => void;
  onDuplicateContent: (id: string) => void;
}> = ({ contentItems, onSelectContent, selectedContent, onDeleteContent, onDuplicateContent }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ContentFilter>({
    sort_by: 'updated_at',
    sort_order: 'desc',
  });

  const filteredContent = useMemo(() => {
    let filtered = [...contentItems];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (filter.status) {
      filtered = filtered.filter((item) => item.status === filter.status);
    }

    // Apply tags filter
    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter((item) =>
        filter.tags!.some((tag) => item.tags.includes(tag))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const field = filter.sort_by;
      const order = filter.sort_order === 'asc' ? 1 : -1;

      if (field === 'title') {
        return a.title.localeCompare(b.title) * order;
      } else if (field === 'created_at' || field === 'updated_at' || field === 'published_at') {
        const aDate = new Date(a[field as keyof ContentItem] as string).getTime();
        const bDate = new Date(b[field as keyof ContentItem] as string).getTime();
        return (aDate - bDate) * order;
      } else if (field === 'view_count' || field === 'like_count' || field === 'total_earned_sats') {
        const aValue = a[field as keyof ContentItem] as number;
        const bValue = b[field as keyof ContentItem] as number;
        return (aValue - bValue) * order;
      }
      return 0;
    });

    return filtered;
  }, [contentItems, searchQuery, filter]);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Search and Filters */}
      <div className="p-6 bg-gray-50 border-b">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filter.status || ''}
            onChange={(e) => setFilter({ ...filter, status: e.target.value as any || undefined })}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
            <option value="scheduled">Scheduled</option>
          </select>
          <select
            value={filter.sort_by}
            onChange={(e) => setFilter({ ...filter, sort_by: e.target.value as any })}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="updated_at">Last Modified</option>
            <option value="created_at">Created</option>
            <option value="title">Title</option>
            <option value="view_count">Views</option>
            <option value="total_earned_sats">Earnings</option>
          </select>
        </div>
      </div>

      {/* Content List */}
      <div className="divide-y divide-gray-100">
        {filteredContent.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectContent(item)}
            className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
              selectedContent?.id === item.id ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                {item.description && (
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.description}</p>
                )}
                <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                  <span className={`px-2 py-1 rounded-full ${
                    item.status === 'published' ? 'bg-green-100 text-green-700' :
                    item.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    item.status === 'archived' ? 'bg-gray-100 text-gray-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {item.status}
                  </span>
                  <span>👁 {item.view_count}</span>
                  <span>❤️ {item.like_count}</span>
                  <span>⚡ {item.total_earned_sats}</span>
                  <span>Updated {new Date(item.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="ml-4 flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateContent(item.id);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Duplicate"
                >
                  📋
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteContent(item.id);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredContent.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No content found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
};

// Main Creator Dashboard Component with React Query
export default function CreatorDashboard(): React.ReactElement {
  const { user } = useAuth();
  const dispatch = useAppDispatch();

  // React Query hooks for server data
  const { data: contentItems = [], isLoading, error, refetch } = useContent({
    creator_id: user?.id,
  });

  // Redux selectors for UI state only
  const editorState = useAppSelector(selectEditorState);
  const previewMode = useAppSelector(selectPreviewMode);
  const drafts = useAppSelector(selectDrafts);

  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

  // Use React Query for specific content item
  const { data: selectedContent } = useContentItem(selectedContentId || '', {
    enabled: !!selectedContentId,
  });

  // Use real-time stream for updates
  useContentStream({
    onNewContent: () => refetch(),
    onContentUpdate: () => refetch(),
    onContentDelete: () => refetch(),
  });

  const handleCreateContent = async () => {
    // This will be handled by a mutation hook in the full implementation
    console.log('Creating new content...');
  };

  const handlePublishContent = async (options: ContentPublishOptions) => {
    // This will be handled by a mutation hook in the full implementation
    console.log('Publishing content with options:', options);
  };

  const handleDeleteContent = async (id: string) => {
    // This will be handled by a mutation hook in the full implementation
    console.log('Deleting content:', id);
  };

  const handleDuplicateContent = async (id: string) => {
    // This will be handled by a mutation hook in the full implementation
    console.log('Duplicating content:', id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Error loading content</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Creator Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Manage your content, track performance, and engage with your audience
          </p>
        </div>

        {/* Analytics Dashboard */}
        <div className="mb-8">
          <AnalyticsDashboard contentItems={contentItems} />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Content List - Left Side */}
          <div className="lg:col-span-1">
            <div className="mb-4">
              <button
                onClick={handleCreateContent}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                ✨ Create New Content
              </button>
            </div>
            <EnhancedContentList
              contentItems={contentItems}
              onSelectContent={(content) => setSelectedContentId(content.id)}
              selectedContent={selectedContent || null}
              onDeleteContent={handleDeleteContent}
              onDuplicateContent={handleDuplicateContent}
            />
          </div>

          {/* Content Editor - Right Side */}
          <div className="lg:col-span-2">
            {selectedContent ? (
              <div className="bg-white rounded-xl shadow-md p-6">
                <UniversalContentEditor
                  contentItem={selectedContent}
                  onSave={() => refetch()}
                  onPublish={() => handlePublishContent({ immediate: true })}
                  autoSaveInterval={30000}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-12">
                <div className="text-center text-gray-500">
                  <span className="text-6xl">📝</span>
                  <p className="mt-4 text-lg">Select content to edit or create new content</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}