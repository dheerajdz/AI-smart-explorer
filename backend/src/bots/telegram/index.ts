import { Telegraf, Context } from 'telegraf';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  startCommand,
  handleSignupAction,
  handleSigninAction,
  handleResendSignupOTP,
  handleResendSigninOTP,
  handleCancel,
  handleTextMessage,
  logoutCommand,
  handleLogoutAction,
  trackCommand,
  untrackCommand,
  listCommand,
  balanceCommand,
  txCommand,
  priceCommand,
  statusCommand,
  helpCommand,
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
} from './walletConnect';
import { messageRouter } from '../../services/messageRouter';

export function createBot(): Telegraf {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  /* -------------------- Commands -------------------- */
  bot.command('start', startCommand);
  bot.command('logout', logoutCommand);
  bot.command('track', trackCommand);
  bot.command('untrack', untrackCommand);
  bot.command('list', listCommand);
  bot.command('balance', balanceCommand);
  bot.command('tx', txCommand);
  bot.command('price', priceCommand);
  bot.command('status', statusCommand);
  bot.command('help', helpCommand);

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
  bot.action('menu_ask_ai', handleMenuAskAI);
  bot.action('menu_settings', handleMenuSettings);
  bot.action('menu_back', handleMenuBack);

  /* -------------------- Settings -------------------- */
  bot.action('settings_notifications', handleSettingsNotifications);
  bot.action('settings_disconnect', handleSettingsDisconnect);
  bot.action('disconnect_confirm', handleDisconnectConfirm);

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
  bot.on('text', handleTextMessage);

  bot.catch((err) => {
    logger.error('Telegram bot error', { error: (err as Error).message });
  });

  return bot;
}
