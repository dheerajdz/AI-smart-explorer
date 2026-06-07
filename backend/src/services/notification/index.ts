export { sendTelegramNotification, setBotInstance } from './telegramNotify';
export { sendWhatsAppNotification } from './whatsappNotify';
export { dispatchAlert } from './alertDispatcher';
export { sendWebhookNotification } from './webhookNotify';

// Notification aggregator for sending alerts across channels
import { sendWhatsAppNotification } from './whatsappNotify';
import { sendTelegramNotification } from './telegramNotify';
import { sendWebhookNotification } from './webhookNotify';
import { WebhookEventType } from '../../models';
import { logger } from '../../utils/logger';

export interface NotificationPayload {
  event: WebhookEventType;
  userPhone?: string;
  userTelegramId?: number;
  message: string;
  data?: Record<string, any>;
}

/**
 * Send notification across all configured channels
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const { event, userPhone, userTelegramId, message, data } = payload;

  logger.info('Sending notification', { event, hasPhone: !!userPhone, hasTelegram: !!userTelegramId });

  const promises: Promise<void>[] = [];

  // WhatsApp notification
  if (userPhone) {
    promises.push(
      sendWhatsAppNotification(userPhone, message).catch((err) => {
        logger.error('WhatsApp notification failed', { error: err.message });
      })
    );
  }

  // Telegram notification
  if (userTelegramId) {
    promises.push(
      sendTelegramNotification(userTelegramId, message).catch((err) => {
        logger.error('Telegram notification failed', { error: err.message });
      })
    );
  }

  // Webhook notification (always send if data provided)
  if (data) {
    promises.push(
      sendWebhookNotification(event, data).catch((err) => {
        logger.error('Webhook notification failed', { error: err.message });
      })
    );
  }

  await Promise.allSettled(promises);
}
