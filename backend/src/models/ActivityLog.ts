import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';

export interface IActivityLog {
  _id?: string;
  userId: string;
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x';
  action: string;
  input?: string;
  output?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const COLLECTION_NAME = 'activitylogs';

export class ActivityLogModel {
  static getCollection() {
    return getDb().collection<IActivityLog>(COLLECTION_NAME);
  }

  static async create(logData: Omit<IActivityLog, '_id' | 'createdAt'>): Promise<IActivityLog> {
    const now = new Date();
    const log: IActivityLog = {
      ...logData,
      createdAt: now,
    };

    const result = await this.getCollection().insertOne(log);
    logger.info('Activity logged', { userId: log.userId, action: log.action, platform: log.platform });
    return { ...log, _id: result.insertedId.toString() };
  }

  static async findByUserId(userId: string, platform: 'telegram' | 'whatsapp' | 'slack' | 'x', limit: number = 50): Promise<IActivityLog[]> {
    return this.getCollection()
      .find({ userId, platform })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  static async findRecent(limit: number = 100): Promise<IActivityLog[]> {
    return this.getCollection()
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  static async countByUser(userId: string, platform: 'telegram' | 'whatsapp' | 'slack' | 'x'): Promise<number> {
    return this.getCollection().countDocuments({ userId, platform });
  }

  static async createIndexes(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ userId: 1, platform: 1 });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ action: 1 });
    logger.info('ActivityLog indexes created');
  }
}
