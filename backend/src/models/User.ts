import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  telegramUsername?: string;
  walletAddress: string;
  plan: 'free' | 'premium';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    telegramUsername: { type: String },
    walletAddress: { type: String, required: true, unique: true, index: true },
    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
