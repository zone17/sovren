import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development
export const prisma = global.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
} 