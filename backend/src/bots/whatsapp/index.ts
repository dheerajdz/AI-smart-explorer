import { Router } from 'express';
import { logger } from '../../utils/logger';
import { whatsappWebhook } from './webhook';

const router = Router();

router.post('/webhook/whatsapp', whatsappWebhook);

export default router;

export function createWhatsAppBot(): void {
  logger.info('📱 WhatsApp bot initialized (webhook mode)');
}
