import mongoose, { Schema, Document } from 'mongoose';

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete';
export type SubscriptionPlatform = 'telegram' | 'whatsapp' | 'slack' | 'x';

export interface ISubscription extends Document {
  userId: string;
  platform: SubscriptionPlatform;
  chatId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: String, required: true, index: true },
    platform: { type: String, required: true, enum: ['telegram', 'whatsapp', 'slack', 'x'] },
    chatId: { type: String, required: true },
    tier: { type: String, required: true, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    status: { type: String, required: true, enum: ['active', 'canceled', 'past_due', 'unpaid', 'incomplete'], default: 'active' },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ userId: 1, platform: 1 }, { unique: true });
SubscriptionSchema.index({ stripeSubscriptionId: 1 });
SubscriptionSchema.index({ status: 1, tier: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });

export const SubscriptionModel = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
