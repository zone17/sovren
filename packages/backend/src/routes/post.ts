import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

export const postRouter = Router();

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  published: z.boolean().default(false),
});

const updatePostSchema = createPostSchema.partial();

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               published:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Post created
 *       401:
 *         description: Unauthorized
 */
postRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const data = createPostSchema.parse(req.body);

    const post = await prisma.post.create({
      data: {
        ...data,
        authorId: req.user!.id,
      },
      select: {
        id: true,
        title: true,
        content: true,
        published: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            nostrPubkey: true,
          },
        },
      },
    });

    res.status(201).json({
      status: 'success',
      data: { post },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get all published posts
 *     tags: [Post]
 *     responses:
 *       200:
 *         description: List of posts
 */
postRouter.get('/', async (_req, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: { published: true },
      select: {
        id: true,
        title: true,
        content: true,
        published: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            nostrPubkey: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: { posts: posts || [] },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a post by ID
 *     tags: [Post]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post found
 *       404:
 *         description: Post not found
 *       403:
 *         description: Not authorized to view this post
 */
postRouter.get('/:id', async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        title: true,
        content: true,
        published: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            nostrPubkey: true,
          },
        },
      },
    });

    if (!post) {
      throw new AppError(404, 'Post not found');
    }

    if (!post.published && post.author.id !== req.user?.id) {
      throw new AppError(403, 'Not authorized to view this post');
    }

    res.json({
      status: 'success',
      data: { post },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/posts/{id}:
 *   patch:
 *     summary: Update a post
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               published:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Post updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this post
 *       404:
 *         description: Post not found
 */
postRouter.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const updates = updatePostSchema.parse(req.body);

    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { authorId: true },
    });

    if (!post) {
      throw new AppError(404, 'Post not found');
    }

    if (post.authorId !== req.user!.id) {
      throw new AppError(403, 'Not authorized to update this post');
    }

    const updatedPost = await prisma.post.update({
      where: { id: req.params.id },
      data: updates,
      select: {
        id: true,
        title: true,
        content: true,
        published: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            nostrPubkey: true,
          },
        },
      },
    });

    res.json({
      status: 'success',
      data: { post: updatedPost },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Post ID
 *     responses:
 *       204:
 *         description: Post deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to delete this post
 *       404:
 *         description: Post not found
 */
postRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { authorId: true },
    });

    if (!post) {
      throw new AppError(404, 'Post not found');
    }

    if (post.authorId !== req.user!.id) {
      throw new AppError(403, 'Not authorized to delete this post');
    }

    await prisma.post.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
