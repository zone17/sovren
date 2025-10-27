/**
 * 🚀 **CONTENT MANAGEMENT API ROUTES**
 *
 * Elite Engineering Standards:
 * - RESTful API design
 * - Comprehensive validation
 * - Rate limiting
 * - Authentication & authorization
 * - Error handling
 * - Performance optimization
 * - Security by design
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { validateNOSTRSignature } from '../middleware/nostr-auth';
import { createContentManagementService } from '../services/content-management-service';

const router = express.Router();
const contentService = createContentManagementService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'video/ogg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
      'application/pdf',
      'text/plain',
      'text/markdown',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// Rate limiting
const contentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many content requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit uploads
  message: 'Too many upload requests from this IP',
});

// Apply rate limiting
router.use(contentRateLimit);

// Validation middleware
const handleValidationErrors = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// ==================== CONTENT ITEMS ====================

/**
 * GET /api/content-management/content
 * Get content items with filtering and pagination
 */
router.get(
  '/content',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('content_type').optional().isIn(['article', 'video', 'audio', 'course', 'ebook']),
    query('status').optional().isIn(['draft', 'published', 'archived']),
    query('author_id').optional().isUUID(),
    query('tags').optional().isArray(),
    query('search').optional().isString().trim(),
    query('sort_by').optional().isIn(['created_at', 'updated_at', 'title', 'view_count']),
    query('sort_order').optional().isIn(['asc', 'desc']),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await contentService.getContentItems(req.query);

      res.json({
        success: true,
        data: result,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      console.error('Get content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch content',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/content-management/content/:id
 * Get specific content item
 */
router.get('/content/:id', [param('id').isUUID()], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    // Track view if user_id provided
    if (user_id) {
      await contentService.trackContentView(id, user_id as string);
    }

    const content = await contentService.getContentItems({
      search: id,
      limit: 1,
    });

    if (content.items.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    res.json({
      success: true,
      data: content.items[0],
    });
  } catch (error) {
    console.error('Get content by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch content',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/content-management/content
 * Create new content item
 */
router.post(
  '/content',
  [
    requireAuth,
    validateNOSTRSignature,
    body('title').isString().trim().isLength({ min: 1, max: 255 }),
    body('content_type').isIn(['article', 'video', 'audio', 'course', 'ebook']),
    body('content_blocks').isArray({ min: 1 }),
    body('excerpt').optional().isString().trim().isLength({ max: 500 }),
    body('tags').optional().isArray(),
    body('is_premium').optional().isBoolean(),
    body('price').optional().isFloat({ min: 0 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { user } = req as any;
      const contentData = {
        ...req.body,
        author_id: user.id,
      };

      const content = await contentService.createContentItem(contentData);

      res.status(201).json({
        success: true,
        data: content,
        message: 'Content created successfully',
      });
    } catch (error) {
      console.error('Create content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create content',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * PUT /api/content-management/content/:id
 * Update content item
 */
router.put(
  '/content/:id',
  [
    requireAuth,
    validateNOSTRSignature,
    param('id').isUUID(),
    body('title').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('content_blocks').optional().isArray(),
    body('excerpt').optional().isString().trim().isLength({ max: 500 }),
    body('tags').optional().isArray(),
    body('is_premium').optional().isBoolean(),
    body('price').optional().isFloat({ min: 0 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const content = await contentService.updateContentItem(id, updates);

      res.json({
        success: true,
        data: content,
        message: 'Content updated successfully',
      });
    } catch (error) {
      console.error('Update content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update content',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/content-management/content/:id/publish
 * Publish content item
 */
router.post(
  '/content/:id/publish',
  [requireAuth, validateNOSTRSignature, param('id').isUUID()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const content = await contentService.publishContentItem(id);

      res.json({
        success: true,
        data: content,
        message: 'Content published successfully',
      });
    } catch (error) {
      console.error('Publish content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to publish content',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/content-management/content/:id/analytics
 * Get content analytics
 */
router.get(
  '/content/:id/analytics',
  [
    requireAuth,
    param('id').isUUID(),
    query('start_date').isISO8601(),
    query('end_date').isISO8601(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { start_date, end_date } = req.query;

      const analytics = await contentService.getContentAnalytics(id, {
        start_date: start_date as string,
        end_date: end_date as string,
      });

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== MEDIA ASSETS ====================

/**
 * GET /api/content-management/media
 * Get media assets
 */
router.get(
  '/media',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('file_type').optional().isString(),
    query('author_id').optional().isUUID(),
    query('search').optional().isString().trim(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await contentService.getMediaAssets(req.query);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get media error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch media',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/content-management/media/upload
 * Upload media file
 */
router.post(
  '/media/upload',
  [
    uploadRateLimit,
    requireAuth,
    validateNOSTRSignature,
    upload.single('file'),
    body('alt_text').optional().isString().trim().isLength({ max: 255 }),
    body('caption').optional().isString().trim().isLength({ max: 500 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided',
        });
      }

      const { user } = req as any;
      const { alt_text, caption } = req.body;

      // Convert buffer to File-like object
      const file = new File([req.file.buffer], req.file.originalname, {
        type: req.file.mimetype,
      });

      const mediaAsset = await contentService.uploadMediaAsset(file, {
        alt_text,
        caption,
        author_id: user.id,
      });

      res.status(201).json({
        success: true,
        data: mediaAsset,
        message: 'Media uploaded successfully',
      });
    } catch (error) {
      console.error('Upload media error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload media',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== CONTENT COLLECTIONS ====================

/**
 * GET /api/content-management/collections
 * Get content collections
 */
router.get('/collections', async (req, res) => {
  try {
    // This would be implemented similar to content items
    // For now, return empty array
    res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch collections',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/content-management/collections
 * Create content collection
 */
router.post(
  '/collections',
  [
    requireAuth,
    validateNOSTRSignature,
    body('name').isString().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().trim().isLength({ max: 1000 }),
    body('type').isIn(['series', 'category', 'playlist', 'bundle', 'tag']),
    body('is_public').isBoolean(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { user } = req as any;
      const collectionData = {
        ...req.body,
        author_id: user.id,
      };

      const collection = await contentService.createContentCollection(collectionData);

      res.status(201).json({
        success: true,
        data: collection,
        message: 'Collection created successfully',
      });
    } catch (error) {
      console.error('Create collection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create collection',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/content-management/collections/:id/content
 * Add content to collection
 */
router.post(
  '/collections/:id/content',
  [requireAuth, validateNOSTRSignature, param('id').isUUID(), body('content_id').isUUID()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { content_id } = req.body;

      await contentService.addContentToCollection(id, content_id);

      res.json({
        success: true,
        message: 'Content added to collection successfully',
      });
    } catch (error) {
      console.error('Add content to collection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add content to collection',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * PUT /api/content-management/collections/:id/reorder
 * Reorder collection items
 */
router.put(
  '/collections/:id/reorder',
  [
    requireAuth,
    validateNOSTRSignature,
    param('id').isUUID(),
    body('source_index').isInt({ min: 0 }),
    body('destination_index').isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { source_index, destination_index } = req.body;

      await contentService.reorderCollectionItems(id, source_index, destination_index);

      res.json({
        success: true,
        message: 'Collection items reordered successfully',
      });
    } catch (error) {
      console.error('Reorder collection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reorder collection items',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== CONTENT SERIES ====================

/**
 * GET /api/content-management/series
 * Get content series
 */
router.get('/series', async (req, res) => {
  try {
    // This would be implemented similar to content items
    // For now, return empty array
    res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error('Get series error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch series',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/content-management/series
 * Create content series
 */
router.post(
  '/series',
  [
    requireAuth,
    validateNOSTRSignature,
    body('title').isString().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().trim().isLength({ max: 1000 }),
    body('category').isIn(['course', 'tutorial', 'workshop', 'masterclass', 'bootcamp']),
    body('difficulty_level').isIn(['beginner', 'intermediate', 'advanced', 'expert']),
    body('is_premium').isBoolean(),
    body('price').optional().isFloat({ min: 0 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { user } = req as any;
      const seriesData = {
        ...req.body,
        author_id: user.id,
      };

      const series = await contentService.createContentSeries(seriesData);

      res.status(201).json({
        success: true,
        data: series,
        message: 'Series created successfully',
      });
    } catch (error) {
      console.error('Create series error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create series',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/content-management/series/:id/episodes
 * Add episode to series
 */
router.post(
  '/series/:id/episodes',
  [
    requireAuth,
    validateNOSTRSignature,
    param('id').isUUID(),
    body('content_id').isUUID(),
    body('order_index').isInt({ min: 0 }),
    body('is_required').optional().isBoolean(),
    body('estimated_duration').optional().isInt({ min: 1 }),
    body('prerequisites').optional().isArray(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { content_id, order_index, is_required, estimated_duration, prerequisites } = req.body;

      await contentService.addEpisodeToSeries(id, content_id, order_index, {
        is_required,
        estimated_duration,
        prerequisites,
      });

      res.json({
        success: true,
        message: 'Episode added to series successfully',
      });
    } catch (error) {
      console.error('Add episode to series error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add episode to series',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== PREMIUM CONTENT ====================

/**
 * POST /api/content-management/premium/purchase
 * Purchase premium content access
 */
router.post(
  '/premium/purchase',
  [
    requireAuth,
    validateNOSTRSignature,
    body('content_id').isUUID(),
    body('price_paid').isFloat({ min: 0 }),
    body('access_type').isIn(['purchase', 'subscription', 'gift']),
    body('expires_at').optional().isISO8601(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { user } = req as any;
      const purchaseData = {
        ...req.body,
        user_id: user.id,
      };

      const premiumAccess = await contentService.createPremiumContentAccess(purchaseData);

      res.status(201).json({
        success: true,
        data: premiumAccess,
        message: 'Premium content access granted',
      });
    } catch (error) {
      console.error('Purchase premium content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to purchase premium content',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/content-management/premium/:content_id/access
 * Check premium content access
 */
router.get(
  '/premium/:content_id/access',
  [requireAuth, param('content_id').isUUID()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { content_id } = req.params;
      const { user } = req as any;

      const hasAccess = await contentService.checkPremiumAccess(content_id, user.id);

      res.json({
        success: true,
        data: { has_access: hasAccess },
      });
    } catch (error) {
      console.error('Check premium access error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check premium access',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== SEARCH ====================

/**
 * GET /api/content-management/search
 * Search content
 */
router.get(
  '/search',
  [
    query('q').isString().trim().isLength({ min: 1 }),
    query('content_type').optional().isIn(['article', 'video', 'audio', 'course', 'ebook']),
    query('tags').optional().isArray(),
    query('author_id').optional().isUUID(),
    query('is_premium').optional().isBoolean(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { q: query, ...filters } = req.query;

      const results = await contentService.searchContent(query as string, filters);

      res.json({
        success: true,
        data: results,
        query: query as string,
      });
    } catch (error) {
      console.error('Search content error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== CONTENT VERSIONING ====================

/**
 * POST /api/content-management/content/:id/versions
 * Create content version
 */
router.post(
  '/content/:id/versions',
  [
    requireAuth,
    validateNOSTRSignature,
    param('id').isUUID(),
    body('title').isString().trim().isLength({ min: 1, max: 255 }),
    body('content_blocks').isArray({ min: 1 }),
    body('change_summary').isString().trim().isLength({ min: 1, max: 500 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { user } = req as any;
      const versionData = {
        ...req.body,
        author_id: user.id,
      };

      await contentService.createContentVersion(id, versionData);

      res.status(201).json({
        success: true,
        message: 'Content version created successfully',
      });
    } catch (error) {
      console.error('Create content version error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create content version',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== ERROR HANDLING ====================

// Handle multer errors
router.use(
  (error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'File too large',
          message: 'File size exceeds 50MB limit',
        });
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: 'Too many files',
          message: 'Only one file allowed per upload',
        });
      }
    }

    if (error.message.includes('File type') && error.message.includes('not allowed')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        message: error.message,
      });
    }

    next(error);
  }
);

export default router;
