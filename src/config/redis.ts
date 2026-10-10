import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;


if (!redisUrl) {
    throw new Error('REDIS_URL missing from environment variables');
}

export const redisClient = createClient({
    url: redisUrl,
});


redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis client'));

export async function connectRedis() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }    
}