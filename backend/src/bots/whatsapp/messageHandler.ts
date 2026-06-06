import { logger } from '../../utils/logger';
import { sendWhatsAppMessage } from './sendMessage';
import { messageRouter } from '../../services/messageRouter';

export async function messageHandler(from: string, body: string): Promise<void> {
  const trimmedBody = body.trim();

  logger.info('Processing WhatsApp message', { from, body: trimmedBody });

  const response = await messageRouter(trimmedBody, from);

  await sendWhatsAppMessage(from, response.text);
}
