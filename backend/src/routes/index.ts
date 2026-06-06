import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import whatsappRouter from '../bots/whatsapp';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use(whatsappRouter);

export default router;
