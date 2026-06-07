import { logger } from '../utils/logger';
import { UserModel } from '../models/User';
import { PlanTier } from '../types';

export async function findOrCreateUser(
  telegramId: number,
  profile?: { username?: string; firstName?: string; lastName?: string }
): Promise<{ userId: string; plan: PlanTier; isNew: boolean }> {
  const { user, plan, isNew } = await UserModel.findOrCreateUser(telegramId, profile);
  return { userId: user._id?.toString() ?? '', plan, isNew };
}

export async function getUserPlan(telegramId: number): Promise<PlanTier | null> {
  return UserModel.getUserPlan(telegramId);
}

export async function setUserPlan(
  targetTelegramId: number,
  plan: PlanTier
): Promise<boolean> {
  return UserModel.setUserPlan(targetTelegramId, plan);
}

export function planEmoji(plan: PlanTier): string {
  switch (plan) {
    case 'FREE':
      return '🆓';
    case 'PRO':
      return '⭐';
    case 'ENTERPRISE':
      return '🏢';
    default:
      return '';
  }
}

export function planDisplay(plan: PlanTier): string {
  return `${planEmoji(plan)} ${plan}`;
}
