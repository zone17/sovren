import { Express } from 'express';
import { authRouter } from './auth';
import { userRouter } from './user';
import { postRouter } from './post';
import { paymentRouter } from './payment';
import { featureFlagsRouter } from './featureFlags';
import { healthRouter } from './health';

export const setupRoutes = (app: Express) => {
  // Health check
  app.use('/health', healthRouter);

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/posts', postRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/feature-flags', featureFlagsRouter);
};
