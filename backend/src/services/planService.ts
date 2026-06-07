import { logger } from '../utils/logger';
import { User } from '../models';
import { PlanTier } from '../types';

export async function findOrCreateUser(
  telegramId: number,
  profile?: { username?: string; firstName?: string; lastName?: string }
): Promise<{ userId: string; plan: PlanTier; isNew: boolean }> {
  let user = await User.findOne({ telegramId });

  if (!user) {
    user = await User.create({
      telegramId,
      username: profile?.username,
      firstName: profile?.firstName,
      lastName: profile?.lastName,
      plan: 'FREE',
      planAssignedAt: new Date(),
    });
    logger.info('New user created with FREE plan', { telegramId });
    return { userId: user._id.toString(), plan: user.plan, isNew: true };
  }

  return { userId: user._id.toString(), plan: user.plan, isNew: false };
}

export async function getUserPlan(telegramId: number): Promise<PlanTier | null> {
  const user = await User.findOne({ telegramId }).select('plan');
  return user?.plan ?? null;
}

export async function setUserPlan(
  targetTelegramId: number,
  plan: PlanTier
): Promise<boolean> {
  const result = await User.updateOne(
    { telegramId: targetTelegramId },
    { plan, planAssignedAt: new Date() }
  );
  return result.matchedCount > 0;
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
