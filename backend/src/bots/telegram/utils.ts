import { Telegraf } from 'telegraf';
import { logger } from '../../utils/logger';

let botInstance: Telegraf | null = null;

export function setBotInstance(bot: Telegraf): void {
  botInstance = bot;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!botInstance) {
    logger.warn('[telegramUtils] Bot instance not set');
    return;
  }
  try {
    await botInstance.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('[telegramUtils] Failed to send message', { chatId, error: err });
  }
}
