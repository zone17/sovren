import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { prisma } from '../prisma';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        nostrPubkey: string | null;
      };
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        nostrPubkey: true,
      },
    });

    if (!user) {
      throw new AppError(401, 'User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'Invalid token'));
    } else {
      next(error);
    }
  }
};

export const verifyNostrKey = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const nostrPubkey = req.headers['x-nostr-pubkey'];
    if (!nostrPubkey || typeof nostrPubkey !== 'string') {
      throw new AppError(401, 'NOSTR public key required');
    }

    const user = await prisma.user.findUnique({
      where: { nostrPubkey },
      select: {
        id: true,
        email: true,
        nostrPubkey: true,
      },
    });

    if (!user) {
      throw new AppError(401, 'Invalid NOSTR public key');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
