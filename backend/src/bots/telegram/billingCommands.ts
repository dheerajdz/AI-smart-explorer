import { Context, Markup } from 'telegraf';
import { logger } from '../../utils/logger';
import { getOrCreateSubscription, getTierLimits, getUsage } from '../../services/billing/subscriptionService';
import type { SubscriptionPlatform } from '../../models/Subscription';
import { createCheckoutSession, createCustomerPortalSession } from '../../services/billing/stripeService';

function formatTierName(tier: string): string {
  switch (tier) {
    case 'free': return '🆓 Free';
    case 'pro': return '💎 Pro';
    case 'enterprise': return '🏢 Enterprise';
    default: return tier;
  }
}

export async function subscriptionCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const userId = telegramId.toString();
  const platform: SubscriptionPlatform = 'telegram';
  const chatId = ctx.chat?.id.toString() || userId;

  try {
    const subscription = await getOrCreateSubscription(userId, platform, chatId);
    const limits = await getTierLimits(userId, platform);
    const usage = await getUsage(userId, platform);

    const text =
      `💳 *Your Subscription*\n\n` +
      `Plan: ${formatTierName(subscription.tier)}\n` +
      `Status: ${subscription.status}\n` +
      `${subscription.currentPeriodEnd ? `Renews: ${subscription.currentPeriodEnd.toLocaleDateString()}\n` : ''}` +
      `\n*This Month's Usage:*\n` +
      `• Alerts: ${usage.usage.alertsCreated} / ${limits.maxAlerts === Infinity ? '∞' : limits.maxAlerts}\n` +
      `• Portfolio wallets: ${usage.usage.portfolioWallets} / ${limits.maxPortfolioWallets === Infinity ? '∞' : limits.maxPortfolioWallets}\n` +
      `• Webhooks: ${usage.usage.webhookCalls} / ${limits.webhooks ? '✅' : '❌'}\n` +
      `• Priority NLU: ${limits.priorityNLU ? '✅' : '❌'}`;

    const buttons = [
      [Markup.button.callback('⬆️ Upgrade', 'billing_upgrade')],
    ];

    if (subscription.tier !== 'free' && subscription.stripeCustomerId) {
      buttons.push([Markup.button.callback('⚙️ Manage Billing', 'billing_portal')]);
    }

    await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  } catch (err) {
    logger.error('[billingCommands] subscriptionCommand failed', { error: err, userId });
    await ctx.reply('❌ Failed to load subscription. Please try again.');
  }
}

export async function upgradeCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const userId = telegramId.toString();
  const platform: SubscriptionPlatform = 'telegram';
  const chatId = ctx.chat?.id.toString() || userId;

  try {
    await getOrCreateSubscription(userId, platform, chatId);

    const text =
      `⬆️ *Upgrade Your Plan*\n\n` +
      `🆓 *Free* — $0/mo\n` +
      `• 3 alerts\n` +
      `• 1 portfolio wallet\n` +
      `• Basic queries\n\n` +
      `💎 *Pro* — $9/mo\n` +
      `• Unlimited alerts\n` +
      `• 10 portfolio wallets\n` +
      `• Webhook notifications\n` +
      `• Priority NLU\n\n` +
      `🏢 *Enterprise* — $49/mo\n` +
      `• Unlimited everything\n` +
      `• Team seats\n` +
      `• API access\n` +
      `• Compliance exports`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💎 Upgrade to Pro', 'billing_checkout_pro')],
      [Markup.button.callback('🏢 Upgrade to Enterprise', 'billing_checkout_enterprise')],
      [Markup.button.callback('🔙 Back', 'menu_back')],
    ]);

    await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
  } catch (err) {
    logger.error('[billingCommands] upgradeCommand failed', { error: err, userId });
    await ctx.reply('❌ Failed to load upgrade options. Please try again.');
  }
}

export async function handleBillingCheckout(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const match = (ctx as any).match;
  let tier = '';
  if (typeof match === 'string') {
    tier = match.replace('billing_checkout_', '');
  } else if (Array.isArray(match) && match[0]) {
    tier = match[0].replace('billing_checkout_', '');
  }
  if (tier !== 'pro' && tier !== 'enterprise') {
    await ctx.answerCbQuery('Invalid plan');
    return;
  }

  const userId = telegramId.toString();
  const platform: SubscriptionPlatform = 'telegram';
  const chatId = ctx.chat?.id.toString() || userId;

  try {
    const url = await createCheckoutSession(userId, tier as any, { platform, chatId });

    if (!url) {
      await ctx.answerCbQuery('Billing is not configured');
      await ctx.reply('❌ Billing is temporarily unavailable. Please try again later.');
      return;
    }

    await ctx.answerCbQuery('Opening checkout...');
    await ctx.reply(
      `💳 Complete your upgrade to ${tier === 'pro' ? 'Pro' : 'Enterprise'}:\n${url}`,
      Markup.inlineKeyboard([Markup.button.url('Pay Securely via Stripe', url)])
    );
  } catch (err) {
    logger.error('[billingCommands] handleBillingCheckout failed', { error: err, userId, tier });
    await ctx.answerCbQuery('Error');
    await ctx.reply('❌ Failed to create checkout session. Please try again.');
  }
}

export async function handleBillingPortal(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const userId = telegramId.toString();
  const platform: SubscriptionPlatform = 'telegram';

  try {
    const { getSubscription } = await import('../../services/billing/subscriptionService');
    const subscription = await getSubscription(userId, platform);

    if (!subscription?.stripeCustomerId) {
      await ctx.answerCbQuery('No paid subscription found');
      await ctx.reply('You don\'t have an active paid subscription.');
      return;
    }

    const url = await createCustomerPortalSession(subscription.stripeCustomerId);

    if (!url) {
      await ctx.answerCbQuery('Billing portal unavailable');
      await ctx.reply('❌ Billing portal is temporarily unavailable.');
      return;
    }

    await ctx.answerCbQuery('Opening portal...');
    await ctx.reply(
      '⚙️ Manage your subscription:',
      Markup.inlineKeyboard([Markup.button.url('Open Billing Portal', url)])
    );
  } catch (err) {
    logger.error('[billingCommands] handleBillingPortal failed', { error: err, userId });
    await ctx.answerCbQuery('Error');
    await ctx.reply('❌ Failed to open billing portal. Please try again.');
  }
}
