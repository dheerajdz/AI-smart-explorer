import { Telegraf } from 'telegraf';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  startCommand,
  trackCommand,
  untrackCommand,
  listCommand,
  balanceCommand,
  priceCommand,
  statusCommand,
} from './commands';

export function createBot(): Telegraf {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  bot.command('start', startCommand);
  bot.command('track', trackCommand);
  bot.command('untrack', untrackCommand);
  bot.command('list', listCommand);
  bot.command('balance', balanceCommand);
  bot.command('price', priceCommand);
  bot.command('status', statusCommand);

  bot.on('text', async (ctx) => {
    logger.info('Received message', { text: ctx.message.text, from: ctx.from?.id });
    await ctx.reply('🤖 I received your message. AI processing is coming soon!');
  });

  return bot;
}
