import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';

export interface IPayment {
  _id?: string;
  userId: string;
  amount: number;
  currency: 'INR';
  upiId: string;
  transactionId: string;
  status: 'pending' | 'completed' | 'failed';
  purpose: 'premium' | 'tip';
  createdAt: Date;
  completedAt?: Date;
}

const COLLECTION_NAME = 'payments';

export class PaymentModel {
  static getCollection() {
    return getDb().collection<IPayment>(COLLECTION_NAME);
  }

  static async create(paymentData: Omit<IPayment, '_id' | 'createdAt'>): Promise<IPayment> {
    const now = new Date();
    const payment: IPayment = {
      ...paymentData,
      createdAt: now,
    };

    const result = await this.getCollection().insertOne(payment);
    logger.info('Payment created', { paymentId: result.insertedId, transactionId: payment.transactionId });
    return { ...payment, _id: result.insertedId.toString() };
  }

  static async findByTransactionId(transactionId: string): Promise<IPayment | null> {
    return this.getCollection().findOne({ transactionId });
  }

  static async updateStatus(transactionId: string, status: IPayment['status']): Promise<boolean> {
    const result = await this.getCollection().updateOne(
      { transactionId },
      { $set: { status, completedAt: status === 'completed' ? new Date() : undefined } }
    );
    return result.modifiedCount > 0;
  }

  static async createIndexes(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ transactionId: 1 }, { unique: true });
    await collection.createIndex({ userId: 1 });
    logger.info('Payment indexes created');
  }
}
