import { Telegraf, Context } from 'telegraf';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { messageRouter } from '../../services/messageRouter';
import * as planService from '../../services/planService';

async function handleCommand(ctx: Context, commandText: string): Promise<void> {
  const userId = ctx.from?.id?.toString();
  const telegramId = ctx.from?.id;

  if (!userId || !telegramId) {
    logger.warn('Telegram message received without user ID');
    return;
  }

  const response = await messageRouter(commandText, userId, telegramId);
  await ctx.reply(response.text, { parse_mode: 'Markdown' });
}

export function createBot(): Telegraf {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  bot.command('start', async (ctx) => {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;

    if (!telegramId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }

    const { plan, isNew } = await planService.findOrCreateUser(telegramId, {
      username,
      firstName,
      lastName,
    });

    const welcomeText =
      `👋 Welcome, *${firstName || 'Explorer'}*!\n\n` +
      `🤖 *Smart AI Explorer* — Your XDC Blockchain Assistant\n\n` +
      `💎 *Plan:* ${planService.planDisplay(plan)}\n\n` +
      `🚀 *Quick Start*\n` +
      `• /track \+ wallet — Monitor XDC wallets\n` +
      `• /plans — View upgrade options\n` +
      `• /help — All commands`;

    await ctx.reply(welcomeText, { parse_mode: 'Markdown' });

    const tipText =
      `💡 *Tip:* Try "Track wallet 0x123..." or just send a wallet address.`;

    await ctx.reply(tipText, { parse_mode: 'Markdown' });

    if (isNew) {
      logger.info('User registered via /start', { telegramId, plan });
    }
  });

  bot.command('help', (ctx) => handleCommand(ctx, '/help'));
  bot.command('status', (ctx) => handleCommand(ctx, '/status'));
  bot.command('track', (ctx) => {
    const messageText = ctx.message?.text ?? '/track';
    return handleCommand(ctx, messageText);
  });
  bot.command('untrack', (ctx) => {
    const messageText = ctx.message?.text ?? '/untrack';
    return handleCommand(ctx, messageText);
  });
  bot.command('list', (ctx) => handleCommand(ctx, '/list'));
  bot.command('plans', (ctx) => handleCommand(ctx, '/plans'));
  bot.command('myplan', (ctx) => handleCommand(ctx, '/myplan'));
  bot.command('rep', (ctx) => handleCommand(ctx, '/rep'));
  bot.command('reputation', (ctx) => {
    const messageText = ctx.message?.text ?? '/reputation';
    return handleCommand(ctx, messageText);
  });
  bot.command('admin', (ctx) => {
    const messageText = ctx.message?.text ?? '/admin';
    return handleCommand(ctx, messageText);
  });

  bot.on('text', async (ctx) => {
    const userId = ctx.from?.id?.toString();
    const telegramId = ctx.from?.id;
    const text = ctx.message?.text ?? '';

    if (!userId || !telegramId) {
      logger.warn('Telegram text message received without user ID');
      return;
    }

    logger.info('Received Telegram message', { text, from: userId });

    const response = await messageRouter(text, userId, telegramId);
    await ctx.reply(response.text, { parse_mode: 'Markdown' });
  });

  bot.catch((err) => {
    logger.error('Telegram bot error', { error: (err as Error).message });
  });

  return bot;
}
