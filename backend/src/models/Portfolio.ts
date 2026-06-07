import mongoose, { Schema, Document } from 'mongoose';

export interface IPortfolioWallet {
  address: string;
  network: 'mainnet' | 'testnet';
}

export interface IPortfolio extends Document {
  userId: string;
  wallets: IPortfolioWallet[];
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioWalletSchema = new Schema<IPortfolioWallet>(
  {
    address: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    network: {
      type: String,
      enum: ['mainnet', 'testnet'],
      default: 'mainnet',
    },
  },
  { _id: false }
);

const PortfolioSchema = new Schema<IPortfolio>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    wallets: {
      type: [PortfolioWalletSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const PortfolioModel = mongoose.model<IPortfolio>('Portfolio', PortfolioSchema);
