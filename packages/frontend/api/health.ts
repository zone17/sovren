import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/database';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test database connection
    await prisma.$connect();
    
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed'
    });
  } finally {
    await prisma.$disconnect();
  }
} 