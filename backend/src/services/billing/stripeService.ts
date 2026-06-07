import Stripe from 'stripe';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

if (!env.STRIPE_SECRET_KEY) {
  logger.warn('[stripeService] STRIPE_SECRET_KEY not configured');
}

const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

export type BillingTier = 'pro' | 'enterprise';

export async function createCheckoutSession(
  userId: string,
  tier: BillingTier,
  metadata: Record<string, string>
): Promise<string | null> {
  if (!stripe) {
    logger.error('[stripeService] Stripe not initialized');
    return null;
  }

  const priceId = tier === 'pro' ? env.STRIPE_PRO_PRICE_ID : env.STRIPE_ENTERPRISE_PRICE_ID;
  if (!priceId) {
    logger.error('[stripeService] No price ID for tier', { tier });
    return null;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/billing/cancel`,
      metadata: { userId, tier, ...metadata },
      allow_promotion_codes: true,
    });

    logger.info('[stripeService] Checkout session created', { sessionId: session.id, userId, tier });
    return session.url;
  } catch (err) {
    logger.error('[stripeService] Failed to create checkout session', { error: err });
    return null;
  }
}

export async function createCustomerPortalSession(
  customerId: string
): Promise<string | null> {
  if (!stripe) {
    logger.error('[stripeService] Stripe not initialized');
    return null;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.FRONTEND_URL || 'http://localhost:3000'}/billing`,
    });
    return session.url;
  } catch (err) {
    logger.error('[stripeService] Failed to create portal session', { error: err });
    return null;
  }
}

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event | null> {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    logger.error('[stripeService] Stripe webhook not configured');
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('[stripeService] Webhook signature verification failed', { error: err });
    return null;
  }
}

export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  if (!stripe) return null;
  try {
    return await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription', 'customer'] });
  } catch (err) {
    logger.error('[stripeService] Failed to retrieve session', { error: err });
    return null;
  }
}

export async function retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    logger.error('[stripeService] Failed to retrieve subscription', { error: err });
    return null;
  }
}
