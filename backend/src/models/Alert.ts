import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  userId: mongoose.Types.ObjectId;
  walletId?: mongoose.Types.ObjectId;
  type: 'price' | 'balance' | 'transaction';
  condition: 'above' | 'below' | 'equals';
  threshold: string;
  isActive: boolean;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet' },
    type: { type: String, enum: ['price', 'balance', 'transaction'], required: true },
    condition: { type: String, enum: ['above', 'below', 'equals'], required: true },
    threshold: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastTriggered: { type: Date },
  },
  { timestamps: true }
);

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema);
