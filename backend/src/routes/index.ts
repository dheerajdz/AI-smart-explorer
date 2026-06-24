import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import blockchainRouter from './blockchain';
import billingRouter from './billing';
import reputationRouter from './reputation';
import whatsappRouter from '../bots/whatsapp';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public routes (no auth required)
router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use(whatsappRouter); // WhatsApp webhook needs raw body

// Protected routes (auth required)
router.use('/api/blockchain', authMiddleware, blockchainRouter);
router.use('/api/billing', authMiddleware, billingRouter);
router.use('/api/reputation', authMiddleware, reputationRouter);

export default router;
