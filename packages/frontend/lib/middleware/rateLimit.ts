import type { VercelRequest, VercelResponse } from '@vercel/node';

// 🚦 ELITE RATE LIMITING CONFIGURATION
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: VercelRequest) => string;
}

interface RateLimitResult {
  success: boolean;
  retryAfter?: number;
  remaining?: number;
}

// 💾 In-memory storage for rate limiting (production should use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// 🧹 Cleanup expired entries
const cleanup = () => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};

// 🔧 Default configurations for different endpoints
const configs: Record<string, RateLimitConfig> = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 registrations per hour
  },
  default: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
};

// 🎯 Smart key generation based on IP and endpoint
const generateKey = (req: VercelRequest, endpoint?: string): string => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const fingerprint = Buffer.from(`${ip}:${userAgent}`).toString('base64').slice(0, 16);

  return endpoint ? `${endpoint}:${fingerprint}` : `default:${fingerprint}`;
};

// 🛡️ ELITE RATE LIMITER
export async function rateLimiter(
  req: VercelRequest,
  res: VercelResponse,
  endpoint?: string
): Promise<RateLimitResult> {
  try {
    // 🧹 Periodic cleanup
    if (Math.random() < 0.1) {
      // 10% chance to trigger cleanup
      cleanup();
    }

    const config = configs[endpoint || 'default'] || configs.default;
    const key = generateKey(req, endpoint);
    const now = Date.now();
    const resetTime = now + config.windowMs;

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // 🆕 First request or window expired
      record = { count: 1, resetTime };
      rateLimitStore.set(key, record);

      return {
        success: true,
        remaining: config.maxRequests - 1,
      };
    }

    if (record.count >= config.maxRequests) {
      // 🚫 Rate limit exceeded
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);

      return {
        success: false,
        retryAfter,
      };
    }

    // ✅ Within limits - increment counter
    record.count++;
    rateLimitStore.set(key, record);

    return {
      success: true,
      remaining: config.maxRequests - record.count,
    };
  } catch (error) {
    console.error('Rate limiter error:', error);

    // 🔄 Fail open - allow request on error
    return { success: true };
  }
}

// 📊 Get current rate limit status
export async function getRateLimitStatus(
  req: VercelRequest,
  endpoint?: string
): Promise<{ remaining: number; resetTime: number } | null> {
  const key = generateKey(req, endpoint);
  const record = rateLimitStore.get(key);

  if (!record) {
    return null;
  }

  const config = configs[endpoint || 'default'] || configs.default;
  return {
    remaining: Math.max(0, config.maxRequests - record.count),
    resetTime: record.resetTime,
  };
}

// 🧪 Testing utilities
export const __testing = {
  clearStore: () => rateLimitStore.clear(),
  getStore: () => rateLimitStore,
  configs,
};
