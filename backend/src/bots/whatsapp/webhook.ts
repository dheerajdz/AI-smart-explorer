import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { messageHandler } from './messageHandler';

interface TwilioWebhookBody {
  From?: string;
  Body?: string;
}

export async function whatsappWebhook(req: Request, res: Response): Promise<void> {
  const { From, Body } = req.body as TwilioWebhookBody;

  const fromNumber = From?.replace('whatsapp:', '') ?? 'unknown';
  const messageBody = Body ?? '';

  logger.info('Received WhatsApp Message:');
  logger.info(`From: ${fromNumber}`);
  logger.info(`Message: ${messageBody}`);

  try {
    await messageHandler(fromNumber, messageBody);
  } catch (err) {
    logger.error('Error handling WhatsApp message', { error: (err as Error).message });
  }

  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
}
