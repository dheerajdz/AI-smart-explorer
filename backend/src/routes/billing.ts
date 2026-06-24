import { Router, Request, Response } from 'express';
import { createCheckoutSession, createCustomerPortalSession } from '../services/billing/stripeService';
import {
  getSubscription,
  getTierLimits,
  getUsage,
  getOrCreateSubscription,
} from '../services/billing/subscriptionService';
import { logger } from '../utils/logger';
import { env } from '../config/env';
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

/**
 * GET /api/billing/success
 * Handle successful checkout redirect
 */
router.get('/success', async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  
  if (!sessionId) {
    res.status(400).send('Missing session_id');
    return;
  }

  try {
    const { retrieveCheckoutSession } = await import('../services/billing/stripeService');
    const session = await retrieveCheckoutSession(sessionId);
    
    if (!session) {
      res.status(404).send('Session not found');
      return;
    }

    const tier = session.metadata?.tier || 'unknown';
    
    const telegramBotUrl = process.env.TELEGRAM_BOT_URL || 'https://t.me/AISmartExplorerXDCbot';
    
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Successful</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f9ff; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #16a34a; }
            .icon { font-size: 64px; margin-bottom: 20px; }
            .tier { font-size: 24px; font-weight: bold; color: #2563eb; margin: 20px 0; }
            .message { color: #666; margin: 20px 0; }
            .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Payment Successful!</h1>
            <div class="tier">${tier === 'pro' ? '💎 Pro Plan' : tier === 'enterprise' ? '🏢 Enterprise Plan' : 'Plan'} Activated</div>
            <div class="message">Thank you for upgrading! Your subscription is now active.</div>
            <div class="message">Return to Telegram and use /subscription to see your new limits.</div>
            <a class="btn" href="${telegramBotUrl}">Open Telegram Bot</a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    logger.error('[billingRoutes] Failed to retrieve checkout session', { error: err, sessionId });
    res.status(500).send('Failed to verify payment. Please contact support.');
  }
});

/**
 * GET /api/billing/cancel
 * Handle cancelled checkout
 */
router.get('/cancel', (req: Request, res: Response) => {
  const telegramBotUrl = process.env.TELEGRAM_BOT_URL || 'https://t.me/AISmartExplorerXDCbot';
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payment Cancelled</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fef2f2; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h1 { color: #dc2626; }
          .icon { font-size: 64px; margin-bottom: 20px; }
          .message { color: #666; margin: 20px 0; }
          .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h1>Payment Cancelled</h1>
          <div class="message">You cancelled the checkout process. No charges were made.</div>
          <div class="message">You can upgrade anytime with /upgrade in the bot.</div>
          <a class="btn" href="${telegramBotUrl}">Back to Bot</a>
        </div>
      </body>
    </html>
  `);
});

export default router;
