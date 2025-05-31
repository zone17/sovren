import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { supabase } from '../../lib/database';
import { rateLimiter } from '../../lib/middleware/rateLimit';
import { nameSchema, uuidSchema, validateRequest } from '../../lib/middleware/validation';

// 🔐 AUTHENTICATION MIDDLEWARE
async function authenticateUser(req: VercelRequest): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' };
    }

    return { user };
  } catch (error) {
    return { user: null, error: 'Authentication failed' };
  }
}

// 📊 UPDATE USER VALIDATION SCHEMA
const updateUserSchema = z.object({
  name: nameSchema.optional(),
  email: z.string().email('Invalid email format').optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  // 🆔 Validate user ID parameter
  const idValidation = validateRequest({ id }, z.object({ id: uuidSchema }));
  if (!idValidation.success) {
    return res.status(400).json({
      error: 'Invalid user ID',
      message: 'User ID must be a valid UUID',
      timestamp: new Date().toISOString()
    });
  }

  const userId = idValidation.data!.id;

  try {
    // 🚦 Rate limiting
    const rateLimitResult = await rateLimiter(req, res, 'users');
    if (!rateLimitResult.success) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
        timestamp: new Date().toISOString()
      });
    }

    // 🔐 Authentication required for all operations
    const auth = await authenticateUser(req);
    if (auth.error) {
      return res.status(401).json({
        error: 'Authentication required',
        message: auth.error,
        timestamp: new Date().toISOString()
      });
    }

    const currentUser = auth.user;

    switch (req.method) {
      case 'GET':
        return await handleGetUser(req, res, userId, currentUser);
      case 'PUT':
        return await handleUpdateUser(req, res, userId, currentUser);
      case 'DELETE':
        return await handleDeleteUser(req, res, userId, currentUser);
      default:
        return res.status(405).json({
          error: 'Method not allowed',
          message: `${req.method} method is not supported`,
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('User API error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-vercel-id'] || 'unknown'
    });
  }
}

// 👤 GET USER PROFILE
async function handleGetUser(req: VercelRequest, res: VercelResponse, userId: string, currentUser: any) {
  try {
    // 🔒 Authorization: Users can view their own profile or public profiles
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist',
        timestamp: new Date().toISOString()
      });
    }

    // 🔒 Privacy: Only show email to the user themselves
    const responseData = {
      id: user.id,
      name: user.name,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      ...(user.id === currentUser.id && { email: user.email }),
    };

    return res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: { user: responseData },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get user error:', error);
    throw error;
  }
}

// ✏️ UPDATE USER PROFILE
async function handleUpdateUser(req: VercelRequest, res: VercelResponse, userId: string, currentUser: any) {
  // 🔒 Authorization: Users can only update their own profile
  if (userId !== currentUser.id) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You can only update your own profile',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // 📊 Validate update data
    const validation = validateRequest(req.body, updateUserSchema, {
      maxFieldLength: 1000,
      allowedFields: ['name', 'email'],
      sanitize: true,
    });

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid update data',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    const updateData = validation.data!;

    // 📧 Email update requires special handling
    if (updateData.email && updateData.email !== currentUser.email) {
      // Check if email is already taken
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', updateData.email)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(409).json({
          error: 'Email already taken',
          message: 'This email is already associated with another account',
          timestamp: new Date().toISOString()
        });
      }

      // Update email in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        email: updateData.email
      });

      if (authError) {
        return res.status(400).json({
          error: 'Email update failed',
          message: authError.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // 🔄 Update user profile
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, email, name, created_at, updated_at')
      .single();

    if (error) {
      console.error('User update error:', error);
      return res.status(500).json({
        error: 'Update failed',
        message: 'Failed to update user profile',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User profile updated successfully',
      data: { user: updatedUser },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update user error:', error);
    throw error;
  }
}

// 🗑️ DELETE USER ACCOUNT
async function handleDeleteUser(req: VercelRequest, res: VercelResponse, userId: string, currentUser: any) {
  // 🔒 Authorization: Users can only delete their own account
  if (userId !== currentUser.id) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You can only delete your own account',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // 🗑️ Soft delete user profile (mark as deleted)
    const { error: profileError } = await supabase
      .from('users')
      .update({
        email: `deleted_${userId}@deleted.local`,
        name: 'Deleted User',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile deletion error:', profileError);
    }

    // 🗑️ Delete from Supabase Auth (hard delete)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Auth deletion error:', authError);
      return res.status(500).json({
        error: 'Account deletion failed',
        message: 'Failed to delete user account',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User account deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete user error:', error);
    throw error;
  }
}
