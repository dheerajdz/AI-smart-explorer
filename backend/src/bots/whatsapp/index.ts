import { Router } from 'express';
import { whatsappWebhook } from './webhook';

const router = Router();

router.post('/webhook/whatsapp', whatsappWebhook);

export default router;
