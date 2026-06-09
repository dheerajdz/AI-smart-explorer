import { Telegraf } from 'telegraf';
import { logger } from '../../utils/logger';

let botInstance: Telegraf | null = null;

export function setBotInstance(bot: Telegraf): void {
  botInstance = bot;
}

export function getBotInstance(): Telegraf | null {
  return botInstance;
}

export async function sendTelegramNotification(userId: string, message: string): Promise<void> {
  if (!botInstance) {
    logger.warn('[telegramNotify] Bot instance not set');
    return;
  }
  try {
    await botInstance.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
    logger.info('[telegramNotify] Notification sent', { userId });
  } catch (err) {
    logger.error('[telegramNotify] Failed to send notification', { userId, error: err });
  }
}
