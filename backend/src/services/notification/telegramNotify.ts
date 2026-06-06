import { Telegraf } from 'telegraf';
import { logger } from '../../utils/logger';

let botInstance: Telegraf | null = null;

export function setBotInstance(bot: Telegraf): void {
  botInstance = bot;
}

export async function sendTelegramNotification(chatId: number, message: string): Promise<void> {
  logger.info('Sending Telegram notification', { chatId, messageLength: message.length });

  if (!botInstance) {
    logger.warn('No bot instance set, cannot send notification');
    return;
  }

  try {
    await botInstance.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Failed to send Telegram notification', { chatId, error: (err as Error).message });
  }
}
