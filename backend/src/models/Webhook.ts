import mongoose, { Schema, Document } from 'mongoose';

export type WebhookEventType =
  | 'alert.triggered'
  | 'tx.incoming'
  | 'tx.outgoing'
  | 'price.change'
  | 'large.transfer'
  | 'wallet.tracked';

export const VALID_WEBHOOK_EVENTS: WebhookEventType[] = [
  'alert.triggered',
  'tx.incoming',
  'tx.outgoing',
  'price.change',
  'large.transfer',
  'wallet.tracked',
];

export interface IWebhook extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  failureCount: number;
  lastDeliveredAt?: Date;
  lastFailureAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSchema = new Schema<IWebhook>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url: { type: String, required: true },
    secret: { type: String, required: true },
    events: [{ type: String, enum: VALID_WEBHOOK_EVENTS, required: true }],
    isActive: { type: Boolean, default: true },
    failureCount: { type: Number, default: 0 },
    lastDeliveredAt: { type: Date },
    lastFailureAt: { type: Date },
  },
  { timestamps: true }
);

WebhookSchema.index({ userId: 1, isActive: 1 });
WebhookSchema.index({ events: 1, isActive: 1 });

export const Webhook = mongoose.model<IWebhook>('Webhook', WebhookSchema);
