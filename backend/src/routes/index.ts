import { Router } from 'express';
import healthRouter from './health';
import whatsappRouter from '../bots/whatsapp';

const router = Router();

router.use('/health', healthRouter);
router.use(whatsappRouter);

export default router;
