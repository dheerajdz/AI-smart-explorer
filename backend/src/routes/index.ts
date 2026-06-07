import { Router } from 'express';
import healthRoutes from './health';
import authRoutes from './auth';
import chatRoutes from './chatRoutes';
import webhookRoutes from './webhooks';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
