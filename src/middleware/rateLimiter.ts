import type { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';
import fs from 'fs';
import path from 'path';

const luaScriptPath = path.resolve(process.cwd(), 'src/scripts/slidingWindow.lua');
const luaScript = fs.readFileSync(luaScriptPath, 'utf-8');

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => {
      const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
      if (typeof apiKey === 'string' && apiKey.length > 0) return apiKey;
      return req.ip || req.socket?.remoteAddress || '127.0.0.1';
    },
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const clientIdentifier = keyGenerator(req);
    const redisKey = `rate_limit:${clientIdentifier}`;
    const now = Date.now();
    const requestId = `${now}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const evalResult = (await redisClient.eval(luaScript, {
        keys: [redisKey],
        arguments: [
          now.toString(),
          windowMs.toString(),
          maxRequests.toString(),
          requestId,
        ],
      })) as [number, number];

      const [allowed, currentCount] = evalResult;
      const remaining = Math.max(0, maxRequests - currentCount);
      const resetTimeSeconds = Math.ceil((now + windowMs) / 1000);
      const retryAfterSeconds = Math.ceil(windowMs / 1000);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

      if (allowed === 0) {
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
          retryAfter: retryAfterSeconds,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('⚠️ Rate Limiter Error (Failing Open):', error);
      next();
    }
  };
}