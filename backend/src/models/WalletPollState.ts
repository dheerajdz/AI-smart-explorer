import { getDb } from '../database/mongodb';
import { logger } from '../utils/logger';
import { Network } from '../utils/network';

export interface IWalletPollState {
  _id?: string;
  address: string;
  network: Network;
  lastTxHash?: string;
  lastPolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'walletpollstates';

export class WalletPollStateModel {
  static getCollection() {
    return getDb().collection<IWalletPollState>(COLLECTION_NAME);
  }

  static async upsert(address: string, network: Network, lastTxHash?: string): Promise<void> {
    const now = new Date();
    await this.getCollection().updateOne(
      { address: address.toLowerCase(), network },
      {
        $set: {
          lastTxHash,
          lastPolledAt: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  }

  static async findByAddress(address: string, network: Network): Promise<IWalletPollState | null> {
    return this.getCollection().findOne({
      address: address.toLowerCase(),
      network,
    });
  }

  static async createIndexes(): Promise<void> {
    const collection = this.getCollection();
    await collection.createIndex({ address: 1, network: 1 }, { unique: true });
    await collection.createIndex({ lastPolledAt: 1 });
    logger.info('WalletPollState indexes created');
  }
}
