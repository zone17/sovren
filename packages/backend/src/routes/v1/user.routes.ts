/**
 * User API Routes (v1)
 *
 * RESTful endpoints for user management operations
 * All routes use /api/v1/users prefix
 */

import { Router } from 'express';
import { container } from '../../container';
import { TYPES } from '../../container/types';
import { UserController } from '../../controllers/user/UserController';
import { authenticate, optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { rateLimiters } from '../../middleware/rate-limit-middleware';
import { UserValidators } from '../../validators/user';

const router = Router();
const userController = container.get<UserController>(TYPES.UserController);

// Profile endpoints
router.get(
  '/profile/:id',
  optionalAuth,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  userController.getProfile
);

router.put(
  '/profile/:id',
  authenticate,
  rateLimiters.user.updateProfile,
  validate({ params: UserValidators.userIdParam, body: UserValidators.updateUserProfile }),
  userController.updateProfile
);

// Preferences endpoints
router.get(
  '/preferences/:id',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  userController.getPreferences
);

router.put(
  '/preferences/:id',
  authenticate,
  rateLimiters.user.updatePreferences,
  validate({ params: UserValidators.userIdParam, body: UserValidators.updateUserPreferences }),
  userController.updatePreferences
);

// Activity endpoint
router.get(
  '/activity/:id',
  authenticate,
  rateLimiters.user.read,
  validate({ params: UserValidators.userIdParam }),
  userController.getActivity
);

// Relationship endpoints
router.post(
  '/relationships/follow',
  authenticate,
  rateLimiters.user.follow,
  validate({ body: UserValidators.followUser }),
  userController.followUser
);

router.delete(
  '/relationships/unfollow',
  authenticate,
  rateLimiters.user.follow,
  validate({ body: UserValidators.unfollowUser }),
  userController.unfollowUser
);

// Analytics endpoint
router.get(
  '/analytics/:id',
  authenticate,
  rateLimiters.user.analytics,
  validate({ params: UserValidators.userIdParam }),
  userController.getUserAnalytics
);

export default router;
