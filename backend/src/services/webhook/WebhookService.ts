import mongoose from 'mongoose';
import { Webhook, IWebhook, WebhookEventType } from '../../models';
import { logger } from '../../utils/logger';

export interface CreateWebhookInput {
  userId: string;
  url: string;
  events: WebhookEventType[];
}

export interface WebhookLogEntry {
  timestamp: Date;
  event: string;
  status: 'success' | 'failed';
  statusCode?: number;
  error?: string;
  attempt: number;
}

// In-memory delivery logs (last 100 per webhook)
const deliveryLogs = new Map<string, WebhookLogEntry[]>();

export class WebhookService {
  static async create(input: CreateWebhookInput): Promise<IWebhook> {
    const secret = this.generateSecret();
    const webhook = new Webhook({
      userId: new mongoose.Types.ObjectId(input.userId),
      url: input.url,
      secret,
      events: input.events,
      isActive: true,
      failureCount: 0,
    });
    await webhook.save();
    logger.info('[WebhookService] Created webhook', { webhookId: webhook._id, userId: input.userId });
    return webhook;
  }

  static async listByUser(userId: string): Promise<IWebhook[]> {
    return Webhook.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });
  }

  static async findById(id: string): Promise<IWebhook | null> {
    return Webhook.findById(id);
  }

  static async findActiveByEvent(event: WebhookEventType): Promise<IWebhook[]> {
    return Webhook.find({ events: event, isActive: true });
  }

  static async delete(userId: string, webhookId: string): Promise<boolean> {
    const result = await Webhook.deleteOne({
      _id: new mongoose.Types.ObjectId(webhookId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    deliveryLogs.delete(webhookId);
    return result.deletedCount > 0;
  }

  static async markDelivered(webhookId: string): Promise<void> {
    await Webhook.updateOne(
      { _id: new mongoose.Types.ObjectId(webhookId) },
      { $set: { lastDeliveredAt: new Date(), failureCount: 0 } }
    );
  }

  static async markFailed(webhookId: string): Promise<void> {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) return;

    const newFailureCount = webhook.failureCount + 1;
    const isActive = newFailureCount < 5;

    await Webhook.updateOne(
      { _id: new mongoose.Types.ObjectId(webhookId) },
      {
        $set: {
          lastFailureAt: new Date(),
          failureCount: newFailureCount,
          isActive,
        },
      }
    );

    if (!isActive) {
      logger.warn('[WebhookService] Webhook disabled after 5 failures', { webhookId });
    }
  }

  static async resetFailures(webhookId: string): Promise<void> {
    await Webhook.updateOne(
      { _id: new mongoose.Types.ObjectId(webhookId) },
      { $set: { failureCount: 0, isActive: true } }
    );
  }

  static logDelivery(webhookId: string, entry: WebhookLogEntry): void {
    const logs = deliveryLogs.get(webhookId) || [];
    logs.push(entry);
    if (logs.length > 100) logs.shift();
    deliveryLogs.set(webhookId, logs);
  }

  static getLogs(webhookId: string): WebhookLogEntry[] {
    return deliveryLogs.get(webhookId) || [];
  }

  private static generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }
}
