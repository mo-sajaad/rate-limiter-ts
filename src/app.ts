import express from 'express';
import { connectRedis, redisClient } from './config/redis';
import { createDynamicRateLimiter } from './middleware/rateLimiter';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

async function startServer() {
  try {
    // Connect Redis explicitly before mounting routes
    console.log('🔄 Connecting to Redis Cloud...');
    await connectRedis();

    // Verify ping
    const pingRes = await redisClient.ping();
    console.log(`⚡ Redis Ping Result: ${pingRes}`);

    // Attach rate limiter
    app.use('/api', createDynamicRateLimiter());

    // Define endpoint
    app.get('/api/resource', (_req, res) => {
      res.status(200).json({
        message: 'Access granted to protected endpoint!',
        timestamp: new Date().toISOString(),
      });
    });

    // Fallback route for uncaught requests
    app.use((_req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server listening at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('💥 Server startup failed:', error);
    process.exit(1);
  }
}

startServer();