import { logger } from '../../utils/logger';
import { emitWebhookEventAsync } from '../webhook';
import { WebhookEventType } from '../../models';

export async function sendWebhookNotification(
  event: WebhookEventType,
  payload: Record<string, any>,
): Promise<void> {
  logger.info('Sending webhook notification', { event, payloadKeys: Object.keys(payload) });
  emitWebhookEventAsync(event, payload);
}
