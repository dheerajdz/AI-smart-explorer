import { Router, Request, Response } from 'express';
import { createCheckoutSession, createCustomerPortalSession } from '../services/billing/stripeService';
import {
  getSubscription,
  getTierLimits,
  getUsage,
  getOrCreateSubscription,
} from '../services/billing/subscriptionService';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

const checkoutSchema = z.object({
  userId: z.string().min(1),
  platform: z.enum(['telegram', 'whatsapp', 'slack', 'x']),
  chatId: z.string().min(1),
  tier: z.enum(['pro', 'enterprise']),
});

const portalSchema = z.object({
  userId: z.string().min(1),
  platform: z.enum(['telegram', 'whatsapp', 'slack', 'x']),
});

/**
 * GET /api/billing/subscription
 * Get current subscription and usage for a user
 */
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const platform = req.query.platform as string;

    if (!userId || !platform) {
      res.status(400).json({ error: 'userId and platform are required' });
      return;
    }

    const [subscription, limits, usage] = await Promise.all([
      getSubscription(userId, platform as any),
      getTierLimits(userId, platform as any),
      getUsage(userId, platform as any),
    ]);

    res.json({
      success: true,
      subscription,
      limits,
      usage,
    });
  } catch (err) {
    logger.error('[billingRoutes] Failed to get subscription', { error: err });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/checkout
 * Create a Stripe checkout session URL
 */
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      return;
    }

    const { userId, platform, chatId, tier } = parsed.data;

    // Ensure subscription record exists
    await getOrCreateSubscription(userId, platform, chatId);

    const url = await createCheckoutSession(userId, tier, { platform, chatId });

    if (!url) {
      res.status(500).json({ success: false, error: 'Failed to create checkout session' });
      return;
    }

    res.json({ success: true, url });
  } catch (err) {
    logger.error('[billingRoutes] Failed to create checkout', { error: err });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/portal
 * Create a Stripe customer portal session URL
 */
router.post('/portal', async (req: Request, res: Response) => {
  try {
    const parsed = portalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      return;
    }

    const { userId, platform } = parsed.data;
    const subscription = await getSubscription(userId, platform);

    if (!subscription?.stripeCustomerId) {
      res.status(400).json({ success: false, error: 'No active paid subscription' });
      return;
    }

    const url = await createCustomerPortalSession(subscription.stripeCustomerId);

    if (!url) {
      res.status(500).json({ success: false, error: 'Failed to create portal session' });
      return;
    }

    res.json({ success: true, url });
  } catch (err) {
    logger.error('[billingRoutes] Failed to create portal', { error: err });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
