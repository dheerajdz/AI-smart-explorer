import { logger } from '../../utils/logger';
import { redis } from '../../database';
import { WalletReputationData } from '../../types/walletReputation';

const REDIS_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MEMORY_TTL_MS = 60 * 60 * 1000; // 1 hour

// In-memory hot cache
const memoryCache = new Map<string, { data: WalletReputationData; cachedAt: number }>();

function getCacheKey(address: string): string {
  return `reputation:${address.toLowerCase()}`;
}

export async function getCachedReputation(address: string): Promise<WalletReputationData | null> {
  const key = getCacheKey(address);

  // Check memory first
  const memEntry = memoryCache.get(key);
  if (memEntry && Date.now() - memEntry.cachedAt < MEMORY_TTL_MS) {
    logger.info('Wallet reputation cache hit (memory)', { address });
    return memEntry.data;
  }

  // Check Redis
  try {
    const redisData = await redis.get(key);
    if (redisData) {
      const parsed: WalletReputationData = JSON.parse(redisData);
      // Populate memory cache
      memoryCache.set(key, { data: parsed, cachedAt: Date.now() });
      logger.info('Wallet reputation cache hit (redis)', { address });
      return parsed;
    }
  } catch (error) {
    logger.warn('Redis cache read failed', { address, error: (error as Error).message });
  }

  return null;
}

export async function setCachedReputation(
  address: string,
  data: WalletReputationData
): Promise<void> {
  const key = getCacheKey(address);

  // Update memory cache
  memoryCache.set(key, { data, cachedAt: Date.now() });

  // Update Redis
  try {
    await redis.setex(key, REDIS_TTL_SECONDS, JSON.stringify(data));
    logger.info('Wallet reputation cached', { address, ttl: REDIS_TTL_SECONDS });
  } catch (error) {
    logger.warn('Redis cache write failed', { address, error: (error as Error).message });
  }
}

export function clearMemoryCache(): void {
  memoryCache.clear();
  logger.info('Memory cache cleared');
}
