import { Router } from 'express';
import { prisma } from '../prisma';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'ok',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      services: {
        database: 'error',
      },
    });
  }
});
