import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { supabase } from '../../lib/database';
import { rateLimiter } from '../../lib/middleware/rateLimit';
import { contentSchema, validateRequest } from '../../lib/middleware/validation';

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

// 📊 CREATE POST VALIDATION SCHEMA
const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').trim(),
  content: contentSchema,
  published: z.boolean().default(false),
});

// 📋 SIMPLE QUERY PARAMETER PARSING
function parseQueryParams(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 10));
  const published = ['true', 'false', 'all'].includes(query.published) ? query.published : 'all';
  const author_id = query.author_id && typeof query.author_id === 'string' ? query.author_id : undefined;
  const search = query.search && typeof query.search === 'string' ? query.search.substring(0, 100) : undefined;

  return { page, limit, published, author_id, search };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 🚦 Rate limiting
    const rateLimitResult = await rateLimiter(req, res, 'posts');
    if (!rateLimitResult.success) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
        timestamp: new Date().toISOString()
      });
    }

    switch (req.method) {
      case 'GET':
        return await handleGetPosts(req, res);
      case 'POST':
        return await handleCreatePost(req, res);
      default:
        return res.status(405).json({
          error: 'Method not allowed',
          message: `${req.method} method is not supported`,
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('Posts API error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-vercel-id'] || 'unknown'
    });
  }
}

// 📋 GET POSTS WITH PAGINATION AND FILTERING
async function handleGetPosts(req: VercelRequest, res: VercelResponse) {
  try {
    // 📊 Parse and validate query parameters
    const { page, limit, published, author_id, search } = parseQueryParams(req.query);
    const offset = (page - 1) * limit;

    // 🔍 Build query
    let query = supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        published,
        created_at,
        updated_at,
        author_id,
        users!posts_author_id_fkey(id, name)
      `, { count: 'exact' });

    // 📊 Apply filters
    if (published !== 'all') {
      query = query.eq('published', published === 'true');
    }

    if (author_id) {
      query = query.eq('author_id', author_id);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    // 📄 Apply pagination and ordering
    const { data: posts, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Posts query error:', error);
      return res.status(500).json({
        error: 'Failed to fetch posts',
        message: 'Database query failed',
        timestamp: new Date().toISOString()
      });
    }

    // 📊 Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return res.status(200).json({
      success: true,
      message: 'Posts retrieved successfully',
      data: {
        posts: posts || [],
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: count || 0,
          itemsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
        filters: {
          published,
          author_id,
          search,
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get posts error:', error);
    throw error;
  }
}

// ✏️ CREATE NEW POST
async function handleCreatePost(req: VercelRequest, res: VercelResponse) {
  // 🔐 Authentication required for creating posts
  const auth = await authenticateUser(req);
  if (auth.error) {
    return res.status(401).json({
      error: 'Authentication required',
      message: auth.error,
      timestamp: new Date().toISOString()
    });
  }

  const currentUser = auth.user;

  try {
    // 📊 Validate post data
    const validation = validateRequest(req.body, createPostSchema, {
      maxFieldLength: 50000,
      allowedFields: ['title', 'content', 'published'],
      sanitize: true,
    });

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid post data',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    const { title, content, published } = validation.data!;

    // 📝 Create post
    const { data: newPost, error } = await supabase
      .from('posts')
      .insert({
        title,
        content,
        published,
        author_id: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        id,
        title,
        content,
        published,
        created_at,
        updated_at,
        author_id,
        users!posts_author_id_fkey(id, name)
      `)
      .single();

    if (error) {
      console.error('Post creation error:', error);
      return res.status(500).json({
        error: 'Post creation failed',
        message: 'Failed to create post',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post: newPost },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create post error:', error);
    throw error;
  }
}
