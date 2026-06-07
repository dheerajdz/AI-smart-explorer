import mongoose, { Schema, Document } from 'mongoose';

export type AlertType = 'price_threshold' | 'balance_change' | 'tx_incoming' | 'tx_outgoing' | 'tx_failed' | 'gas_spike' | 'large_transfer';
export type AlertStatus = 'active' | 'paused' | 'triggered' | 'expired';
export type AlertPlatform = 'telegram' | 'whatsapp' | 'slack' | 'x';

export interface IAlert extends Document {
  userId: string;
  platform: AlertPlatform;
  chatId: string;
  type: AlertType;
  name: string;
  condition: {
    operator?: 'above' | 'below' | 'equals';
    value?: number;
    currency?: string;
    address?: string;
    threshold?: number;
    unit?: string;
  };
  status: AlertStatus;
  isActive: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  maxTriggers?: number;
  cooldownMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    userId: { type: String, required: true, index: true },
    platform: { type: String, enum: ['telegram', 'whatsapp', 'slack', 'x'], required: true },
    chatId: { type: String, required: true },
    type: {
      type: String,
      enum: ['price_threshold', 'balance_change', 'tx_incoming', 'tx_outgoing', 'tx_failed', 'gas_spike', 'large_transfer'],
      required: true,
    },
    name: { type: String, required: true },
    condition: {
      operator: { type: String, enum: ['above', 'below', 'equals'] },
      value: { type: Number },
      currency: { type: String },
      address: { type: String },
      threshold: { type: Number },
      unit: { type: String },
    },
    status: { type: String, enum: ['active', 'paused', 'triggered', 'expired'], default: 'active' },
    isActive: { type: Boolean, default: true },
    lastTriggered: { type: Date },
    triggerCount: { type: Number, default: 0 },
    maxTriggers: { type: Number },
    cooldownMinutes: { type: Number, default: 60 },
  },
  { timestamps: true }
);

AlertSchema.index({ userId: 1, status: 1 });
AlertSchema.index({ type: 1, isActive: 1 });

export const AlertModel = mongoose.model<IAlert>('Alert', AlertSchema);
