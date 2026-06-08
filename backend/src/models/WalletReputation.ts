import mongoose, { Schema, Document } from 'mongoose';

export interface IWalletReputationMetrics {
  accountAgeDays: number;
  transactionCount: number;
  totalVolumeXDC: number;
  failedTxRatio: number;
  contractInteractions: number;
  verifiedContracts: number;
  uniqueCounterparties: number;
  avgTxValueXDC: number;
  maxTxValueXDC: number;
  whaleScore: number;
  firstTxDate?: Date;
  lastTxDate?: Date;
}

export interface IWalletReputation extends Document {
  address: string;
  network: 'mainnet' | 'testnet';
  overallScore: number;
  metrics: IWalletReputationMetrics;
  badges: string[];
  lastUpdated: Date;
  createdAt: Date;
}

const WalletReputationSchema = new Schema<IWalletReputation>(
  {
    address: {
      type: String,
      required: true,
      index: true,
    },
    network: {
      type: String,
      enum: ['mainnet', 'testnet'],
      default: 'mainnet',
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    metrics: {
      accountAgeDays: { type: Number, default: 0 },
      transactionCount: { type: Number, default: 0 },
      totalVolumeXDC: { type: Number, default: 0 },
      failedTxRatio: { type: Number, min: 0, max: 1, default: 0 },
      contractInteractions: { type: Number, default: 0 },
      verifiedContracts: { type: Number, default: 0 },
      uniqueCounterparties: { type: Number, default: 0 },
      avgTxValueXDC: { type: Number, default: 0 },
      maxTxValueXDC: { type: Number, default: 0 },
      whaleScore: { type: Number, min: 0, max: 100, default: 0 },
      firstTxDate: Date,
      lastTxDate: Date,
    },
    badges: {
      type: [String],
      default: [],
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for address + network uniqueness
WalletReputationSchema.index({ address: 1, network: 1 }, { unique: true });
// Index for leaderboard queries
WalletReputationSchema.index({ overallScore: -1, network: 1 });

export const WalletReputationModel = mongoose.model<IWalletReputation>(
  'WalletReputation',
  WalletReputationSchema
);
