import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';

export interface IPortfolioWallet {
  address: string;
  network: 'mainnet' | 'testnet';
  label?: string;
  addedAt: Date;
}

export interface IPortfolio {
  _id?: string;
  userId: string;
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x';
  wallets: IPortfolioWallet[];
  totalBalanceXDC: string;
  totalBalanceUSD: string;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'portfolios';

export class PortfolioModel {
  static getCollection() {
    return getDb().collection<IPortfolio>(COLLECTION_NAME);
  }

  static async findByUser(userId: string, platform: string): Promise<IPortfolio | null> {
    return this.getCollection().findOne({ userId, platform });
  }

  static async create(userId: string, platform: string): Promise<IPortfolio> {
    const now = new Date();
    const portfolio: IPortfolio = {
      userId,
      platform,
      wallets: [],
      totalBalanceXDC: '0',
      totalBalanceUSD: '0',
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.getCollection().insertOne(portfolio);
    logger.info('Portfolio created', { userId, platform });
    return { ...portfolio, _id: result.insertedId.toString() };
  }

  static async addWallet(
    userId: string,
    platform: string,
    wallet: IPortfolioWallet
  ): Promise<boolean> {
    const result = await this.getCollection().updateOne(
      { userId, platform },
      {
        $push: { wallets: wallet },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
    return result.modifiedCount > 0 || result.upsertedCount > 0;
  }

  static async removeWallet(
    userId: string,
    platform: string,
    address: string
  ): Promise<boolean> {
    const result = await this.getCollection().updateOne(
      { userId, platform },
      {
        $pull: { wallets: { address } },
        $set: { updatedAt: new Date() },
      }
    );
    return result.modifiedCount > 0;
  }

  static async updateBalances(
    userId: string,
    platform: string,
    totalBalanceXDC: string,
    totalBalanceUSD: string
  ): Promise<boolean> {
    const result = await this.getCollection().updateOne(
      { userId, platform },
      {
        $set: {
          totalBalanceXDC,
          totalBalanceUSD,
          lastUpdated: new Date(),
          updatedAt: new Date(),
        },
      }
    );
    return result.modifiedCount > 0;
  }

  static async createIndexes(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ userId: 1, platform: 1 }, { unique: true });
    logger.info('Portfolio indexes created');
  }
}
