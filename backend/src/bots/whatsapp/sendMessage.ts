import twilio from 'twilio';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

function createClient() {
  if (env.TWILIO_ACCOUNT_SID === 'dummy' || env.TWILIO_AUTH_TOKEN === 'dummy') {
    return null;
  }
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

const client = createClient();

export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  if (!client) {
    logger.warn('WhatsApp not configured (dummy credentials)');
    return;
  }

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
