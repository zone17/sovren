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
let _userController: any = null;
function getController() {
  if (!_userController) {
    _userController = container.get(TYPES.UserController);
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

export default router;
