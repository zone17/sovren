/**
 * Unified Content Library - Consolidated Browsing Interface
 *
 * TODO: Migrate to glass morphism design system (glass-dark, bg-background, text-foreground).
 * Currently uses light-mode Tailwind classes (bg-white, text-gray-900, hover:bg-gray-50).
 */

import { Edit, Eye, Grid, List, Plus, Search, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { AuthenticityBadge } from '@/features/content-shield';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';

// Types
interface ContentItem {
  id: string;
  title: string;
  type: 'article' | 'video' | 'podcast' | 'image' | 'series';
  status: 'draft' | 'published' | 'archived';
  description?: string;
  createdAt: string;
  updatedAt: string;
  author: string;
  tags: string[];
}

interface ContentLibraryProps {
  onCreateNew?: () => void;
  onEditContent?: (contentId: string) => void;
  onViewContent?: (contentId: string) => void;
  onDeleteContent?: (contentId: string) => void;
  className?: string;
}

// #646: Module-scope helpers — avoid per-render recreations
function getStatusColor(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-green-100 text-green-800';
    case 'draft':
      return 'bg-yellow-100 text-yellow-800';
    case 'archived':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'article':
      return '\u{1F4DD}';
    case 'video':
      return '\u{1F3A5}';
    case 'podcast':
      return '\u{1F3A7}';
    case 'image':
      return '\u{1F5BC}\uFE0F';
    case 'series':
      return '\u{1F4DA}';
    default:
      return '\u{1F4C4}';
  }
}

// #646: React.memo at module scope with explicit props interface
interface ContentItemCardProps {
  item: ContentItem;
  viewMode: 'grid' | 'list';
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const ContentItemCard = React.memo<ContentItemCardProps>(
  ({ item, viewMode, onView, onEdit, onDelete }) => {
    if (viewMode === 'list') {
      return (
        <div className="flex items-center justify-between p-4 border-b hover:bg-gray-50">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-2xl">{getTypeIcon(item.type)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                {item.status === 'published' && <AuthenticityBadge contentId={item.id} />}
              </div>
              <p className="text-sm text-gray-600 truncate">{item.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                <span className="text-xs text-gray-500">{item.author}</span>
                <span className="text-xs text-gray-500">&bull;</span>
                <span className="text-xs text-gray-500">
                  {new Date(item.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onView(item.id)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getTypeIcon(item.type)}</span>
              <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => onView(item.id)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-lg leading-tight">{item.title}</CardTitle>
            {item.status === 'published' && <AuthenticityBadge contentId={item.id} />}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{item.author}</span>
            <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    );
  }
);

// Static mock data — moved to module scope to avoid per-render recreation
const MOCK_CONTENT: ContentItem[] = [
  {
    id: '1',
    title: 'Getting Started with Lightning Network',
    type: 'article',
    status: 'published',
    description:
      'A comprehensive guide to understanding and using the Lightning Network for fast Bitcoin payments.',
    createdAt: '2024-12-01T10:00:00Z',
    updatedAt: '2024-12-15T14:30:00Z',
    author: 'John Doe',
    tags: ['bitcoin', 'lightning', 'tutorial'],
  },
  {
    id: '2',
    title: 'NOSTR Protocol Deep Dive',
    type: 'video',
    status: 'draft',
    description:
      'Technical exploration of the NOSTR protocol and its implications for decentralized social media.',
    createdAt: '2024-12-10T09:15:00Z',
    updatedAt: '2024-12-20T16:45:00Z',
    author: 'Jane Smith',
    tags: ['nostr', 'protocol', 'decentralized'],
  },
];

export const ContentLibrary: React.FC<ContentLibraryProps> = ({
  onCreateNew,
  onEditContent,
  onViewContent,
  onDeleteContent,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredContent = useMemo(() => {
    return MOCK_CONTENT.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = selectedType === 'all' || item.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [searchQuery, selectedType, selectedStatus]);

  const handleView = useCallback(
    (contentId: string) => {
      onViewContent?.(contentId);
    },
    [onViewContent]
  );

  const handleEdit = useCallback(
    (contentId: string) => {
      onEditContent?.(contentId);
    },
    [onEditContent]
  );

  const handleDelete = useCallback(
    (contentId: string) => {
      if (window.confirm('Are you sure you want to delete this content?')) {
        onDeleteContent?.(contentId);
      }
    },
    [onDeleteContent]
  );

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-6 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create New
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search content..."
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Types</option>
              <option value="article">Articles</option>
              <option value="video">Videos</option>
              <option value="podcast">Podcasts</option>
              <option value="image">Images</option>
              <option value="series">Series</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>

            <div className="flex border border-gray-300 rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid/List */}
      <div className="flex-1 overflow-auto p-6">
        {filteredContent.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">{'\u{1F4DA}'}</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Content Found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || selectedType !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your search criteria or filters.'
                : 'Create your first piece of content to get started.'}
            </p>
            {!searchQuery && selectedType === 'all' && selectedStatus === 'all' && (
              <Button onClick={onCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Content
              </Button>
            )}
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'space-y-0 border border-gray-200 rounded-lg overflow-hidden'
            }
          >
            {filteredContent.map((item) => (
              <ContentItemCard
                key={item.id}
                item={item}
                viewMode={viewMode}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentLibrary;
