import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import blockchainRouter from './blockchain';
import chatRoutes from './chatRoutes';
import webhookRoutes from './webhooks';
import portfolioRouter from './portfolioRoutes';
import whatsappRouter from '../bots/whatsapp';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/api/blockchain', blockchainRouter);
router.use('/chat', chatRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/api/portfolio', portfolioRouter);
router.use(whatsappRouter);

export default router;
