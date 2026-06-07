import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { sendWhatsAppMessage } from './sendMessage';
import { dispatch } from '../shared';

interface TwilioWebhookBody {
  From?: string;
  Body?: string;
}

export async function whatsappWebhook(req: Request, res: Response): Promise<void> {
  const { From, Body } = req.body as TwilioWebhookBody;

  const fromNumber = From?.replace('whatsapp:', '') ?? 'unknown';
  const messageBody = Body ?? '';

  logger.info('Received WhatsApp Message:', { from: fromNumber, body: messageBody });

  try {
    const response = await dispatch('whatsapp', fromNumber, messageBody);
    await sendWhatsAppMessage(fromNumber, response.text);
  } catch (err) {
    logger.error('Error handling WhatsApp message', {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    res.set('Content-Type', 'text/xml');
    res.status(500).send('<Response><Message>Sorry, something went wrong.</Message></Response>');
    return;
  }

  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
}
