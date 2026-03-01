/**
 * User API Routes (v1)
 *
 * RESTful endpoints for user management operations
 * All routes use /api/v1/users prefix
 */

import { Request, Response, NextFunction, Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { authenticate, optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { rateLimiters } from '../../middleware/rate-limit-middleware';
import { UserValidators } from '../../validators/user';

const router = Router();

/**
 * Lazily resolve the UserController from the DI container.
 */
import type { UserController } from '../../controllers/user/UserController';

let _userController: UserController | null = null;
function getController(): UserController {
  if (!_userController) {
    _userController = container.resolve(TYPES.UserController);
  }
  return _userController;
}

/**
 * @openapi
 * /api/v1/users/profile/{id}:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile
 *       404:
 *         description: User not found
 */
router.get(
  '/profile/:id',
  optionalAuth,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getProfile(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/profile/{id}:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/profile/:id',
  authenticate,
  rateLimiters.user.updateProfile,
  validate({ params: UserValidators.userIdParam, body: UserValidators.updateUserProfile }),
  (req: Request, res: Response, next: NextFunction) => getController().updateProfile(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/preferences/{id}:
 *   get:
 *     summary: Get user preferences
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User preferences
 */
router.get(
  '/preferences/:id',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getPreferences(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/preferences/{id}:
 *   put:
 *     summary: Update user preferences
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserPreferencesRequest'
 *     responses:
 *       200:
 *         description: Preferences updated
 */
router.put(
  '/preferences/:id',
  authenticate,
  rateLimiters.user.updatePreferences,
  validate({ params: UserValidators.userIdParam, body: UserValidators.updateUserPreferences }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().updatePreferences(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/activity/{id}:
 *   get:
 *     summary: Get user activity feed
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User activity
 */
router.get(
  '/activity/:id',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getActivity(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/relationships/follow:
 *   post:
 *     summary: Follow a user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FollowUserRequest'
 *     responses:
 *       200:
 *         description: User followed
 *       400:
 *         description: Validation error
 */
router.post(
  '/relationships/follow',
  authenticate,
  rateLimiters.user.follow,
  validate({ body: UserValidators.followUser }),
  (req: Request, res: Response, next: NextFunction) => getController().followUser(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/relationships/unfollow:
 *   delete:
 *     summary: Unfollow a user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UnfollowUserRequest'
 *     responses:
 *       200:
 *         description: User unfollowed
 */
router.delete(
  '/relationships/unfollow',
  authenticate,
  rateLimiters.user.follow,
  validate({ body: UserValidators.unfollowUser }),
  (req: Request, res: Response, next: NextFunction) => getController().unfollowUser(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/analytics/{id}:
 *   get:
 *     summary: Get user analytics
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User analytics data
 */
router.get(
  '/analytics/:id',
  authenticate,
  rateLimiters.user.analytics,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getUserAnalytics(req, res, next)
);

// === User Relationship Endpoints (Todo 119) ===

/**
 * @openapi
 * /api/v1/users/{id}/block:
 *   post:
 *     summary: Block a user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User blocked
 */
router.post(
  '/:id/block',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().blockUser(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/block:
 *   delete:
 *     summary: Unblock a user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User unblocked
 */
router.delete(
  '/:id/block',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().unblockUser(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/mute:
 *   post:
 *     summary: Mute a user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User muted
 */
router.post(
  '/:id/mute',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().muteUser(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/mute:
 *   delete:
 *     summary: Unmute a user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User unmuted
 */
router.delete(
  '/:id/mute',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().unmuteUser(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/followers:
 *   get:
 *     summary: Get user followers
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of followers
 */
router.get(
  '/:id/followers',
  optionalAuth,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getFollowers(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/following:
 *   get:
 *     summary: Get users being followed
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of followed users
 */
router.get(
  '/:id/following',
  optionalAuth,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getFollowing(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/blocked:
 *   get:
 *     summary: Get blocked users (owner only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of blocked users
 */
router.get(
  '/:id/blocked',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getBlockedUsers(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/relationships/stats:
 *   get:
 *     summary: Get relationship statistics
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relationship statistics
 */
router.get(
  '/:id/relationships/stats',
  optionalAuth,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getRelationshipStats(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/friend-request:
 *   post:
 *     summary: Send a friend request
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Friend request sent
 */
router.post(
  '/:id/friend-request',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().sendFriendRequest(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/friend-request:
 *   put:
 *     summary: Respond to a friend request
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Friend request response recorded
 */
router.put(
  '/:id/friend-request',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().respondToFriendRequest(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/recommendations:
 *   get:
 *     summary: Get user recommendations
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recommended users
 */
router.get(
  '/:id/recommendations',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().getRecommendations(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/relationships/export:
 *   get:
 *     summary: Export user relationships
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relationships exported
 */
router.get(
  '/:id/relationships/export',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().exportRelationships(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/follows/import:
 *   post:
 *     summary: Import follows from external source
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Follows imported
 */
router.post(
  '/:id/follows/import',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().importFollows(req, res, next)
);

/**
 * @openapi
 * /api/v1/users/{id}/privacy-settings:
 *   put:
 *     summary: Update privacy settings
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Privacy settings updated
 */
router.put(
  '/:id/privacy-settings',
  authenticate,
  rateLimiters.user.updateProfile,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) =>
    getController().updatePrivacySettings(req, res, next)
);

export default router;
