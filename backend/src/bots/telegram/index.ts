import { Telegraf, Context } from 'telegraf';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  startCommand,
  handleSignupAction,
  handleSigninAction,
  handleTextMessage,
  trackCommand,
  untrackCommand,
  listCommand,
  balanceCommand,
  priceCommand,
  statusCommand,
} from './commands';

export function createBot(): Telegraf {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  /* -------------------- Commands -------------------- */
  bot.command('start', startCommand);
  bot.command('track', trackCommand);
  bot.command('untrack', untrackCommand);
  bot.command('list', listCommand);
  bot.command('balance', balanceCommand);
  bot.command('price', priceCommand);
  bot.command('status', statusCommand);

  /* -------------------- Callbacks -------------------- */
  bot.action('action_signup', handleSignupAction);
  bot.action('action_signin', handleSigninAction);

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

  return bot;
}
