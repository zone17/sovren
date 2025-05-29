import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

export const userRouter = Router();

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  nostrPubkey: z.string().optional(),
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 */
userRouter.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        nostrPubkey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Update current user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               nostrPubkey:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated
 *       401:
 *         description: Unauthorized
 */
userRouter.patch('/me', authenticate, async (req, res, next) => {
  try {
    const updates = updateUserSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        nostrPubkey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/me/posts:
 *   get:
 *     summary: Get posts by current user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of posts
 *       401:
 *         description: Unauthorized
 */
userRouter.get('/me/posts', authenticate, async (req, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: { authorId: req.user!.id },
      select: {
        id: true,
        title: true,
        content: true,
        published: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: { posts },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/me/payments:
 *   get:
 *     summary: Get payments by current user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payments
 *       401:
 *         description: Unauthorized
 */
userRouter.get('/me/payments', authenticate, async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      status: 'success',
      data: { payments },
    });
  } catch (error) {
    next(error);
  }
});
