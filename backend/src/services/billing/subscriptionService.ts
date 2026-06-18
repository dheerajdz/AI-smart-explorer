import { SubscriptionModel, ISubscription, SubscriptionTier, SubscriptionStatus, SubscriptionPlatform } from '../../models/Subscription';
import { UsageModel } from '../../models/Usage';
import { logger } from '../../utils/logger';

export interface TierLimits {
  maxAlerts: number;
  maxPortfolioWallets: number;
  webhooks: boolean;
  priorityNLU: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxAlerts: 3,
    maxPortfolioWallets: 1,
    webhooks: false,
    priorityNLU: false,
  },
  pro: {
    maxAlerts: Infinity,
    maxPortfolioWallets: 10,
    webhooks: true,
    priorityNLU: true,
  },
  enterprise: {
    maxAlerts: Infinity,
    maxPortfolioWallets: Infinity,
    webhooks: true,
    priorityNLU: true,
  },
};

export async function getOrCreateSubscription(
  userId: string,
  platform: SubscriptionPlatform,
  chatId: string
): Promise<ISubscription> {
  let subscription = await SubscriptionModel.findOne({ userId, platform });

  if (!subscription) {
    subscription = new SubscriptionModel({
      userId,
      platform,
      chatId,
      tier: 'free',
      status: 'active',
      cancelAtPeriodEnd: false,
    });
    await subscription.save();
    logger.info('[subscriptionService] Created free subscription', { userId, platform });
  }

  return subscription;
}

export async function getSubscription(userId: string, platform: SubscriptionPlatform): Promise<ISubscription | null> {
  return SubscriptionModel.findOne({ userId, platform });
}

export async function getTier(userId: string, platform: SubscriptionPlatform): Promise<SubscriptionTier> {
  const sub = await getSubscription(userId, platform);
  return sub?.tier || 'free';
}

export async function getTierLimits(userId: string, platform: SubscriptionPlatform): Promise<TierLimits> {
  const tier = await getTier(userId, platform);
  return TIER_LIMITS[tier];
}

export async function activatePaidSubscription(
  userId: string,
  platform: SubscriptionPlatform,
  tier: SubscriptionTier,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date
): Promise<ISubscription | null> {
  const subscription = await SubscriptionModel.findOneAndUpdate(
    { userId, platform },
    {
      tier,
      status: 'active',
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
    { new: true, upsert: true }
  );

  logger.info('[subscriptionService] Activated paid subscription', {
    userId,
    platform,
    tier,
    stripeSubscriptionId,
  });

  return subscription;
}

export async function cancelSubscription(
  userId: string,
  platform: SubscriptionPlatform
): Promise<ISubscription | null> {
  return SubscriptionModel.findOneAndUpdate(
    { userId, platform },
    { tier: 'free', status: 'active', cancelAtPeriodEnd: false, stripeSubscriptionId: undefined },
    { new: true }
  );
}

export async function canCreateAlert(userId: string, platform: SubscriptionPlatform): Promise<boolean> {
  const [limits, count] = await Promise.all([
    getTierLimits(userId, platform),
    (await import('../../models/Alert')).AlertModel.countDocuments({ userId, platform }),
  ]);
  return count < limits.maxAlerts;
}

export async function canAddPortfolioWallet(userId: string, platform: SubscriptionPlatform, currentCount: number): Promise<boolean> {
  const limits = await getTierLimits(userId, platform);
  return currentCount < limits.maxPortfolioWallets;
}

export async function canUseWebhook(userId: string, platform: SubscriptionPlatform): Promise<boolean> {
  const limits = await getTierLimits(userId, platform);
  return limits.webhooks;
}

export async function incrementUsage(
  userId: string,
  platform: SubscriptionPlatform,
  field: 'alertsCreated' | 'alertsTriggered' | 'portfolioWallets' | 'webhookCalls' | 'queries'
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  await UsageModel.findOneAndUpdate(
    { userId, platform, month },
    { $inc: { [field]: 1 } },
    { upsert: true, new: true }
  );
}

export async function getUsage(userId: string, platform: SubscriptionPlatform): Promise<any> {
  const month = new Date().toISOString().slice(0, 7);
  const usage = await UsageModel.findOne({ userId, platform, month });
  const limits = await getTierLimits(userId, platform);

  return {
    month,
    usage: usage || {
      alertsCreated: 0,
      alertsTriggered: 0,
      portfolioWallets: 0,
      webhookCalls: 0,
      queries: 0,
    },
    limits,
  };
}
