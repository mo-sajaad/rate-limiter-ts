import type { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';
import { RATE_LIMIT_TIERS, type TierConfig, DEFAULT_TIER } from '../config/tiers';
import fs from 'fs';
import path from 'path';

const luaScriptPath = path.resolve(process.cwd(), 'src/scripts/slidingWindow.lua');
const luaScript = fs.readFileSync(luaScriptPath, 'utf-8');

export interface RateLimiterOptions {
  tierResolver?: (req: Request) => Promise<TierConfig> | TierConfig;
  keyGenerator?: (req: Request) => string;
}

export function createDynamicRateLimiter(options: RateLimiterOptions = {}) {
  const {
    tierResolver = (req: Request): TierConfig => {
      const apiKey = (req.headers['x-api-key'] || req.headers['X-API-Key']) as string | undefined;
      if (!apiKey) return DEFAULT_TIER;

      if (apiKey.startsWith('pro_')) return RATE_LIMIT_TIERS.pro ?? DEFAULT_TIER;
      if (apiKey.startsWith('ent_')) return RATE_LIMIT_TIERS.enterprise ?? DEFAULT_TIER;

      return RATE_LIMIT_TIERS.free ?? DEFAULT_TIER;
    },
    keyGenerator = (req: Request): string => {
      const apiKey = (req.headers['x-api-key'] || req.headers['X-API-Key']) as string | undefined;
      if (typeof apiKey === 'string' && apiKey.length > 0) return `key:${apiKey}`;
      return `ip:${req.ip || req.socket?.remoteAddress || '127.0.0.1'}`;
    },
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!redisClient.isOpen) {
      console.warn('⚠️ Redis client is not open. Failing open.');
      return next();
    }

    try {
      const clientIdentifier = keyGenerator(req);
      const redisKey = `rate_limit:${clientIdentifier}`;
      const now = Date.now();
      const requestId = `${now}_${Math.random().toString(36).substring(2, 9)}`;

      const tier = (await tierResolver(req)) || DEFAULT_TIER;
      const { windowMs, maxRequests } = tier;

      // Execute Lua script
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
          message: `Rate limit of ${maxRequests} requests per ${windowMs / 1000}s exceeded.`,
          retryAfter: retryAfterSeconds,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('⚠️ Rate Limiter Exception (Failing Open):', error);
      next();
    }
  };
}