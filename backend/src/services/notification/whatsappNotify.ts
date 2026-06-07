import twilio from 'twilio';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export async function sendWhatsAppNotification(phone: string, message: string): Promise<void> {
  logger.info('Sending WhatsApp notification', { phone, messageLength: message.length });

  try {
    const twilioMessage = await client.messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phone}`,
      body: message,
    });

    logger.info('WhatsApp notification sent', {
      sid: twilioMessage.sid,
      to: phone,
      status: twilioMessage.status,
    });
  } catch (err) {
    logger.error('Failed to send WhatsApp notification', { phone, error: (err as Error).message });
    throw err;
  }
}
