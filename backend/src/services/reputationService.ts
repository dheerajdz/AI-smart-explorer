import { logger } from '../utils/logger';
import { Reputation } from '../models';
import { ReputationTier } from '../types';

const TIER_THRESHOLDS: Record<ReputationTier, number> = {
  NEWBIE: 0,
  EXPLORER: 50,
  VETERAN: 200,
  ELITE: 500,
  LEGEND: 1000,
};

export function calculateTier(score: number): ReputationTier {
  if (score >= TIER_THRESHOLDS.LEGEND) return 'LEGEND';
  if (score >= TIER_THRESHOLDS.ELITE) return 'ELITE';
  if (score >= TIER_THRESHOLDS.VETERAN) return 'VETERAN';
  if (score >= TIER_THRESHOLDS.EXPLORER) return 'EXPLORER';
  return 'NEWBIE';
}

export async function createReputation(userId: string): Promise<boolean> {
  try {
    const existing = await Reputation.findOne({ userId });
    if (existing) {
      return false;
    }

    await Reputation.create({
      userId,
      score: 0,
      tier: 'NEWBIE',
      totalQueries: 0,
      walletsTracked: 0,
      commandsUsed: 0,
    });

    logger.info('Reputation created for user', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to create reputation', { userId, error: (error as Error).message });
    return false;
  }
}

export async function getReputation(userId: string) {
  // userId may be telegramId (string) or MongoDB ObjectId string
  // Try direct lookup first, then try via User lookup
  let rep = null;
  try {
    rep = await Reputation.findOne({ userId }).lean();
  } catch {
    // userId is not a valid ObjectId, skip direct lookup
  }
  if (rep) return rep;

  // If not found, userId might be telegramId - look up user first
  const { User } = await import('../models');
  const user = await User.findOne({ telegramId: parseInt(userId, 10) }).select('_id');
  if (user) {
    rep = await Reputation.findOne({ userId: user._id.toString() }).lean();
  }
  return rep;
}

export async function addPoints(
  userId: string,
  points: number,
  field?: 'totalQueries' | 'walletsTracked' | 'commandsUsed'
): Promise<boolean> {
  try {
    // userId may be telegramId (string) - resolve to MongoDB user._id
    let reputation = null;
    try {
      reputation = await Reputation.findOne({ userId });
    } catch {
      // userId is not a valid ObjectId
    }
    
    if (!reputation) {
      // Try looking up via User model
      const { User } = await import('../models');
      const user = await User.findOne({ telegramId: parseInt(userId, 10) }).select('_id');
      if (user) {
        reputation = await Reputation.findOne({ userId: user._id.toString() });
      }
    }
    
    if (!reputation) {
      logger.warn('Reputation not found for addPoints', { userId });
      return false;
    }

    reputation.score += points;
    if (reputation.score < 0) reputation.score = 0;

    reputation.tier = calculateTier(reputation.score);

    if (field) {
      (reputation as any)[field] += 1;
    }

    await reputation.save();
    return true;
  } catch (error) {
    logger.error('Failed to add reputation points', { userId, points, error: (error as Error).message });
    return false;
  }
}

export function tierEmoji(tier: ReputationTier): string {
  switch (tier) {
    case 'NEWBIE':
      return '🌱';
    case 'EXPLORER':
      return '🔍';
    case 'VETERAN':
      return '⚔️';
    case 'ELITE':
      return '👑';
    case 'LEGEND':
      return '🏆';
    default:
      return '';
  }
}

export function tierDisplay(tier: ReputationTier): string {
  return `${tierEmoji(tier)} ${tier}`;
}
