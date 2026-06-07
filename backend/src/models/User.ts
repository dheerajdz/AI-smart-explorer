import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';
import { SupportedLanguage } from '../services/i18n';

export interface IUser {
  _id?: string;
  telegramId: number;
  telegramUsername?: string;
  email: string;
  walletAddress: string;
  plan: 'free' | 'premium';
  isEmailVerified: boolean;
  preferredLanguage: SupportedLanguage;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'users';

export class UserModel {
  static getCollection() {
    return getDb().collection<IUser>(COLLECTION_NAME);
  }

  static async findOne(filter: Partial<IUser>): Promise<IUser | null> {
    return this.getCollection().findOne(filter as any);
  }

  static async findByTelegramId(telegramId: number): Promise<IUser | null> {
    return this.getCollection().findOne({ telegramId });
  }

  static async findByEmail(email: string): Promise<IUser | null> {
    return this.getCollection().findOne({ email: email.toLowerCase() });
  }

  static async findByWalletAddress(walletAddress: string): Promise<IUser | null> {
    return this.getCollection().findOne({ walletAddress: walletAddress.toLowerCase() });
  }

  static async create(userData: Omit<IUser, '_id' | 'createdAt' | 'updatedAt'>): Promise<IUser> {
    const now = new Date();
    const user: IUser = {
      ...userData,
      email: userData.email.toLowerCase(),
      walletAddress: userData.walletAddress.toLowerCase(),
      preferredLanguage: userData.preferredLanguage || 'en',
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.getCollection().insertOne(user);
    logger.info('User created', { userId: result.insertedId, telegramId: user.telegramId });
    return { ...user, _id: result.insertedId.toString() };
  }

  static async updateOne(
    filter: Partial<IUser>,
    update: Partial<IUser>
  ): Promise<boolean> {
    const result = await this.getCollection().updateOne(filter as any, {
      $set: { ...update, updatedAt: new Date() },
    });
    return result.modifiedCount > 0;
  }

  static async updateLanguage(
    telegramId: number,
    language: SupportedLanguage
  ): Promise<boolean> {
    return this.updateOne({ telegramId }, { preferredLanguage: language });
  }

  static async findByTelegramIdWithLanguage(telegramId: number): Promise<{ user: IUser | null; language: SupportedLanguage }> {
    const user = await this.findByTelegramId(telegramId);
    return { user, language: user?.preferredLanguage || 'en' };
  }

  static async deleteOne(filter: Partial<IUser>): Promise<boolean> {
    const result = await this.getCollection().deleteOne(filter as any);
    return result.deletedCount > 0;
  }

  static async findAll(): Promise<IUser[]> {
    return this.getCollection().find().toArray();
  }

  static async createIndexes(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ telegramId: 1 }, { unique: true });
    await collection.createIndex({ email: 1 }, { unique: true });
    await collection.createIndex({ walletAddress: 1 }, { unique: true });
    logger.info('User indexes created');
  }
}
