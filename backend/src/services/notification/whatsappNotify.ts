import { logger } from '../../utils/logger';

export async function sendWhatsAppNotification(phone: string, message: string): Promise<void> {
  logger.info('Sending WhatsApp notification', { phone, messageLength: message.length });
  // TODO: Integrate WhatsApp Business API or Baileys
}
