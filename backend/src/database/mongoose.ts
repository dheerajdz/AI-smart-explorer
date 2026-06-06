import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info('✅ MongoDB connected');
  } catch (err) {
    logger.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
