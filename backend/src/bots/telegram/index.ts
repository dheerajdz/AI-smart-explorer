import { Telegraf, Context } from 'telegraf';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { messageRouter } from '../../services/messageRouter';

async function handleCommand(ctx: Context, commandText: string): Promise<void> {
  const userId = ctx.from?.id?.toString();
  if (!userId) {
    logger.warn('Telegram message received without user ID');
    return;
  }

  const response = await messageRouter(commandText, userId);
  await ctx.reply(response.text);
}

export function createBot(): Telegraf {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  bot.command('start', async (ctx) => {
    await ctx.reply(
      '👋 Welcome to *Smart AI Explorer* — The Blockchain You Can Text!\n\n' +
        'I can help you query XDC blockchain data using natural language.\n\n' +
        '*Commands:*\n' +
        '/help - Show commands\n' +
        '/status - Bot status\n' +
        '/track \u003cwallet\u003e - Track wallet\n' +
        '/untrack \u003cwallet\u003e - Untrack wallet\n' +
        '/list - List tracked wallets',
      { parse_mode: 'Markdown' }
    );
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

  bot.on('text', async (ctx) => {
    const userId = ctx.from?.id?.toString();
    const text = ctx.message?.text ?? '';

    if (!userId) {
      logger.warn('Telegram text message received without user ID');
      return;
    }

    logger.info('Received Telegram message', { text, from: userId });

    const response = await messageRouter(text, userId);
    await ctx.reply(response.text);
  });

  bot.catch((err) => {
    logger.error('Telegram bot error', { error: (err as Error).message });
  });

  return bot;
}
