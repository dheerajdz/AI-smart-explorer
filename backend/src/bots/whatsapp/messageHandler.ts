import { logger } from '../../utils/logger';
import { sendWhatsAppMessage } from './sendMessage';
import { messageRouter } from '../../services/messageRouter';
import * as walletStore from '../../services/storage/inMemoryStore';

export async function messageHandler(from: string, body: string): Promise<void> {
  const trimmedBody = body.trim();

  logger.info('Processing WhatsApp message', { from, body: trimmedBody });

  // Store user's phone number for notifications
  walletStore.setUserPhone(from, from);

  const response = await messageRouter(trimmedBody, from);

  await sendWhatsAppMessage(from, response.text);
}
