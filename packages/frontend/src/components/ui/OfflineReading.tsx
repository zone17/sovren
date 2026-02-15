import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Progress } from './progress';
import { Slider } from './slider';
import { Switch } from './switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

// ===================================================================
// US-093: OFFLINE READING MODE - LEGENDARY TIER
// ===================================================================

// 6.11.1. Create offline article viewer
const ReadingProgressSchema = z.object({
  articleId: z.string(),
  progress: z.number().min(0).max(1),
  lastPosition: z.number().default(0),
  timeSpent: z.number().default(0),
  lastReadAt: z.date(),
  isCompleted: z.boolean().default(false),
  readingSpeed: z.number().default(250), // words per minute
});

const BookmarkSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  position: z.number(),
  note: z.string().optional(),
  createdAt: z.date(),
  tags: z.array(z.string()).default([]),
});

const ReadingPreferencesSchema = z.object({
  fontSize: z.number().min(12).max(24).default(16),
  fontFamily: z.enum(['serif', 'sans-serif', 'monospace']).default('serif'),
  lineHeight: z.number().min(1.2).max(2.0).default(1.6),
  theme: z.enum(['light', 'dark', 'sepia']).default('light'),
  textAlign: z.enum(['left', 'center', 'justify']).default('left'),
  columnWidth: z.number().min(400).max(800).default(600),
  nightMode: z.boolean().default(false),
  autoNightMode: z.boolean().default(true),
  highlightColor: z.string().default('#ffeb3b'),
});

const ArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  publishedAt: z.date(),
  estimatedReadTime: z.number(),
  wordCount: z.number(),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  isOfflineAvailable: z.boolean().default(false),
  lastSyncedAt: z.date().optional(),
});

const ReadingSessionSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  startTime: z.date(),
  endTime: z.date().optional(),
  duration: z.number().default(0),
  progress: z.number().min(0).max(1).default(0),
  wordsRead: z.number().default(0),
  averageWPM: z.number().default(0),
});

// Types
type ReadingProgress = z.infer<typeof ReadingProgressSchema>;
type Bookmark = z.infer<typeof BookmarkSchema>;
type ReadingPreferences = z.infer<typeof ReadingPreferencesSchema>;
type Article = z.infer<typeof ArticleSchema>;
type ReadingSession = z.infer<typeof ReadingSessionSchema>;

interface OfflineReadingProps {
  enableProgressTracking?: boolean;
  enableBookmarks?: boolean;
  enableSearchInContent?: boolean;
  enableReadingAnalytics?: boolean;
  autoSaveProgress?: boolean;
  className?: string;
}

// 6.11.2. Add reading progress tracking
class ReadingProgressManager {
  private static instance: ReadingProgressManager;
  private progressMap: Map<string, ReadingProgress> = new Map();
  private sessions: Map<string, ReadingSession> = new Map();
  private currentSession: ReadingSession | null = null;
  private sessionInterval: NodeJS.Timeout | null = null;

  static getInstance(): ReadingProgressManager {
    if (!ReadingProgressManager.instance) {
      ReadingProgressManager.instance = new ReadingProgressManager();
    }
    return ReadingProgressManager.instance;
  }

  startReadingSession(articleId: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    this.currentSession = {
      id: sessionId,
      articleId,
      startTime: new Date(),
      duration: 0,
      progress: 0,
      wordsRead: 0,
      averageWPM: 0,
    };

    this.sessions.set(sessionId, this.currentSession);

    // Update session every 10 seconds
    this.sessionInterval = setInterval(() => {
      this.updateCurrentSession();
    }, 10000);

    return sessionId;
  }

  endReadingSession(): ReadingSession | null {
    if (!this.currentSession) return null;

    this.currentSession.endTime = new Date();
    this.currentSession.duration =
      this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();

    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
    }

    const session = { ...this.currentSession };
    this.currentSession = null;
    return session;
  }

  private updateCurrentSession(): void {
    if (!this.currentSession) return;

    const now = new Date();
    this.currentSession.duration = now.getTime() - this.currentSession.startTime.getTime();

    if (this.currentSession.duration > 0 && this.currentSession.wordsRead > 0) {
      const minutes = this.currentSession.duration / (1000 * 60);
      this.currentSession.averageWPM = Math.round(this.currentSession.wordsRead / minutes);
    }
  }

  updateProgress(articleId: string, progress: number, position: number, wordsRead: number): void {
    const existingProgress = this.progressMap.get(articleId);

    const updatedProgress: ReadingProgress = {
      articleId,
      progress: Math.max(progress, existingProgress?.progress || 0),
      lastPosition: position,
      timeSpent: (existingProgress?.timeSpent || 0) + 10000, // Add 10 seconds
      lastReadAt: new Date(),
      isCompleted: progress >= 0.95,
      readingSpeed: this.calculateReadingSpeed(articleId, wordsRead),
    };

    this.progressMap.set(articleId, updatedProgress);

    // Update current session
    if (this.currentSession && this.currentSession.articleId === articleId) {
      this.currentSession.progress = progress;
      this.currentSession.wordsRead = wordsRead;
    }
  }

  private calculateReadingSpeed(articleId: string, wordsRead: number): number {
    const progress = this.progressMap.get(articleId);
    if (!progress || progress.timeSpent === 0) return 250; // Default WPM

    const minutes = progress.timeSpent / (1000 * 60);
    return Math.round(wordsRead / minutes);
  }

  getProgress(articleId: string): ReadingProgress | null {
    return this.progressMap.get(articleId) || null;
  }

  getAllProgress(): ReadingProgress[] {
    return Array.from(this.progressMap.values());
  }

  getSessions(articleId?: string): ReadingSession[] {
    const sessions = Array.from(this.sessions.values());
    return articleId ? sessions.filter((s) => s.articleId === articleId) : sessions;
  }

  getReadingStats(): {
    totalTimeSpent: number;
    totalArticlesRead: number;
    averageReadingSpeed: number;
    totalWordsRead: number;
  } {
    const progressList = this.getAllProgress();

    return {
      totalTimeSpent: progressList.reduce((sum, p) => sum + p.timeSpent, 0),
      totalArticlesRead: progressList.filter((p) => p.isCompleted).length,
      averageReadingSpeed:
        progressList.reduce((sum, p) => sum + p.readingSpeed, 0) / progressList.length || 0,
      totalWordsRead: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.wordsRead, 0),
    };
  }
}

// 6.11.3. Implement offline content synchronization
class OfflineContentManager {
  private static instance: OfflineContentManager;
  private articles: Map<string, Article> = new Map();
  private syncQueue: Set<string> = new Set();

  static getInstance(): OfflineContentManager {
    if (!OfflineContentManager.instance) {
      OfflineContentManager.instance = new OfflineContentManager();
    }
    return OfflineContentManager.instance;
  }

  async downloadForOffline(articleId: string): Promise<void> {
    try {
      // Simulate downloading article content
      const article = this.generateSampleArticle(articleId);
      article.isOfflineAvailable = true;
      article.lastSyncedAt = new Date();

      this.articles.set(articleId, article);
      console.log(`Article ${articleId} downloaded for offline reading`);
    } catch (error) {
      console.error('Failed to download article:', error);
      throw error;
    }
  }

  async syncOfflineContent(): Promise<void> {
    const offlineArticles = Array.from(this.articles.values()).filter(
      (article) => article.isOfflineAvailable
    );

    for (const article of offlineArticles) {
      try {
        // Simulate syncing updated content
        article.lastSyncedAt = new Date();
        this.articles.set(article.id, article);
      } catch (error) {
        console.error(`Failed to sync article ${article.id}:`, error);
      }
    }
  }

  getOfflineArticles(): Article[] {
    return Array.from(this.articles.values())
      .filter((article) => article.isOfflineAvailable)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  getArticle(id: string): Article | null {
    return this.articles.get(id) || null;
  }

  searchArticles(query: string): Article[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.articles.values()).filter(
      (article) =>
        article.isOfflineAvailable &&
        (article.title.toLowerCase().includes(searchTerm) ||
          article.content.toLowerCase().includes(searchTerm) ||
          article.author.toLowerCase().includes(searchTerm) ||
          article.tags.some((tag) => tag.toLowerCase().includes(searchTerm)))
    );
  }

  removeFromOffline(articleId: string): void {
    const article = this.articles.get(articleId);
    if (article) {
      article.isOfflineAvailable = false;
      this.articles.set(articleId, article);
    }
  }

  private generateSampleArticle(id: string): Article {
    const sampleTitles = [
      'The Future of Decentralized Creator Economy',
      'Understanding Bitcoin Lightning Network',
      'NOSTR Protocol: A New Era of Social Media',
      'Building Sustainable Creator Communities',
      'The Economics of Content Monetization',
    ];

    const sampleAuthors = [
      'Alice Johnson',
      'Bob Smith',
      'Carol Williams',
      'David Brown',
      'Eva Davis',
    ];
    const sampleContent = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.`;

    const wordCount = sampleContent.split(' ').length;

    return {
      id,
      title: sampleTitles[Math.floor(Math.random() * sampleTitles.length)],
      author: sampleAuthors[Math.floor(Math.random() * sampleAuthors.length)],
      content: sampleContent,
      excerpt: sampleContent.substring(0, 150) + '...',
      publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      estimatedReadTime: Math.ceil(wordCount / 250),
      wordCount,
      tags: ['blockchain', 'creator-economy', 'technology'].slice(
        0,
        Math.floor(Math.random() * 3) + 1
      ),
      category: 'Technology',
      isOfflineAvailable: false,
    };
  }
}

// 6.11.4. Add bookmark management
class BookmarkManager {
  private static instance: BookmarkManager;
  private bookmarks: Map<string, Bookmark> = new Map();

  static getInstance(): BookmarkManager {
    if (!BookmarkManager.instance) {
      BookmarkManager.instance = new BookmarkManager();
    }
    return BookmarkManager.instance;
  }

  addBookmark(articleId: string, position: number, note?: string, tags: string[] = []): string {
    const bookmarkId = `bookmark_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const bookmark: Bookmark = {
      id: bookmarkId,
      articleId,
      position,
      note,
      createdAt: new Date(),
      tags,
    };

    this.bookmarks.set(bookmarkId, bookmark);
    return bookmarkId;
  }

  removeBookmark(bookmarkId: string): boolean {
    return this.bookmarks.delete(bookmarkId);
  }

  getBookmarks(articleId?: string): Bookmark[] {
    const bookmarks = Array.from(this.bookmarks.values());
    if (articleId) {
      return bookmarks.filter((b) => b.articleId === articleId);
    }
    return bookmarks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateBookmark(bookmarkId: string, updates: Partial<Bookmark>): boolean {
    const bookmark = this.bookmarks.get(bookmarkId);
    if (!bookmark) return false;

    const updatedBookmark = { ...bookmark, ...updates };
    this.bookmarks.set(bookmarkId, updatedBookmark);
    return true;
  }

  searchBookmarks(query: string): Bookmark[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.bookmarks.values()).filter(
      (bookmark) =>
        bookmark.note?.toLowerCase().includes(searchTerm) ||
        bookmark.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
    );
  }
}

// Reading preferences manager
class ReadingPreferencesManager {
  private static instance: ReadingPreferencesManager;
  private preferences: ReadingPreferences = {
    fontSize: 16,
    fontFamily: 'serif',
    lineHeight: 1.6,
    theme: 'light',
    textAlign: 'left',
    columnWidth: 600,
    nightMode: false,
    autoNightMode: true,
    highlightColor: '#ffeb3b',
  };

  static getInstance(): ReadingPreferencesManager {
    if (!ReadingPreferencesManager.instance) {
      ReadingPreferencesManager.instance = new ReadingPreferencesManager();
    }
    return ReadingPreferencesManager.instance;
  }

  getPreferences(): ReadingPreferences {
    return { ...this.preferences };
  }

  updatePreferences(updates: Partial<ReadingPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.applyPreferences();
  }

  private applyPreferences(): void {
    // Apply preferences to document root
    const root = document.documentElement;
    root.style.setProperty('--reading-font-size', `${this.preferences.fontSize}px`);
    root.style.setProperty('--reading-line-height', this.preferences.lineHeight.toString());
    root.style.setProperty('--reading-column-width', `${this.preferences.columnWidth}px`);
    root.style.setProperty('--reading-highlight-color', this.preferences.highlightColor);
  }

  resetToDefaults(): void {
    this.preferences = {
      fontSize: 16,
      fontFamily: 'serif',
      lineHeight: 1.6,
      theme: 'light',
      textAlign: 'left',
      columnWidth: 600,
      nightMode: false,
      autoNightMode: true,
      highlightColor: '#ffeb3b',
    };
    this.applyPreferences();
  }
}

// Main Component
export const OfflineReading: React.FC<OfflineReadingProps> = ({
  enableProgressTracking = true,
  enableBookmarks = true,
  enableSearchInContent = true,
  enableReadingAnalytics = true,
  autoSaveProgress = true,
  className = '',
}) => {
  // Feature flags
  const { flags } = useFeatureFlags();
  const isEnabled = flags.enableOfflineCapabilities && flags.enableOfflineReading;

  // State management
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [offlineArticles, setOfflineArticles] = useState<Article[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress[]>([]);
  const [preferences, setPreferences] = useState<ReadingPreferences | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Article[]>([]);
  const [readingStats, setReadingStats] = useState<any>(null);
  const [isReading, setIsReading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);

  // Managers
  const contentManager = useMemo(() => OfflineContentManager.getInstance(), []);
  const progressManager = useMemo(() => ReadingProgressManager.getInstance(), []);
  const bookmarkManager = useMemo(() => BookmarkManager.getInstance(), []);
  const preferencesManager = useMemo(() => ReadingPreferencesManager.getInstance(), []);

  // Initialize component
  useEffect(() => {
    if (!isEnabled) return;

    // Load initial data
    const loadData = async () => {
      // Add some sample articles
      await contentManager.downloadForOffline('article-1');
      await contentManager.downloadForOffline('article-2');
      await contentManager.downloadForOffline('article-3');

      setOfflineArticles(contentManager.getOfflineArticles());
      setBookmarks(bookmarkManager.getBookmarks());
      setReadingProgress(progressManager.getAllProgress());
      setPreferences(preferencesManager.getPreferences());
      setReadingStats(progressManager.getReadingStats());
    };

    loadData();
  }, [isEnabled, contentManager, progressManager, bookmarkManager, preferencesManager]);

  // Reading session management
  const startReading = useCallback(
    (article: Article) => {
      setCurrentArticle(article);
      setIsReading(true);

      if (enableProgressTracking) {
        progressManager.startReadingSession(article.id);
      }
    },
    [enableProgressTracking, progressManager]
  );

  const stopReading = useCallback(() => {
    if (enableProgressTracking && currentArticle) {
      const session = progressManager.endReadingSession();
      if (session) {
        setReadingStats(progressManager.getReadingStats());
      }
    }

    setIsReading(false);
    setCurrentArticle(null);
  }, [enableProgressTracking, currentArticle, progressManager]);

  // Progress tracking
  useEffect(() => {
    if (!isReading || !currentArticle || !enableProgressTracking) return;

    const updateProgress = () => {
      if (currentArticle) {
        const progress = currentPosition / currentArticle.wordCount;
        const wordsRead = Math.floor(currentPosition);

        progressManager.updateProgress(currentArticle.id, progress, currentPosition, wordsRead);

        if (autoSaveProgress) {
          setReadingProgress(progressManager.getAllProgress());
        }
      }
    };

    const interval = setInterval(updateProgress, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [
    isReading,
    currentArticle,
    currentPosition,
    enableProgressTracking,
    autoSaveProgress,
    progressManager,
  ]);

  // Search functionality
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results = contentManager.searchArticles(searchQuery);
    setSearchResults(results);
  }, [searchQuery, contentManager]);

  // Event handlers
  const handleDownloadArticle = useCallback(
    async (articleId: string) => {
      try {
        await contentManager.downloadForOffline(articleId);
        setOfflineArticles(contentManager.getOfflineArticles());
      } catch (error) {
        console.error('Failed to download article:', error);
      }
    },
    [contentManager]
  );

  const handleRemoveFromOffline = useCallback(
    (articleId: string) => {
      contentManager.removeFromOffline(articleId);
      setOfflineArticles(contentManager.getOfflineArticles());
    },
    [contentManager]
  );

  const handleAddBookmark = useCallback(
    (position: number, note?: string) => {
      if (!currentArticle) return;

      const bookmarkId = bookmarkManager.addBookmark(currentArticle.id, position, note);
      setBookmarks(bookmarkManager.getBookmarks());
      return bookmarkId;
    },
    [currentArticle, bookmarkManager]
  );

  const handleUpdatePreferences = useCallback(
    (updates: Partial<ReadingPreferences>) => {
      preferencesManager.updatePreferences(updates);
      setPreferences(preferencesManager.getPreferences());
    },
    [preferencesManager]
  );

  if (!isEnabled) {
    return null;
  }

  if (isReading && currentArticle) {
    return (
      <div className={`offline-reading-viewer ${className}`}>
        {/* Reading Interface */}
        <div className="reading-header border-b p-4 flex items-center justify-between">
          <Button variant="outline" onClick={stopReading}>
            ← Back to Library
          </Button>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              {Math.round((currentPosition / currentArticle.wordCount) * 100)}% Complete
            </Badge>
            <Progress value={(currentPosition / currentArticle.wordCount) * 100} className="w-32" />
          </div>
        </div>

        <div className="reading-content max-w-4xl mx-auto p-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{currentArticle.title}</h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>By {currentArticle.author}</span>
              <span>•</span>
              <span>{currentArticle.estimatedReadTime} min read</span>
              <span>•</span>
              <span>{currentArticle.publishedAt.toLocaleDateString()}</span>
            </div>
          </header>

          <article
            className="prose prose-lg max-w-none"
            style={{
              fontSize: preferences?.fontSize || 16,
              lineHeight: preferences?.lineHeight || 1.6,
              fontFamily:
                preferences?.fontFamily === 'serif'
                  ? 'serif'
                  : preferences?.fontFamily === 'sans-serif'
                    ? 'sans-serif'
                    : 'monospace',
              textAlign: preferences?.textAlign || 'left',
              maxWidth: preferences?.columnWidth || 600,
            }}
          >
            {currentArticle.content.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4">
                {paragraph}
              </p>
            ))}
          </article>

          {enableBookmarks && (
            <div className="mt-8 p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Quick Bookmark</h3>
              <Button onClick={() => handleAddBookmark(currentPosition)}>
                Bookmark Current Position
              </Button>
            </div>
          )}
        </div>

        {/* Reading Controls */}
        <div className="reading-controls fixed bottom-4 right-4 space-y-2">
          <Card className="p-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Font Size</label>
                <Slider
                  value={[preferences?.fontSize || 16]}
                  onValueChange={(value) => handleUpdatePreferences({ fontSize: value[0] })}
                  min={12}
                  max={24}
                  step={1}
                  className="w-32"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Line Height</label>
                <Slider
                  value={[preferences?.lineHeight || 1.6]}
                  onValueChange={(value) => handleUpdatePreferences({ lineHeight: value[0] })}
                  min={1.2}
                  max={2.0}
                  step={0.1}
                  className="w-32"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Night Mode</span>
                <Switch
                  checked={preferences?.nightMode || false}
                  onCheckedChange={(checked) => handleUpdatePreferences({ nightMode: checked })}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`offline-reading space-y-6 ${className}`}>
      <Tabs defaultValue="library" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* Library Tab */}
        <TabsContent value="library" className="space-y-4">
          {/* Search */}
          {enableSearchInContent && (
            <Card>
              <CardHeader>
                <CardTitle>Search Offline Content</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search articles, authors, or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 p-2 border rounded"
                  />
                  <Button onClick={handleSearch}>Search</Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="font-semibold">Search Results ({searchResults.length})</h4>
                    {searchResults.map((article) => (
                      <div key={article.id} className="p-3 border rounded-lg">
                        <h5 className="font-medium">{article.title}</h5>
                        <p className="text-sm text-muted-foreground">By {article.author}</p>
                        <Button size="sm" className="mt-2" onClick={() => startReading(article)}>
                          Read
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Offline Articles */}
          <Card>
            <CardHeader>
              <CardTitle>Offline Articles ({offlineArticles.length})</CardTitle>
              <CardDescription>Articles available for offline reading</CardDescription>
            </CardHeader>
            <CardContent>
              {offlineArticles.length > 0 ? (
                <div className="space-y-4">
                  {offlineArticles.map((article) => {
                    const progress = readingProgress.find((p) => p.articleId === article.id);
                    return (
                      <div
                        key={article.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-2">
                          <h4 className="font-semibold">{article.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            By {article.author} • {article.estimatedReadTime} min read
                          </p>
                          {progress && (
                            <div className="flex items-center gap-2">
                              <Progress value={progress.progress * 100} className="w-20 h-2" />
                              <span className="text-xs">
                                {Math.round(progress.progress * 100)}%
                              </span>
                            </div>
                          )}
                          <div className="flex gap-1">
                            {article.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => startReading(article)}>
                            {progress ? 'Continue' : 'Read'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveFromOffline(article.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No articles downloaded for offline reading.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => handleDownloadArticle(`article-${Date.now()}`)}
                  >
                    Download Sample Article
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-4">
          {enableReadingAnalytics && readingStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Total Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(readingStats.totalTimeSpent / (1000 * 60))} min
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Articles Read</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{readingStats.totalArticlesRead}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Reading Speed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(readingStats.averageReadingSpeed)} WPM
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Words Read</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {readingStats.totalWordsRead.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Reading Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {readingProgress.length > 0 ? (
                <div className="space-y-3">
                  {readingProgress.map((progress) => {
                    const article = offlineArticles.find((a) => a.id === progress.articleId);
                    return (
                      <div
                        key={progress.articleId}
                        className="flex items-center justify-between p-3 border rounded"
                      >
                        <div>
                          <p className="font-medium">
                            {article?.title || `Article ${progress.articleId}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Last read: {progress.lastReadAt.toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-1">
                            <Progress value={progress.progress * 100} className="w-20" />
                            <span className="text-sm">{Math.round(progress.progress * 100)}%</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {progress.readingSpeed} WPM
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No reading progress recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookmarks Tab */}
        <TabsContent value="bookmarks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Bookmarks ({bookmarks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {bookmarks.length > 0 ? (
                <div className="space-y-3">
                  {bookmarks.map((bookmark) => {
                    const article = offlineArticles.find((a) => a.id === bookmark.articleId);
                    return (
                      <div key={bookmark.id} className="p-3 border rounded-lg">
                        <h5 className="font-medium">{article?.title || 'Unknown Article'}</h5>
                        {bookmark.note && (
                          <p className="text-sm text-muted-foreground mt-1">{bookmark.note}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex gap-1">
                            {bookmark.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                bookmarkManager.removeBookmark(bookmark.id);
                                setBookmarks(bookmarkManager.getBookmarks());
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No bookmarks created yet. Start reading and add bookmarks to important sections.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          {preferences && (
            <Card>
              <CardHeader>
                <CardTitle>Reading Preferences</CardTitle>
                <CardDescription>Customize your reading experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Font Size: {preferences.fontSize}px</label>
                  <Slider
                    value={[preferences.fontSize]}
                    onValueChange={(value) => handleUpdatePreferences({ fontSize: value[0] })}
                    min={12}
                    max={24}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Line Height: {preferences.lineHeight}
                  </label>
                  <Slider
                    value={[preferences.lineHeight]}
                    onValueChange={(value) => handleUpdatePreferences({ lineHeight: value[0] })}
                    min={1.2}
                    max={2.0}
                    step={0.1}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Column Width: {preferences.columnWidth}px
                  </label>
                  <Slider
                    value={[preferences.columnWidth]}
                    onValueChange={(value) => handleUpdatePreferences({ columnWidth: value[0] })}
                    min={400}
                    max={800}
                    step={50}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Font Family</label>
                  <select
                    value={preferences.fontFamily}
                    onChange={(e) => handleUpdatePreferences({ fontFamily: e.target.value as any })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="serif">Serif</option>
                    <option value="sans-serif">Sans Serif</option>
                    <option value="monospace">Monospace</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Text Alignment</label>
                  <select
                    value={preferences.textAlign}
                    onChange={(e) => handleUpdatePreferences({ textAlign: e.target.value as any })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="justify">Justify</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Night Mode</p>
                      <p className="text-sm text-muted-foreground">Use dark theme for reading</p>
                    </div>
                    <Switch
                      checked={preferences.nightMode}
                      onCheckedChange={(checked) => handleUpdatePreferences({ nightMode: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto Night Mode</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically switch to night mode based on time
                      </p>
                    </div>
                    <Switch
                      checked={preferences.autoNightMode}
                      onCheckedChange={(checked) =>
                        handleUpdatePreferences({ autoNightMode: checked })
                      }
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    preferencesManager.resetToDefaults();
                    setPreferences(preferencesManager.getPreferences());
                  }}
                >
                  Reset to Defaults
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OfflineReading;

// Export types and classes
export type {
  Article,
  Bookmark,
  OfflineReadingProps,
  ReadingPreferences,
  ReadingProgress,
  ReadingSession,
};

export {
  BookmarkManager,
  OfflineContentManager,
  ReadingPreferencesManager,
  ReadingProgressManager,
};
