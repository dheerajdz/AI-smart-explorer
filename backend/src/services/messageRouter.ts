import { logger } from '../utils/logger';
import { commandHandler } from './commandHandler';

export interface RouterResponse {
  text: string;
}

export async function messageRouter(
  message: string,
  userId: string,
  telegramId?: number
): Promise<RouterResponse> {
  const trimmedMessage = message.trim();

  logger.info('Routing message', { userId, message: trimmedMessage });

  if (trimmedMessage.startsWith('/')) {
    const parts = trimmedMessage.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    return commandHandler(command, args, userId, telegramId);
  }

  // Non-command messages go to AI in the future
  return { text: 'AI processing coming soon 🚀' };
}
