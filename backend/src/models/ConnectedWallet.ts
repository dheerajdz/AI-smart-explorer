import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';

export interface IConnectedWallet {
  _id?: string;
  userId: string;
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x';
  address: string;
  network: 'mainnet' | 'testnet';
  label?: string;
  isConnected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'connectedwallets';

export class ConnectedWalletModel {
  static getCollection() {
    return getDb().collection<IConnectedWallet>(COLLECTION_NAME);
  }

  static async findOne(filter: Partial<IConnectedWallet>): Promise<IConnectedWallet | null> {
    return this.getCollection().findOne(filter as any);
  }

  static async findByUserId(userId: string, platform: 'telegram' | 'whatsapp' | 'slack' | 'x'): Promise<IConnectedWallet | null> {
    return this.getCollection().findOne({ userId, platform, isConnected: true });
  }

  static async countDocuments(filter: Partial<IConnectedWallet>): Promise<number> {
    return this.getCollection().countDocuments(filter as any);
  }

  static async create(walletData: Omit<IConnectedWallet, '_id' | 'createdAt' | 'updatedAt'>): Promise<IConnectedWallet> {
    const now = new Date();
    const wallet: IConnectedWallet = {
      ...walletData,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.getCollection().insertOne(wallet);
    logger.info('Connected wallet created', { userId: wallet.userId, platform: wallet.platform });
    return { ...wallet, _id: result.insertedId.toString() };
  }

  static async updateOne(
    filter: Partial<IConnectedWallet>,
    update: Partial<IConnectedWallet>
  ): Promise<boolean> {
    const result = await this.getCollection().updateOne(filter as any, {
      $set: { ...update, updatedAt: new Date() },
    }, { upsert: true });
    return result.modifiedCount > 0 || result.upsertedCount > 0;
  }

  static async createIndexes(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ userId: 1, platform: 1 }, { unique: true });
    await collection.createIndex({ isConnected: 1 });
    logger.info('ConnectedWallet indexes created');
  }
}
