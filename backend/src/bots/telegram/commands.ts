import { Context } from 'telegraf';
import { logger } from '../../utils/logger';

export async function startCommand(ctx: Context): Promise<void> {
  logger.info('Command: /start', { from: ctx.from?.id });
  await ctx.reply(
    '👋 Welcome to *Smart AI Explorer* — The Blockchain You Can Text!\n\n' +
      'I can help you query XDC blockchain data using natural language.\n\n' +
      '*Commands:*\n' +
      '/track <address> — Track a wallet\n' +
      '/untrack <address> — Untrack a wallet\n' +
      '/list — List tracked wallets\n' +
      '/balance <address> — Get wallet balance\n' +
      '/price — Get XDC price\n' +
      '/status — Get network status',
    { parse_mode: 'Markdown' }
  );
}

export async function trackCommand(ctx: Context): Promise<void> {
  logger.info('Command: /track', { from: ctx.from?.id });
  await ctx.reply('🔔 Wallet tracking is coming soon!');
}

export async function untrackCommand(ctx: Context): Promise<void> {
  logger.info('Command: /untrack', { from: ctx.from?.id });
  await ctx.reply('🔕 Wallet untracking is coming soon!');
}

export async function listCommand(ctx: Context): Promise<void> {
  logger.info('Command: /list', { from: ctx.from?.id });
  await ctx.reply('📋 Your tracked wallets will appear here soon.');
}

export async function balanceCommand(ctx: Context): Promise<void> {
  logger.info('Command: /balance', { from: ctx.from?.id });
  await ctx.reply('💰 Balance lookup is coming soon!');
}

export async function priceCommand(ctx: Context): Promise<void> {
  logger.info('Command: /price', { from: ctx.from?.id });
  await ctx.reply('📈 Price data is coming soon!');
}

export async function statusCommand(ctx: Context): Promise<void> {
  logger.info('Command: /status', { from: ctx.from?.id });
  await ctx.reply('🌐 Network status is coming soon!');
}
