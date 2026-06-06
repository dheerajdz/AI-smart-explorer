import { Router } from 'express';
import healthRoutes from './health';
import authRoutes from './auth';
import chatRoutes from './chatRoutes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);

export default router;
