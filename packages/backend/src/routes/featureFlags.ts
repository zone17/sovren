import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

export const featureFlagsRouter = Router();

const createFeatureFlagSchema = z.object({
  key: z.string(),
  value: z.boolean(),
  description: z.string(),
});

const updateFeatureFlagSchema = createFeatureFlagSchema.partial();

/**
 * @swagger
 * /api/feature-flags:
 *   get:
 *     summary: Get all feature flags
 *     tags: [FeatureFlag]
 *     responses:
 *       200:
 *         description: List of feature flags
 */
featureFlagsRouter.get('/', async (_req, res, next) => {
  try {
    const flags = await prisma.featureFlag.findMany({
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      status: 'success',
      data: { flags },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/feature-flags:
 *   post:
 *     summary: Create a new feature flag
 *     tags: [FeatureFlag]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *               - description
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: boolean
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Feature flag created
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Feature flag with this key already exists
 */
featureFlagsRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const data = createFeatureFlagSchema.parse(req.body);

    const existingFlag = await prisma.featureFlag.findUnique({
      where: { key: data.key },
    });

    if (existingFlag) {
      throw new AppError(409, 'Feature flag with this key already exists');
    }

    const flag = await prisma.featureFlag.create({
      data,
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { flag },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/feature-flags/{id}:
 *   patch:
 *     summary: Update a feature flag
 *     tags: [FeatureFlag]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Feature flag ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: boolean
 *               description:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Feature flag updated
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Feature flag not found
 */
featureFlagsRouter.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const updates = updateFeatureFlagSchema.parse(req.body);

    const flag = await prisma.featureFlag.update({
      where: { id: req.params.id },
      data: updates,
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      status: 'success',
      data: { flag },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/feature-flags/{id}:
 *   delete:
 *     summary: Delete a feature flag
 *     tags: [FeatureFlag]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Feature flag ID
 *     responses:
 *       204:
 *         description: Feature flag deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Feature flag not found
 */
featureFlagsRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.featureFlag.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
