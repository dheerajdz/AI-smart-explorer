import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  address: string;
  label?: string;
  network: 'xdc' | 'xdc-testnet';
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    address: { type: String, required: true },
    label: { type: String },
    network: { type: String, enum: ['xdc', 'xdc-testnet'], default: 'xdc' },
  },
  { timestamps: true }
);

WalletSchema.index({ userId: 1, address: 1 }, { unique: true });

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
