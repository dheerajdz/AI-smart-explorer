import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    const db = mongoose.connection.db;
    const dbName = mongoose.connection.name;
    logger.info(`✅ MongoDB connected to database: ${dbName}`);
    if (db) {
      const collections = await db.listCollections().toArray();
      logger.info(`Collections: ${collections.map((c) => c.name).join(', ') || 'none yet'}`);
    }
  } catch (err) {
    logger.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
