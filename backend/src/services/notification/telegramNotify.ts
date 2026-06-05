import { logger } from '../../utils/logger';

export async function sendTelegramNotification(chatId: number, message: string): Promise<void> {
  logger.info('Sending Telegram notification', { chatId, messageLength: message.length });
  // TODO: Use bot.telegram.sendMessage or HTTP call to Bot API
}
