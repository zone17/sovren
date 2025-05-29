import { Express, Request, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AppError } from '../middleware/errorHandler';
import { FeatureFlag } from '@prisma/client';

export const setupFeatureFlags = (app: Express) => {
  if (process.env.NODE_ENV === 'test') return;
  // Middleware to check feature flags
  app.use(async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const featureFlags = await prisma.featureFlag.findMany({
        where: { enabled: true },
      });

      // Add feature flags to request object
      req.featureFlags = featureFlags.reduce((acc: Record<string, boolean>, flag: FeatureFlag) => {
        acc[flag.key] = flag.value;
        return acc;
      }, {});

      next();
    } catch (error) {
      next(error);
    }
  });
};

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (req: Request, featureKey: string): boolean => {
  return req.featureFlags?.[featureKey] ?? false;
};

// Helper function to require a feature to be enabled
export const requireFeature = (featureKey: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!isFeatureEnabled(req, featureKey)) {
      next(new AppError(403, `Feature ${featureKey} is not enabled`));
      return;
    }
    next();
  };
};

// Update the Express namespace to include featureFlags
declare global {
  namespace Express {
    interface Request {
      featureFlags?: Record<string, boolean>;
    }
  }
}
