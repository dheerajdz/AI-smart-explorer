import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pollWallets } from './walletPoller';
import { AlertModel } from '../models/Alert';
import { getWalletBalance, getTransactions } from '../services/blockchain';
import { emitWebhookEventAsync } from '../services/webhook';
import { sendWhatsAppNotification } from '../services/notification';
import * as walletStore from '../services/storage/inMemoryStore';

// ─── Config ─────────────────────────────────────────────────

const ALERT_CHECK_INTERVAL = '*/5 * * * *'; // Every 5 minutes
const WALLET_POLL_INTERVAL = '*/2 * * * *'; // Every 2 minutes (our enhanced poller)

// Track last seen tx hash per wallet to detect new transactions
const lastTxHashByWallet = new Map<string, string>();

// ─── Public API ─────────────────────────────────────────────

export function startCronJobs(): void {
  // Wallet polling cron (our enhanced poller with MongoDB persistence)
  cron.schedule(WALLET_POLL_INTERVAL, async () => {
    try {
      await pollWallets();
    } catch (err) {
      logger.error('[cron] Wallet poll failed', { error: err });
    }
  });

  // Legacy alert evaluation cron (for webhook-system alerts)
  cron.schedule(ALERT_CHECK_INTERVAL, async () => {
    logger.info('⏱️ Cron: Evaluating legacy alerts...');
    await evaluateLegacyAlerts();
  });

  logger.info('[cron] Jobs started');
  logger.info(`   - Wallet polling (enhanced): every 2 minutes`);
  logger.info(`   - Legacy alert checks: every 5 minutes`);
}

// ─── Legacy Alert Evaluation (from webhook-system branch) ────

async function evaluateLegacyAlerts(): Promise<void> {
  try {
    const alerts = await AlertModel.getCollection().find({ isActive: true }).toArray();

    if (alerts.length === 0) {
      logger.info('No active legacy alerts to evaluate');
      return;
    }

    logger.info(`Evaluating ${alerts.length} active legacy alerts`);

    for (const alert of alerts) {
      try {
        await evaluateSingleLegacyAlert(alert);
      } catch (err) {
        logger.error('Failed to evaluate legacy alert', {
          alertId: alert._id,
          error: (err as Error).message,
        });
      }
    }
  } catch (err) {
    logger.error('Legacy alert evaluation cron failed', { error: (err as Error).message });
  }
}

async function evaluateSingleLegacyAlert(alert: any): Promise<void> {
  const { type, condition, threshold, walletId, userId } = alert;

  // For now, support price and balance alerts
  if (type === 'balance' && walletId) {
    const walletAddress = walletId.toString();

    try {
      const data = await getWalletBalance(walletAddress);
      const balance = parseFloat(data.balanceXDC);
      const thresholdValue = parseFloat(threshold);

      let triggered = false;

      if (condition === 'above' && balance > thresholdValue) {
        triggered = true;
      } else if (condition === 'below' && balance < thresholdValue) {
        triggered = true;
      } else if (condition === 'equals' && Math.abs(balance - thresholdValue) < 0.0001) {
        triggered = true;
      }

      if (triggered) {
        logger.info('🚨 Legacy alert triggered!', {
          alertId: alert._id,
          type,
          wallet: walletAddress,
          balance,
          threshold: thresholdValue,
          condition,
        });

        // Update last triggered
        await AlertModel.updateLastTriggered(alert._id.toString());

        // Emit webhook event
        emitWebhookEventAsync('alert.triggered', {
          alertId: alert._id.toString(),
          type: 'balance',
          walletAddress,
          condition,
          threshold: thresholdValue,
          currentValue: balance,
          message: `Balance alert triggered: ${balance} XDC is ${condition} ${thresholdValue} XDC`,
        });

        // Send WhatsApp notification if user has phone
        const userPhone = walletStore.getUserPhone(userId?.toString() || '');
        if (userPhone) {
          const message = `🚨 *Smart AI Explorer Alert*\n\n` +
            `*Type:* Balance Alert\n` +
            `*Wallet:* \`${walletAddress}\`\n` +
            `*Condition:* ${condition} ${thresholdValue} XDC\n` +
            `*Current Balance:* ${balance} XDC\n\n` +
            `Your alert has been triggered!`;

          sendWhatsAppNotification(userPhone, message).catch((err) => {
            logger.error('Failed to send WhatsApp alert notification', { error: err.message });
          });
        }
      }
    } catch (err) {
      logger.error('Failed to check balance for legacy alert', {
        alertId: alert._id,
        wallet: walletAddress,
        error: (err as Error).message,
      });
    }
  }

  // Price alerts (placeholder — would need price API)
  if (type === 'price') {
    logger.info('Price alert evaluation — price API integration needed', {
      alertId: alert._id,
    });
  }
}
