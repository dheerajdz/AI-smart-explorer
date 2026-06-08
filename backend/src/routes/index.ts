import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import blockchainRouter from './blockchain';
import billingRouter from './billing';
import reputationRouter from './reputation';
import whatsappRouter from '../bots/whatsapp';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/api/blockchain', blockchainRouter);
router.use('/api/billing', billingRouter);
router.use('/api/reputation', reputationRouter);
router.use(whatsappRouter);

export default router;
