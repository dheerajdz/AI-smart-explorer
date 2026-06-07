import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';
import { Network } from '../utils/network';

export type AlertType = 'new_tx' | 'failed_tx' | 'contract_deploy' | 'balance_change' | 'price_threshold';
export type AlertPlatform = 'telegram' | 'whatsapp';

export interface IAlert {
  _id?: string;
  userId: string;
  platform: AlertPlatform;
  type: AlertType;
  address?: string;
  network?: Network;
  condition?: Record<string, any>;
  isActive: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'alerts';

export class AlertModel {
  static getCollection() {
    return getDb().collection<IAlert>(COLLECTION_NAME);
  }

  static async create(alertData: Omit<IAlert, '_id' | 'createdAt' | 'updatedAt' | 'lastTriggered'>): Promise<IAlert> {
    const now = new Date();
    const alert: IAlert = {
      ...alertData,
      isActive: alertData.isActive ?? true,
      cooldownMinutes: alertData.cooldownMinutes ?? 5,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.getCollection().insertOne(alert as any);
    logger.info('Alert created', { userId: alert.userId, type: alert.type, address: alert.address });
    return { ...alert, _id: result.insertedId.toString() };
  }

  static async findByUserId(userId: string, platform: AlertPlatform): Promise<IAlert[]> {
    return this.getCollection()
      .find({ userId, platform })
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async findActiveByUserId(userId: string, platform: AlertPlatform): Promise<IAlert[]> {
    return this.getCollection()
      .find({ userId, platform, isActive: true })
      .toArray();
  }

  static async findActiveByAddress(address: string, network: Network, type?: AlertType): Promise<IAlert[]> {
    const query: any = { address: address.toLowerCase(), network, isActive: true };
    if (type) query.type = type;
    return this.getCollection().find(query).toArray();
  }

  static async findActiveForTrigger(address: string, network: Network, type: AlertType): Promise<IAlert[]> {
    const now = new Date();
    const cooldownMs = 5 * 60 * 1000;
    const cooldownDeadline = new Date(now.getTime() - cooldownMs);

    const query: any = {
      address: address.toLowerCase(),
      network,
      type,
      isActive: true,
      $or: [
        { lastTriggered: { $exists: false } },
        { lastTriggered: null },
        { lastTriggered: { $lt: cooldownDeadline } },
      ],
    };

    return this.getCollection().find(query).toArray();
  }

  static async updateLastTriggered(alertId: string): Promise<void> {
    await this.getCollection().updateOne(
      { _id: alertId },
      { $set: { lastTriggered: new Date(), updatedAt: new Date() } }
    );
  }

  static async deleteById(alertId: string, userId: string): Promise<boolean> {
    const result = await this.getCollection().deleteOne({ _id: alertId, userId });
    return result.deletedCount === 1;
  }

  static async toggleActive(alertId: string, userId: string, isActive: boolean): Promise<boolean> {
    const result = await this.getCollection().updateOne(
      { _id: alertId, userId },
      { $set: { isActive, updatedAt: new Date() } }
    );
    return result.modifiedCount === 1;
  }

  static async createIndexes(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ userId: 1, platform: 1 });
    await collection.createIndex({ address: 1, network: 1, type: 1, isActive: 1 });
    await collection.createIndex({ isActive: 1, lastTriggered: 1 });
    logger.info('Alert indexes created');
  }
}
