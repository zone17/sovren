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

// Profile endpoints
router.get(
  '/profile/:id',
  optionalAuth,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getProfile(req, res, next)
);

router.put(
  '/profile/:id',
  authenticate,
  rateLimiters.user.updateProfile,
  validate({ params: UserValidators.userIdParam, body: UserValidators.updateUserProfile }),
  (req: Request, res: Response, next: NextFunction) => getController().updateProfile(req, res, next)
);

// Preferences endpoints
router.get(
  '/preferences/:id',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getPreferences(req, res, next)
);

router.put(
  '/preferences/:id',
  authenticate,
  rateLimiters.user.updatePreferences,
  validate({ params: UserValidators.userIdParam, body: UserValidators.updateUserPreferences }),
  (req: Request, res: Response, next: NextFunction) => getController().updatePreferences(req, res, next)
);

// Activity endpoint
router.get(
  '/activity/:id',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getActivity(req, res, next)
);

// Relationship endpoints
router.post(
  '/relationships/follow',
  authenticate,
  rateLimiters.user.follow,
  validate({ body: UserValidators.followUser }),
  (req: Request, res: Response, next: NextFunction) => getController().followUser(req, res, next)
);

router.delete(
  '/relationships/unfollow',
  authenticate,
  rateLimiters.user.follow,
  validate({ body: UserValidators.unfollowUser }),
  (req: Request, res: Response, next: NextFunction) => getController().unfollowUser(req, res, next)
);

// Analytics endpoint
router.get(
  '/analytics/:id',
  authenticate,
  rateLimiters.user.analytics,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getUserAnalytics(req, res, next)
);

// === User Relationship Endpoints (Todo 119) ===

// Block/Unblock
router.post(
  '/:id/block',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().blockUser(req, res, next)
);

router.delete(
  '/:id/block',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().unblockUser(req, res, next)
);

// Mute/Unmute
router.post(
  '/:id/mute',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().muteUser(req, res, next)
);

router.delete(
  '/:id/mute',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().unmuteUser(req, res, next)
);

// Followers/Following
router.get(
  '/:id/followers',
  optionalAuth,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getFollowers(req, res, next)
);

router.get(
  '/:id/following',
  optionalAuth,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getFollowing(req, res, next)
);

// Blocked users (owner-only)
router.get(
  '/:id/blocked',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getBlockedUsers(req, res, next)
);

// Relationship stats
router.get(
  '/:id/relationships/stats',
  optionalAuth,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getRelationshipStats(req, res, next)
);

// Friend requests
router.post(
  '/:id/friend-request',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().sendFriendRequest(req, res, next)
);

router.put(
  '/:id/friend-request',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().respondToFriendRequest(req, res, next)
);

// Recommendations
router.get(
  '/:id/recommendations',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().getRecommendations(req, res, next)
);

// Export/Import
router.get(
  '/:id/relationships/export',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().exportRelationships(req, res, next)
);

router.post(
  '/:id/follows/import',
  authenticate,
  rateLimiters.user.follow,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().importFollows(req, res, next)
);

// Privacy settings
router.put(
  '/:id/privacy-settings',
  authenticate,
  rateLimiters.user.updateProfile,
  validate({ params: UserValidators.userIdParam }),
  (req: Request, res: Response, next: NextFunction) => getController().updatePrivacySettings(req, res, next)
);

export default router;
