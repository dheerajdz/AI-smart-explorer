import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';
import { sanitizeString, validateUserId, sanitizeWalletAddress } from '../utils/sanitizer';

export interface IConnectedWallet {
  _id?: string;
  userId: string;
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x';
  address: string;
  network: 'mainnet' | 'testnet';
  label?: string;
  language: 'en' | 'hi' | 'mr';
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
    if (!validateUserId(userId)) {
      logger.warn('[ConnectedWallet] Invalid userId rejected', { userId });
      return null;
    }
    return this.getCollection().findOne({ userId: sanitizeString(userId), platform, isConnected: true });
  }

  static async countDocuments(filter: Partial<IConnectedWallet>): Promise<number> {
    return this.getCollection().countDocuments(filter as any);
  }

  static async create(walletData: Omit<IConnectedWallet, '_id' | 'createdAt' | 'updatedAt'>): Promise<IConnectedWallet> {
    const now = new Date();
    
    // Sanitize inputs
    const sanitizedAddress = sanitizeWalletAddress(walletData.address);
    if (!sanitizedAddress) {
      logger.warn('[ConnectedWallet] Invalid address rejected', { address: walletData.address });
      throw new Error('Invalid wallet address');
    }
    
    const wallet: IConnectedWallet = {
      ...walletData,
      userId: sanitizeString(walletData.userId),
      address: sanitizedAddress,
      label: walletData.label ? sanitizeString(walletData.label) : undefined,
      language: walletData.language || 'en',
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

  static async findOneAndUpdate(
    filter: Partial<IConnectedWallet>,
    update: Partial<IConnectedWallet>
  ): Promise<IConnectedWallet | null> {
    const result = await this.getCollection().findOneAndUpdate(
      filter as any,
      { $set: { ...update, updatedAt: new Date() } },
      { returnDocument: 'after', upsert: false }
    );
    return result;
  }

  static async createIndexes(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ userId: 1, platform: 1 }, { unique: true });
    await collection.createIndex({ isConnected: 1 });
    logger.info('ConnectedWallet indexes created');
  }
}
