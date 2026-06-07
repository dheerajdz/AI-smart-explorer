import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { WebhookService, WebhookLogEntry } from './WebhookService';
import { IWebhook, WebhookEventType } from '../../models';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  webhookId: string;
  data: Record<string, any>;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deliverWebhook(
  webhook: IWebhook,
  event: WebhookEventType,
  data: Record<string, any>,
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    webhookId: webhook._id.toString(),
    data,
  };

  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, webhook.secret);

  const maxRetries = env.WEBHOOK_MAX_RETRIES;
  const timeout = env.WEBHOOK_TIMEOUT_MS;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      logger.info('[webhookDelivery] Attempting delivery', {
        webhookId: webhook._id,
        url: webhook.url,
        event,
        attempt,
      });

      const response = await axios.post(webhook.url, payload, {
        timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event,
          'X-Webhook-ID': webhook._id.toString(),
          'X-Webhook-Attempt': String(attempt),
        },
        validateStatus: () => true, // Don't throw on 4xx/5xx, we handle it
      });

      if (response.status >= 200 && response.status < 300) {
        logger.info('[webhookDelivery] Delivered successfully', {
          webhookId: webhook._id,
          status: response.status,
          attempt,
        });

        await WebhookService.markDelivered(webhook._id.toString());

        const logEntry: WebhookLogEntry = {
          timestamp: new Date(),
          event,
          status: 'success',
          statusCode: response.status,
          attempt,
        };
        WebhookService.logDelivery(webhook._id.toString(), logEntry);
        return;
      }

      // Non-2xx response
      logger.warn('[webhookDelivery] Non-2xx response', {
        webhookId: webhook._id,
        status: response.status,
        attempt,
      });

      const logEntry: WebhookLogEntry = {
        timestamp: new Date(),
        event,
        status: 'failed',
        statusCode: response.status,
        attempt,
      };
      WebhookService.logDelivery(webhook._id.toString(), logEntry);

    } catch (error: any) {
      logger.error('[webhookDelivery] Delivery failed', {
        webhookId: webhook._id,
        error: error.message,
        attempt,
      });

      const logEntry: WebhookLogEntry = {
        timestamp: new Date(),
        event,
        status: 'failed',
        error: error.message,
        attempt,
      };
      WebhookService.logDelivery(webhook._id.toString(), logEntry);
    }

    // Retry with exponential backoff: 1s, 5s, 25s
    if (attempt <= maxRetries) {
      const backoff = Math.pow(5, attempt - 1) * 1000;
      logger.info('[webhookDelivery] Retrying after backoff', {
        webhookId: webhook._id,
        backoffMs: backoff,
        attempt: attempt + 1,
      });
      await sleep(backoff);
    }
  }

  // All retries exhausted
  logger.error('[webhookDelivery] All retries exhausted', {
    webhookId: webhook._id,
    event,
  });
  await WebhookService.markFailed(webhook._id.toString());
}
