import { constructWebhookEvent, retrieveSubscription } from './stripeService';
import {
  activatePaidSubscription,
  cancelSubscription,
  getSubscription,
} from './subscriptionService';
import { logger } from '../../utils/logger';
import Stripe from 'stripe';

async function notifyUser(userId: string, platform: string, tier: string): Promise<void> {
  if (platform === 'telegram') {
    try {
      const { getBotInstance } = await import('../../services/notification/telegramNotify');
      const bot = getBotInstance();
      if (bot) {
        await bot.telegram.sendMessage(userId,
          `🎉 *Payment Successful!*\n\n` +
          `Your subscription has been upgraded to *${tier.toUpperCase()}*.\n\n` +
          `✅ Unlimited alerts\n` +
          `✅ More tracked wallets\n` +
          `✅ Priority support\n\n` +
          `Use /subscription to see your new limits.`,
          { parse_mode: 'Markdown' }
        );
        logger.info('[billingWebhook] Notified user of upgrade', { userId, tier });
      }
    } catch (err) {
      logger.error('[billingWebhook] Failed to notify user', { userId, tier, error: err });
    }
  }
}

export async function handleStripeWebhook(payload: string | Buffer, signature: string): Promise<{ success: boolean; message: string }> {
  const event = await constructWebhookEvent(payload, signature);

  if (!event) {
    return { success: false, message: 'Invalid signature' };
  }

  logger.info('[billingWebhook] Received Stripe event', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      default:
        logger.info('[billingWebhook] Unhandled event type', { type: event.type });
    }

    return { success: true, message: 'Webhook processed' };
  } catch (err) {
    logger.error('[billingWebhook] Failed to process event', { type: event.type, error: err });
    return { success: false, message: 'Internal error' };
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') {
    logger.info('[billingWebhook] Checkout not paid yet', { sessionId: session.id });
    return;
  }

  const userId = session.metadata?.userId;
  const platform = session.metadata?.platform as any;
  const tier = session.metadata?.tier as any;

  if (!userId || !platform || !tier) {
    logger.error('[billingWebhook] Missing metadata in checkout session', { sessionId: session.id });
    return;
  }

  const subscription = session.subscription as Stripe.Subscription;
  const customer = session.customer as Stripe.Customer;

  await activatePaidSubscription(
    userId,
    platform,
    tier,
    customer.id,
    subscription.id,
    new Date(subscription.current_period_start * 1000),
    new Date(subscription.current_period_end * 1000)
  );

  // Notify user
  await notifyUser(userId, platform, tier);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const subscription = await retrieveSubscription(subscriptionId);
  if (!subscription) return;

  // Update period dates
  const existing = await getSubscriptionByStripeSubscriptionId(subscriptionId);
  if (existing) {
    existing.currentPeriodStart = new Date(subscription.current_period_start * 1000);
    existing.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    existing.status = 'active';
    await existing.save();
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const existing = await getSubscriptionByStripeSubscriptionId(subscriptionId);
  if (existing) {
    existing.status = 'past_due';
    await existing.save();
    logger.warn('[billingWebhook] Subscription past due', { subscriptionId });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const existing = await getSubscriptionByStripeSubscriptionId(subscription.id);
  if (existing) {
    await cancelSubscription(existing.userId, existing.platform);
    logger.info('[billingWebhook] Subscription canceled and downgraded to free', {
      subscriptionId: subscription.id,
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const existing = await getSubscriptionByStripeSubscriptionId(subscription.id);
  if (!existing) return;

  existing.cancelAtPeriodEnd = subscription.cancel_at_period_end;
  existing.currentPeriodStart = new Date(subscription.current_period_start * 1000);
  existing.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    existing.status = subscription.status as any;
  } else {
    existing.status = 'active';
  }

  await existing.save();
}

async function getSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string) {
  // Inline helper to avoid circular imports
  const { SubscriptionModel } = await import('../../models/Subscription');
  return SubscriptionModel.findOne({ stripeSubscriptionId });
}
