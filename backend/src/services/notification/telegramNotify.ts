import { logger } from '../../utils/logger';

export async function sendTelegramNotification(chatId: number, message: string): Promise<void> {
  logger.info('Sending Telegram notification', { chatId, messageLength: message.length });
  // TODO: Integrate with actual Telegram bot instance
  // bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}
