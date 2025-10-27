import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../features/auth';
import { useAppDispatch, useAppSelector } from '../store';
// TODO: Replace with React Query hooks - US-E4-010
// import { useContent, useCreateContent, usePublishContent } from '../queries/content';
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
      (item) => item.ai_enhancement?.content_quality_score
    );
    if (itemsWithScores.length === 0) return 0;
    return Math.round(
      itemsWithScores.reduce(
        (sum, item) => sum + (item.ai_enhancement?.content_quality_score || 0),
        0
      ) / itemsWithScores.length
    );
  }, [contentItems]);

  const publishedCount = useMemo(
    () => contentItems.filter((item) => item.status === 'published').length,
    [contentItems]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[filter.sort_by];
      const bValue = b[filter.sort_by];

      if (filter.sort_order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [contentItems, filter, searchQuery]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <h2 className="text-lg font-semibold text-gray-900">Your Content</h2>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <select
              value={filter.status || ''}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  status: (e.target.value as ContentItem['status']) || undefined,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={`${filter.sort_by}-${filter.sort_order}`}
              onChange={(e) => {
                const [sort_by, sort_order] = e.target.value.split('-');
                setFilter({
                  ...filter,
                  sort_by: sort_by as ContentFilter['sort_by'],
                  sort_order: sort_order as ContentFilter['sort_order'],
                });
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="updated_at-desc">Recently Updated</option>
              <option value="created_at-desc">Recently Created</option>
              <option value="view_count-desc">Most Viewed</option>
              <option value="total_earned_sats-desc">Highest Earnings</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredContent.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No matching content' : 'No content yet'}
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Create your first piece of content to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredContent.map((item) => (
              <div
                key={item.id}
                className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedContent?.id === item.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => onSelectContent(item)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 truncate">{item.title}</h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'draft'
                              ? 'bg-gray-100 text-gray-800'
                              : item.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.ai_enhancement?.content_quality_score && (
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                            item.ai_enhancement.content_quality_score >= 80
                              ? 'bg-green-100 text-green-700'
                              : item.ai_enhancement.content_quality_score >= 60
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          🤖 {item.ai_enhancement.content_quality_score}/100
                        </span>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">{item.description}</p>
                    )}

                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Updated {new Date(item.updated_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{item.view_count} views</span>
                      <span>•</span>
                      <span>{item.total_earned_sats} sats earned</span>
                      {item.tags.length > 0 && (
                        <>
                          <span>•</span>
                          <div className="flex space-x-1">
                            {item.tags.slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                            {item.tags.length > 3 && (
                              <span className="text-gray-400 text-xs">+{item.tags.length - 3}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateContent(item.id);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Duplicate content"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                        <path d="M3 5a2 2 0 012-2 3 3 0 003 3h6a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11.586l-3-3a1 1 0 00-1.414 1.414L11.586 11H9a1 1 0 100 2h2.586l-1 1a1 1 0 001.414 1.414l3-3z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteContent(item.id);
                      }}
                      className="p-2 text-red-400 hover:text-red-600 transition-colors"
                      title="Delete content"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const QuickActions: React.FC<{
  onCreateContent: () => void;
  onAIGenerate: () => void;
  onImportContent: () => void;
  onExportContent: () => void;
}> = ({ onCreateContent, onAIGenerate, onImportContent, onExportContent }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="space-y-3">
        <button
          onClick={onCreateContent}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>Create Content</span>
        </button>

        <button
          onClick={onAIGenerate}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <span className="text-lg">🤖</span>
          <span>AI Generate</span>
        </button>

        <button
          onClick={onImportContent}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>Import</span>
        </button>

        <button
          onClick={onExportContent}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          <span>Export</span>
        </button>
      </div>

      {/* Stats Section */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Your Stats</h4>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>This Month</span>
            <span className="font-medium text-green-600">+2.4k views</span>
          </div>
          <div className="flex justify-between">
            <span>Earnings</span>
            <span className="font-medium text-green-600">+1,250 sats</span>
          </div>
          <div className="flex justify-between">
            <span>AI Score</span>
            <span className="font-medium text-purple-600">87/100</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CreatorDashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { content_items, current_content, loading, error } = useAppSelector((state) => state.cms);

  const [activeView, setActiveView] = useState<'overview' | 'editor'>('overview');
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  useEffect(() => {
    if (user?.nostr_pubkey) {
      // Handle async dispatch with void operator for floating promise
      void dispatch(
        loadContentItems({
          creator_pubkey: user.nostr_pubkey,
          sort_by: 'updated_at',
          sort_order: 'desc',
        })
      );
    }
  }, [dispatch, user?.nostr_pubkey]);

  const handleCreateContent = async (): Promise<void> => {
    try {
      const result = await dispatch(
        createContentItem({
          title: 'New Content',
          content_blocks: [],
        })
      );

      if (result.type.endsWith('fulfilled')) {
        setActiveView('editor');
      }
    } catch (error) {
      console.error('Failed to create content:', error);
    }
  };

  const handleSelectContent = (content: ContentItem): void => {
    dispatch(setCurrentContent(content));
    setActiveView('editor');
  };

  const handleAIGenerate = (): void => {
    setShowAIGenerator(true);
  };

  const handleDeleteContent = (contentId: string): void => {
    if (confirm('Are you sure you want to delete this content?')) {
      // This would dispatch a delete action
      console.log('Deleting content:', contentId);
    }
  };

  const handleDuplicateContent = (contentId: string): void => {
    const originalContent = content_items.find((item) => item.id === contentId);
    if (originalContent) {
      void dispatch(
        createContentItem({
          ...originalContent,
          title: `${originalContent.title} (Copy)`,
          status: 'draft',
        })
      );
    }
  };

  const handlePublishContent = async (
    contentId: string,
    options: ContentPublishOptions
  ): Promise<void> => {
    try {
      await dispatch(publishContentItem({ contentId, options }));
    } catch (error) {
      console.error('Failed to publish content:', error);
    }
  };

  const handleImportContent = (): void => {
    console.log('Import content');
  };

  const handleExportContent = (): void => {
    console.log('Export content');
  };

  const handlePublishClick = (): void => {
    if (current_content) {
      void handlePublishContent(current_content.id, {
        status: 'published',
        visibility: 'public',
        tags: current_content.tags,
        publish_to_nostr: true,
        store_on_ipfs: true,
        store_on_arweave: true,
      });
    }
  };

  const handleCreateClick = (): void => {
    void handleCreateContent();
  };

  const handleDuplicateClick = (contentId: string): void => {
    handleDuplicateContent(contentId);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚡</div>
          <p className="text-gray-600">Loading your creator dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Reload Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full bg-gray-50">
      {activeView === 'overview' ? (
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Creator Dashboard</h1>
                <p className="text-gray-600 mt-1">
                  Manage your content with AI-powered tools and decentralized publishing
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  🟢 Connected to NOSTR
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  ⚡ Lightning Ready
                </span>
              </div>
            </div>
          </div>

          {/* Analytics Dashboard */}
          <AnalyticsDashboard contentItems={content_items} />

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Content List */}
            <div className="lg:col-span-3">
              <EnhancedContentList
                contentItems={content_items}
                onSelectContent={handleSelectContent}
                selectedContent={current_content}
                onDeleteContent={handleDeleteContent}
                onDuplicateContent={handleDuplicateClick}
              />
            </div>

            {/* Quick Actions Sidebar */}
            <div className="lg:col-span-1">
              <QuickActions
                onCreateContent={handleCreateClick}
                onAIGenerate={handleAIGenerate}
                onImportContent={handleImportContent}
                onExportContent={handleExportContent}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Editor Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveView('overview')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Back to Dashboard</span>
              </button>

              {current_content && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handlePublishClick}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Publish
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Universal Content Editor */}
          <UniversalContentEditor />
        </div>
      )}

      {/* AI Content Generator Modal */}
      {showAIGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">🤖 AI Content Generator</h2>
              <button
                onClick={() => setShowAIGenerator(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="text-center">
              <p className="text-gray-600 mb-4">AI content generation will be available here</p>
              <button
                onClick={() => setShowAIGenerator(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorDashboard;
