import { Telegraf } from 'telegraf';
import { logger } from '../../utils/logger';

let botInstance: Telegraf | null = null;

export function setBotInstance(bot: Telegraf): void {
  botInstance = bot;
}

export async function sendTelegramNotification(userId: string | number, message: string): Promise<void> {
  if (!botInstance) {
    logger.warn('[telegramNotify] No bot instance set');
    return;
  }

  try {
    await botInstance.telegram.sendMessage(userId, message, {
      parse_mode: 'Markdown',
    });
    logger.info('[telegramNotify] Sent notification', { userId });
  } catch (error) {
    logger.error('[telegramNotify] Failed to send notification', { userId, error });
  }
}
