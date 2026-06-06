import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL);

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error('❌ Redis error:', err));

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis disconnected');
}
