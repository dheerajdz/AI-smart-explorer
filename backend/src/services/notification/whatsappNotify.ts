import twilio from 'twilio';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

let twilioClient: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!twilioClient) {
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

export async function sendWhatsAppNotification(phone: string, message: string): Promise<void> {
  try {
    const client = getClient();
    const result = await client.messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phone}`,
      body: message,
    });

    logger.info('[whatsappNotify] Message sent', {
      sid: result.sid,
      to: phone,
      status: result.status,
    });
  } catch (err) {
    logger.error('[whatsappNotify] Failed to send WhatsApp message', {
      to: phone,
      error: (err as Error).message,
    });
    throw err;
  }
}
