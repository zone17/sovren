import { authenticate } from '@/middleware/auth';
import { getUserService } from '@/services/user-service';
import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const router = Router();
const userService = getUserService();

// 🏥 Rate limiting for user endpoints
const userRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many user requests',
    code: 'RATE_LIMITED',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🏥 Stricter rate limiting for admin endpoints
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 admin requests per windowMs
  message: {
    success: false,
    error: 'Too many admin requests',
    code: 'RATE_LIMITED',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🎯 Request/Response schemas
const CreateUserProfileSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
  display_name: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  email: z.string().email().optional(),
});

const UpdateUserProfileSchema = z.object({
  display_name: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  email: z.string().email().optional(),
});

const SearchUsersSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const UpdateRoleSchema = z.object({
  role: z.enum(['supporter', 'creator', 'admin']),
});

// 👤 Create user profile
router.post('/profile', userRateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
    }

    // Validate request body
    const validatedData = CreateUserProfileSchema.parse(req.body);

    // Create user profile
    const result = await userService.createProfile({
      ...validatedData,
      nostr_pubkey: req.user.nostr_pubkey,
      email_verified: false,
      is_active: true,
      is_verified: false,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'PROFILE_CREATION_FAILED',
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${firstError?.message || 'Invalid data'}`,
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    console.error('User profile creation failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Profile creation service error',
      code: 'SERVICE_ERROR',
    });
  }
});

// 👤 Get current user profile
router.get('/profile', userRateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
    }

    // Get user profile
    const result = await userService.findByNostrPubkey(req.user.nostr_pubkey);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    console.error('User profile retrieval failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Profile retrieval service error',
      code: 'SERVICE_ERROR',
    });
  }
});

// 👤 Update user profile
router.put('/profile', userRateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
    }

    // Validate request body
    const validatedData = UpdateUserProfileSchema.parse(req.body);

    // Get current user profile first
    const currentUser = await userService.findByNostrPubkey(req.user.nostr_pubkey);
    if (!currentUser.success || !currentUser.user) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    // Update user profile using ID-based method
    const result = await userService.updateProfileById(currentUser.user.id!, validatedData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'PROFILE_UPDATE_FAILED',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${firstError?.message || 'Invalid data'}`,
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    console.error('User profile update failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Profile update service error',
      code: 'SERVICE_ERROR',
    });
  }
});

// 🔍 Search users
router.get('/search', userRateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      });
    }

    // Validate query parameters
    const validatedQuery = SearchUsersSchema.parse({
      q: req.query.q,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    });

    // Search users
    const result = await userService.searchUsers(validatedQuery);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'SEARCH_FAILED',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        users: result.users || [],
        total: result.total || 0,
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${firstError?.message || 'Invalid query'}`,
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    console.error('User search failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Search service error',
      code: 'SERVICE_ERROR',
    });
  }
});

// 📊 Get user statistics (admin only)
router.get('/stats', adminRateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    // Get user statistics
    const result = await userService.getStats();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics',
        code: 'STATS_ERROR',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.stats,
    });
  } catch (error) {
    console.error('User statistics retrieval failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Statistics service error',
      code: 'SERVICE_ERROR',
    });
  }
});

// 🔧 Update user role (admin only)
router.put('/:id/role', adminRateLimit, authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        code: 'MISSING_USER_ID',
      });
    }

    // Validate request body
    const validatedData = UpdateRoleSchema.parse(req.body);

    // Update user role
    const result = await userService.updateRoleById(userId, validatedData.role, req.user.role);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'ROLE_UPDATE_FAILED',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${firstError?.message || 'Invalid role'}`,
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    console.error('User role update failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Role update service error',
      code: 'SERVICE_ERROR',
    });
  }
});

// 🏥 User service health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test user service functionality
    const healthCheck = await userService.healthCheck();

    if (!healthCheck.healthy) {
      return res.status(503).json({
        success: false,
        error: 'User service unhealthy',
        code: 'SERVICE_UNHEALTHY',
        details: healthCheck,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'user-management',
        timestamp: Date.now(),
        ...healthCheck,
      },
    });
  } catch (error) {
    console.error('User service health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      code: 'HEALTH_CHECK_ERROR',
    });
  }
});

export default router;
