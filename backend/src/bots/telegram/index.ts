import { Telegraf, Context } from 'telegraf';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  startCommand,
  menuCommand,
  handleSignupAction,
  handleSigninAction,
  handleResendSignupOTP,
  handleResendSigninOTP,
  handleCancel,
  logoutCommand,
  handleLogoutAction,
} from './commands';
import {
  showMainMenu,
  handleNetworkSelection,
  handleMenuBalance,
  handleMenuTransactions,
  handleMenuTrack,
  handleMenuAskAI,
  handleMenuSettings,
  handleSettingsDisconnect,
  handleDisconnectConfirm,
  handleMenuBack,
  handleSettingsNotifications,
  handleMenuAlerts,
  handleMenuPortfolio,
  handleAlertCreate,
  handleSettingsLanguage,
  handleLanguageSelection,
} from './walletConnect';
import {
  subscriptionCommand,
  upgradeCommand,
  handleBillingCheckout,
  handleBillingPortal,
} from './billingCommands';
import { handleTelegramMessage } from './adapter';

export function createBot(): Telegraf {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  /* -------------------- Commands -------------------- */
  bot.command('start', startCommand);
  bot.command('menu', menuCommand);
  bot.command('logout', logoutCommand);
  bot.command('subscription', subscriptionCommand);
  bot.command('upgrade', upgradeCommand);

  /* -------------------- Billing Callbacks -------------------- */
  bot.action('billing_upgrade', upgradeCommand);
  bot.action('billing_checkout_pro', handleBillingCheckout);
  bot.action('billing_checkout_enterprise', handleBillingCheckout);
  bot.action('billing_portal', handleBillingPortal);

  /* -------------------- Auth Callbacks -------------------- */
  bot.action('action_signup', handleSignupAction);
  bot.action('action_signin', handleSigninAction);
  bot.action('action_resend_signup', handleResendSignupOTP);
  bot.action('action_resend_signin', handleResendSigninOTP);
  bot.action('action_cancel', handleCancel);
  bot.action('action_logout', handleLogoutAction);

  /* -------------------- Wallet Connect Flow -------------------- */
  bot.action('connect_network_mainnet', handleNetworkSelection);
  bot.action('connect_network_testnet', handleNetworkSelection);

  /* -------------------- Main Menu -------------------- */
  bot.action('menu_balance', handleMenuBalance);
  bot.action('menu_transactions', handleMenuTransactions);
  bot.action('menu_track', handleMenuTrack);
  bot.action('menu_alerts', handleMenuAlerts);
  bot.action('menu_portfolio', handleMenuPortfolio);
  bot.action('menu_ask_ai', handleMenuAskAI);
  bot.action('menu_settings', handleMenuSettings);
  bot.action('menu_back', handleMenuBack);

  /* -------------------- Settings -------------------- */
  bot.action('settings_notifications', handleSettingsNotifications);
  bot.action('settings_language', handleSettingsLanguage);
  bot.action('settings_disconnect', handleSettingsDisconnect);
  bot.action('disconnect_confirm', handleDisconnectConfirm);

  /* -------------------- Language -------------------- */
  bot.action('language_en', handleLanguageSelection);
  bot.action('language_hi', handleLanguageSelection);
  bot.action('language_mr', handleLanguageSelection);

  /* -------------------- Alert actions -------------------- */
  bot.action('alert_create', handleAlertCreate);

  /* -------------------- Dashboard callbacks (placeholders) -------------------- */
  bot.action('dashboard_wallet', async (ctx: Context) => {
    await ctx.reply('💼 Wallet view is coming soon!');
    await ctx.answerCbQuery();
  });
  bot.action('dashboard_transactions', async (ctx: Context) => {
    await ctx.reply('📊 Transactions view is coming soon!');
    await ctx.answerCbQuery();
  });
  bot.action('dashboard_analyze', async (ctx: Context) => {
    await ctx.reply('🔍 Analyze Wallet is coming soon!');
    await ctx.answerCbQuery();
  });
  bot.action('dashboard_track', async (ctx: Context) => {
    await ctx.reply('🔔 Track Wallet is coming soon!');
    await ctx.answerCbQuery();
  });
  bot.action('dashboard_profile', async (ctx: Context) => {
    await ctx.reply('👤 Profile view is coming soon!');
    await ctx.answerCbQuery();
  });

  /* -------------------- Text messages -------------------- */
  bot.on('text', handleTelegramMessage);

  bot.catch((err) => {
    logger.error('Telegram bot error', { error: (err as Error).message });
  });

  return bot;
}
