import twilio from 'twilio';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  try {
    const message = await client.messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${to}`,
      body,
    });

    logger.info('WhatsApp message sent', {
      sid: message.sid,
      to,
      status: message.status,
    });
  } catch (err) {
    logger.error('Failed to send WhatsApp message', { to, error: (err as Error).message });
    throw err;
  }
}
