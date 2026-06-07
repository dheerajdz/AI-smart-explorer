import { logger } from '../../utils/logger';
import { WebhookService } from './WebhookService';
import { deliverWebhook } from './webhookDelivery';
import { WebhookEventType, VALID_WEBHOOK_EVENTS } from '../../models';
import { sendWhatsAppNotification } from '../notification';
import * as walletStore from '../storage/inMemoryStore';

/**
 * Emit a webhook event to all subscribed webhooks.
 * Fires-and-forgets: does not block the caller.
 */
export async function emitWebhookEvent(
  event: WebhookEventType,
  data: Record<string, any>,
): Promise<void> {
  if (!VALID_WEBHOOK_EVENTS.includes(event)) {
    logger.warn('[webhookEvents] Invalid event type', { event });
    return;
  }

  try {
    const webhooks = await WebhookService.findActiveByEvent(event);

    if (webhooks.length === 0) {
      return;
    }

    logger.info('[webhookEvents] Emitting event', {
      event,
      webhookCount: webhooks.length,
    });

    // Deliver to all subscribed webhooks in parallel
    await Promise.allSettled(
      webhooks.map((webhook) => deliverWebhook(webhook, event, data)),
    );

    // Send WhatsApp notifications for tracked wallets if phone available
    if (data.walletAddress) {
      const allUsers = walletStore.listAllUsers();
      for (const userId of allUsers) {
        const wallets = walletStore.listWallets(userId);
        const userPhone = walletStore.getUserPhone(userId);

        if (userPhone && wallets.includes(data.walletAddress.toLowerCase())) {
          const message = formatWhatsAppAlert(event, data);
          if (message) {
            sendWhatsAppNotification(userPhone, message).catch((err) => {
              logger.error('Failed to send WhatsApp webhook alert', { error: err.message });
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error('[webhookEvents] Failed to emit event', {
      event,
      error: (err as Error).message,
    });
  }
}

/**
 * Synchronous emit — schedules delivery without awaiting.
 * Use this when you don't want to block the response to the user.
 */
export function emitWebhookEventAsync(
  event: WebhookEventType,
  data: Record<string, any>,
): void {
  // Fire and forget
  emitWebhookEvent(event, data).catch((err) => {
    logger.error('[webhookEvents] Async emit failed', {
      event,
      error: (err as Error).message,
    });
  });
}

// Helper to format WhatsApp messages for webhook events
function formatWhatsAppAlert(event: WebhookEventType, data: Record<string, any>): string | null {
  switch (event) {
    case 'wallet.tracked':
      return `📊 *Wallet Activity Update*\n\n` +
        `*Wallet:* \`${data.walletAddress}\`\n` +
        `*Balance:* ${data.balanceXDC} XDC\n\n` +
        `_Powered by Smart AI Explorer_`;

    case 'tx.incoming':
      return `📥 *Incoming Transaction*\n\n` +
        `*Wallet:* \`${data.walletAddress}\`\n` +
        `*Amount:* ${data.valueXDC} XDC\n` +
        `*From:* \`${data.from}\`\n` +
        `*Tx Hash:* \`${data.txHash}\`\n\n` +
        `_Powered by Smart AI Explorer_`;

    case 'tx.outgoing':
      return `📤 *Outgoing Transaction*\n\n` +
        `*Wallet:* \`${data.walletAddress}\`\n` +
        `*Amount:* ${data.valueXDC} XDC\n` +
        `*To:* \`${data.to}\`\n` +
        `*Tx Hash:* \`${data.txHash}\`\n\n` +
        `_Powered by Smart AI Explorer_`;

    case 'alert.triggered':
      return `🚨 *Alert Triggered*\n\n` +
        `*Type:* ${data.type}\n` +
        `*Wallet:* \`${data.walletAddress}\`\n` +
        `*Condition:* ${data.condition} ${data.threshold} XDC\n` +
        `*Current Value:* ${data.currentValue} XDC\n\n` +
        `_Powered by Smart AI Explorer_`;

    case 'large.transfer':
      return `🐋 *Large Transfer Detected*\n\n` +
        `*Wallet:* \`${data.walletAddress}\`\n` +
        `*Amount:* ${data.valueXDC} XDC\n` +
        `*Tx Hash:* \`${data.txHash}\`\n\n` +
        `_Powered by Smart AI Explorer_`;

    case 'price.change':
      return `📈 *Price Alert*\n\n` +
        `*Current Price:* ${data.currentPrice} USD\n` +
        `*Change:* ${data.changePercent}%\n\n` +
        `_Powered by Smart AI Explorer_`;

    default:
      return null;
  }
}
