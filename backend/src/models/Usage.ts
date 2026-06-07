import mongoose, { Schema, Document } from 'mongoose';

export interface IUsage extends Document {
  userId: string;
  platform: string;
  month: string; // "2026-06"
  alertsCreated: number;
  alertsTriggered: number;
  portfolioWallets: number;
  webhookCalls: number;
  queries: number;
  createdAt: Date;
  updatedAt: Date;
}

const UsageSchema = new Schema<IUsage>(
  {
    userId: { type: String, required: true, index: true },
    platform: { type: String, required: true },
    month: { type: String, required: true },
    alertsCreated: { type: Number, default: 0 },
    alertsTriggered: { type: Number, default: 0 },
    portfolioWallets: { type: Number, default: 0 },
    webhookCalls: { type: Number, default: 0 },
    queries: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UsageSchema.index({ userId: 1, platform: 1, month: 1 }, { unique: true });

export const UsageModel = mongoose.model<IUsage>('Usage', UsageSchema);
