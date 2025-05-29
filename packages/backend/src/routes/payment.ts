import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

export const paymentRouter = Router();

const createPaymentSchema = z.object({
  postId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.enum(['sats']).default('sats'),
});

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a new payment
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *               - amount
 *             properties:
 *               postId:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment created
 *       401:
 *         description: Unauthorized
 */
paymentRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const { postId, amount, currency } = createPaymentSchema.parse(req.body);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { published: true },
    });

    if (!post) {
      throw new AppError(404, 'Post not found');
    }

    if (!post.published) {
      throw new AppError(403, 'Cannot pay for unpublished post');
    }

    const payment = await prisma.payment.create({
      data: {
        amount,
        currency,
        userId: req.user!.id,
        postId,
        status: 'pending',
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        userId: true,
        post: {
          select: {
            id: true,
            title: true,
            author: {
              select: {
                id: true,
                name: true,
                nostrPubkey: true,
              },
            },
          },
        },
      },
    });

    // TODO: Generate Lightning Network invoice
    // This will be implemented when we integrate with a Lightning Network provider

    res.status(201).json({
      status: 'success',
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get a payment by ID
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to view this payment
 *       404:
 *         description: Payment not found
 */
paymentRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        post: {
          select: {
            id: true,
            title: true,
            author: {
              select: {
                id: true,
                name: true,
                nostrPubkey: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new AppError(404, 'Payment not found');
    }

    if (payment.post.author.id !== req.user!.id && payment.userId !== req.user!.id) {
      throw new AppError(403, 'Not authorized to view this payment');
    }

    res.json({
      status: 'success',
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/payments/{id}/verify:
 *   post:
 *     summary: Verify a payment
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment verified
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to verify this payment
 *       404:
 *         description: Payment not found
 */
paymentRouter.post('/:id/verify', authenticate, async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        post: {
          select: {
            authorId: true,
          },
        },
      },
    });

    if (!payment) {
      throw new AppError(404, 'Payment not found');
    }

    if (payment.post.authorId !== req.user!.id) {
      throw new AppError(403, 'Not authorized to verify this payment');
    }

    // TODO: Verify Lightning Network payment
    // This will be implemented when we integrate with a Lightning Network provider

    const updatedPayment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { status: 'completed' },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      status: 'success',
      data: { payment: updatedPayment },
    });
  } catch (error) {
    next(error);
  }
});
