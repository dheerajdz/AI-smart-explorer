import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';
import { Network } from '../utils/network';

export interface ITrackedWallet {
  _id?: string;
  userId: string;
  address: string;
  network: Network;
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x';
  label?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'trackedwallets';

export class TrackedWalletModel {
  static getCollection() {
    return getDb().collection<ITrackedWallet>(COLLECTION_NAME);
  }

  static async findOne(filter: Partial<ITrackedWallet>): Promise<ITrackedWallet | null> {
    return this.getCollection().findOne(filter as any);
  }

  static async findByUserId(userId: string): Promise<ITrackedWallet[]> {
    return this.getCollection()
      .find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async findByUserAndAddress(
    userId: string,
    address: string
  ): Promise<ITrackedWallet | null> {
    return this.getCollection().findOne({
      userId,
      address: address.toLowerCase(),
      isActive: true,
    });
  }

  static async findAllActive(): Promise<ITrackedWallet[]> {
    return this.getCollection().find({ isActive: true }).toArray();
  }

  static async track(walletData: Omit<ITrackedWallet, '_id' | 'createdAt' | 'updatedAt'>): Promise<ITrackedWallet> {
    const now = new Date();
    const normalizedAddress = walletData.address.trim().toLowerCase();

    // Upsert: if exists and inactive, reactivate; if active, return existing
    const result = await this.getCollection().findOneAndUpdate(
      { userId: walletData.userId, address: normalizedAddress },
      {
        $setOnInsert: {
          userId: walletData.userId,
          address: normalizedAddress,
          network: walletData.network,
          platform: walletData.platform,
          label: walletData.label,
          createdAt: now,
        },
        $set: {
          isActive: true,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const wallet = result as unknown as ITrackedWallet;
    logger.info('[TrackedWallet] Tracked', { userId: wallet.userId, address: wallet.address });
    return wallet;
  }

  static async untrack(userId: string, address: string): Promise<boolean> {
    const result = await this.getCollection().updateOne(
      { userId, address: address.trim().toLowerCase(), isActive: true },
      { $set: { isActive: false, updatedAt: new Date() } }
    );

    const success = result.modifiedCount > 0;
    if (success) {
      logger.info('[TrackedWallet] Untracked', { userId, address });
    }
    return success;
  }

  static async listWallets(userId: string): Promise<ITrackedWallet[]> {
    return this.findByUserId(userId);
  }

  static async getAllTrackedUsers(): Promise<string[]> {
    const wallets = await this.getCollection()
      .find({ isActive: true })
      .project({ userId: 1 })
      .toArray();
    return [...new Set(wallets.map((w) => w.userId))];
  }

  static async createIndexes(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ userId: 1, address: 1 }, { unique: true });
    await collection.createIndex({ userId: 1, isActive: 1 });
    await collection.createIndex({ address: 1, isActive: 1 });
    logger.info('TrackedWallet indexes created');
  }
}
