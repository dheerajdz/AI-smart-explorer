import { Telegraf } from 'telegraf';
import { logger } from '../../utils/logger';

let botInstance: Telegraf | null = null;

export function setBotInstance(bot: Telegraf): void {
  botInstance = bot;
}

export function getBotInstance(): Telegraf | null {
  return botInstance;
}
