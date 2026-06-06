import { redis } from '../../../database';
import { CommandResult } from '../types';

export async function getStatusText(): Promise<CommandResult> {
  let redisStatus = 'Disconnected';
  try {
    await redis.ping();
    redisStatus = 'Connected';
  } catch {
    redisStatus = 'Disconnected';
  }

  return {
    text: `Smart AI Explorer Status

WhatsApp: Online
Backend: Online
MongoDB: Connected
Redis: ${redisStatus}`,
  };
}
