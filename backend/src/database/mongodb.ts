import { MongoClient, ServerApiVersion, Db } from 'mongodb';
import { logger } from '../utils/logger';
import { env } from '../config/env';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  const maxRetries = 5;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

      return db;
    } catch (err) {
      logger.error(`❌ MongoDB connection error (attempt ${attempt}/${maxRetries}):`, err);
      
      if (attempt === maxRetries) {
        logger.error('❌ Max retries reached. Exiting...');
        process.exit(1);
      }

      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      logger.info(`⏳ Retrying MongoDB connection in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Failed to connect to MongoDB after max retries');
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
