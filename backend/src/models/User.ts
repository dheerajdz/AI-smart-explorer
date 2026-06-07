import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';
import { SupportedLanguage } from '../services/i18n';
import { PlanTier } from '../types';

export interface IUser {
  _id?: string;
  telegramId: number;
  telegramUsername?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  walletAddress?: string;
  plan: PlanTier;
  planAssignedAt: Date;
  isEmailVerified?: boolean;
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

  static async create(
    userData: Omit<IUser, '_id' | 'createdAt' | 'updatedAt' | 'planAssignedAt'> &
      Partial<Pick<IUser, 'planAssignedAt'>>
  ): Promise<IUser> {
    const now = new Date();
    const user: IUser = {
      ...userData,
      email: userData.email ? userData.email.toLowerCase() : undefined,
      walletAddress: userData.walletAddress ? userData.walletAddress.toLowerCase() : undefined,
      preferredLanguage: userData.preferredLanguage || 'en',
      plan: userData.plan || 'FREE',
      planAssignedAt: userData.planAssignedAt || now,
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

    // ── Handle potential IndexKeySpecsConflict ─────────────────
    // If a previous deployment created a non-sparse unique index on email
    // or walletAddress, MongoDB will reject a new createIndex with sparse:true.
    // We drop any existing index on those keys first, then recreate.
    const existingIndexes = await collection.indexes();

    const dropIfConflicting = async (fieldName: string) => {
      const idx = existingIndexes.find(
        (i) => JSON.stringify(i.key) === JSON.stringify({ [fieldName]: 1 })
      );
      if (idx && idx.name) {
        await collection.dropIndex(idx.name);
        logger.info(`Dropped conflicting index ${idx.name} on ${fieldName}`);
      }
    };

    await dropIfConflicting('email');
    await dropIfConflicting('walletAddress');

    await collection.createIndex({ email: 1 }, { unique: true, sparse: true });
    await collection.createIndex({ walletAddress: 1 }, { unique: true, sparse: true });
    logger.info('User indexes created');
  }

  // ─── Plan helpers (from feat/plans-system) ─────────────────

  static async findOrCreateUser(
    telegramId: number,
    profile?: { username?: string; firstName?: string; lastName?: string }
  ): Promise<{ user: IUser; plan: PlanTier; isNew: boolean }> {
    let user = await this.findByTelegramId(telegramId);

    if (!user) {
      user = await this.create({
        telegramId,
        username: profile?.username,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        plan: 'FREE',
        planAssignedAt: new Date(),
        preferredLanguage: 'en',
      });
      logger.info('New user created with FREE plan', { telegramId });
      return { user, plan: user.plan, isNew: true };
    }

    return { user, plan: user.plan, isNew: false };
  }

  static async getUserPlan(telegramId: number): Promise<PlanTier | null> {
    const user = await this.findByTelegramId(telegramId);
    return user?.plan ?? null;
  }

  static async setUserPlan(targetTelegramId: number, plan: PlanTier): Promise<boolean> {
    return this.updateOne(
      { telegramId: targetTelegramId },
      { plan, planAssignedAt: new Date() }
    );
  }
}
