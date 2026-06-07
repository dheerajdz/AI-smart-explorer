import { MongoClient, ServerApiVersion, Db } from 'mongodb';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { UserModel } from '../models/User';
import { ConnectedWalletModel } from '../models/ConnectedWallet';
import { TrackedWalletModel } from '../models/TrackedWallet';
import { ActivityLogModel } from '../models/ActivityLog';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  try {
    client = new MongoClient(env.MONGO_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();
    db = client.db('smart-ai-explorer');

    // Send a ping to confirm successful connection
    await db.command({ ping: 1 });
    logger.info('✅ MongoDB connected to database: smart-ai-explorer');

    const collections = await db.listCollections().toArray();
    logger.info(`Collections: ${collections.map((c) => c.name).join(', ') || 'none yet'}`);

    // Create indexes for all collections
    await setupIndexes();

    return db;
  } catch (err) {
    logger.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

async function setupIndexes(): Promise<void> {
  try {
    logger.info('Setting up database indexes...');
    await UserModel.createIndexes();
    await ConnectedWalletModel.createIndexes();
    await TrackedWalletModel.createIndexes();
    await ActivityLogModel.createIndexes();
    logger.info('✅ All indexes created');
  } catch (err) {
    logger.error('❌ Failed to create indexes:', err);
    // Don't exit — indexes may already exist
  }
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB disconnected');
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectMongo() first.');
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error('MongoClient not connected. Call connectMongo() first.');
  }
  return client;
}
