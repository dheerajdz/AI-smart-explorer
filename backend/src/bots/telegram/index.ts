import { Telegraf, Context } from 'telegraf';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import * as planService from '../../services/planService';
import {
  startCommand,
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
} from './walletConnect';
import { handleTelegramMessage } from './adapter';
import { commandHandler } from '../../services/commandHandler';

import { portfolioCommand } from './commands/portfolioCommand';

export function createBot(): Telegraf {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  /* -------------------- Commands -------------------- */
  bot.command('start', async (ctx) => {
    // Ensure user has a plan row
    const telegramId = ctx.from?.id;
    if (telegramId) {
      await planService.findOrCreateUser(telegramId, {
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
      });
    }
    // Delegate to existing start flow
    await startCommand(ctx);
  });

  bot.command('portfolio', portfolioCommand);
  bot.command('logout', logoutCommand);

  /* -------------------- Plan Commands -------------------- */
  bot.command('plans', async (ctx) => {
    const telegramId = ctx.from?.id;
    const userId = telegramId?.toString() ?? '';
    const response = await commandHandler('/plans', [], userId, telegramId);
    await ctx.reply(response.text, { parse_mode: 'Markdown' });
  });

  bot.command('myplan', async (ctx) => {
    const telegramId = ctx.from?.id;
    const userId = telegramId?.toString() ?? '';
    const response = await commandHandler('/myplan', [], userId, telegramId);
    await ctx.reply(response.text, { parse_mode: 'Markdown' });
  });

  bot.command('admin', async (ctx) => {
    const telegramId = ctx.from?.id;
    const userId = telegramId?.toString() ?? '';
    const args = ctx.message?.text?.split(/\s+/)?.slice(1) ?? [];
    const response = await commandHandler('/admin', args, userId, telegramId);
    await ctx.reply(response.text, { parse_mode: 'Markdown' });
  });

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
  bot.on('text', handleTelegramMessage);

  bot.catch((err) => {
    logger.error('Telegram bot error', { error: (err as Error).message });
  });

  return bot;
}
