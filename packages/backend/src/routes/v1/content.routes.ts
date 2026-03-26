/**
 * Content API Routes (v1)
 *
 * RESTful endpoints for content management operations
 * All routes use /api/v1/content prefix
 */

import { Request, Response, NextFunction, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, optionalAuth, requireCreator } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { rateLimiters } from '../../middleware/rate-limit-middleware';
import { ContentValidators } from '../../validators/content';

const router = Router();

/**
 * Lazily resolve the ContentController from the DI container.
 * The container is initialized asynchronously at server startup,
 * so we resolve on first request rather than at module import time.
 */
import type { ContentController } from '../../controllers/content/ContentController';

let _contentController: ContentController | null = null;
function getController(): ContentController {
  if (!_contentController) {
    _contentController = container.resolve(TYPES.ContentController);
  }
  return _contentController;
}

/**
 * @openapi
 * /api/v1/content:
 *   get:
 *     summary: List content (discovery feed)
 *     tags: [Content]
 */
router.get(
  '/',
  optionalAuth,
  rateLimiters.content.search,
  validate({ query: ContentValidators.listContent }),
  (req: Request, res: Response, next: NextFunction) => getController().listContent(req, res, next)
);

/**
 * @openapi
 * /api/v1/content/publish:
 *   post:
 *     summary: Publish new content
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PublishContentRequest'
 *     responses:
 *       201:
 *         description: Content published successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/publish',
  authenticate,
  requireCreator,
  rateLimiters.content.publish,
  validate({ body: ContentValidators.publishContent }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().publishContent(req, res, next)
);

/**
 * @openapi
 * /api/v1/content/moderate:
 *   post:
 *     summary: Moderate content
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/moderate',
  authenticate,
  requireCreator,
  rateLimiters.content.moderate,
  validate({ body: ContentValidators.moderateContent }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().moderateContent(req, res, next)
);

/**
 * @openapi
 * /api/v1/content/search:
 *   get:
 *     summary: Search content
 *     tags: [Content]
 */
router.get(
  '/search',
  optionalAuth,
  rateLimiters.content.search,
  validate({ query: ContentValidators.searchContent }),
  (req: Request, res: Response, next: NextFunction) => getController().searchContent(req, res, next)
);

/**
 * @openapi
 * /api/v1/content/recommendations:
 *   get:
 *     summary: Get content recommendations
 *     tags: [Content]
 */
router.get(
  '/recommendations',
  optionalAuth,
  rateLimiters.content.recommendations,
  validate({ query: ContentValidators.getRecommendations }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getRecommendations(req, res, next)
);

/**
 * @openapi
 * /api/v1/content/analytics/{id}:
 *   get:
 *     summary: Get content analytics
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/analytics/:id',
  authenticate,
  // SEC-015: Ownership verification — ensure the authenticated user owns the content
  // before exposing analytics data. Admins bypass this check.
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contentId = req.params.id;
      const requestingUser = req.user;

      if (!requestingUser) {
        return res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHENTICATED' });
      }

      // Admins may view any content analytics
      if (requestingUser.role === 'admin') {
        return next();
      }

      // Resolve content creation service to check ownership
      const creationService = container.resolve<{ getContent: (id: string) => Promise<{ authorId: string }> }>(
        TYPES.ContentCreationService
      );
      const content = await creationService.getContent(contentId);

      if (!content || content.authorId !== requestingUser.nostr_pubkey) {
        return res.status(403).json({ success: false, error: 'Access denied', code: 'FORBIDDEN' });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  },
  rateLimiters.content.analytics,
  validate({ params: ContentValidators.contentIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getContentAnalytics(req, res, next)
);

/**
 * @openapi
 * /api/v1/content/versions/{id}:
 *   get:
 *     summary: Get version history
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/versions/:id',
  authenticate,
  rateLimiters.content.read,
  validate({ params: ContentValidators.contentIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getVersionHistory(req, res, next)
);

/**
 * @openapi
 * /api/v1/content/versions/{id}/revert:
 *   post:
 *     summary: Revert to previous version
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/versions/:id/revert',
  authenticate,
  requireCreator,
  rateLimiters.content.publish,
  validate({
    params: ContentValidators.contentIdParam,
    body: ContentValidators.revertContentVersion,
  }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().revertContentVersion(req, res, next)
);

// ============================================================================
// Content CRUD (parameterized routes must come after named routes)
// ============================================================================

/**
 * @openapi
 * /api/v1/content/{id}:
 *   get:
 *     summary: Get a single content item
 *     tags: [Content]
 */
router.get(
  '/:id',
  optionalAuth,
  rateLimiters.content.read,
  validate({ params: ContentValidators.contentIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getContent(req, res, next)
);

/**
 * @openapi
 * /api/v1/content/{id}:
 *   put:
 *     summary: Update content
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/:id',
  authenticate,
  requireCreator,
  rateLimiters.content.publish,
  validate({
    params: ContentValidators.contentIdParam,
    body: ContentValidators.updateContent,
  }),
  (req: Request, res: Response, next: NextFunction) => getController().updateContent(req, res, next)
);

/**
 * @openapi
 * /api/v1/content/{id}:
 *   delete:
 *     summary: Delete content
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 */
router.delete(
  '/:id',
  authenticate,
  requireCreator,
  rateLimiters.content.publish,
  validate({ params: ContentValidators.contentIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().deleteContent(req, res, next)
);

export default router;
