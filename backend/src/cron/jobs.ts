import cron from 'node-cron';
import { logger } from '../utils/logger';
import { Alert } from '../models';
import { getWalletBalance, getTransactions } from '../services/blockchain';
import { emitWebhookEventAsync } from '../services/webhook';
import { sendWhatsAppNotification } from '../services/notification';
import * as walletStore from '../services/storage/inMemoryStore';

// ─── Config ─────────────────────────────────────────────────

const ALERT_CHECK_INTERVAL = '*/5 * * * *'; // Every 5 minutes
const WALLET_POLL_INTERVAL = '*/10 * * * *'; // Every 10 minutes

// Track last seen tx hash per wallet to detect new transactions
const lastTxHashByWallet = new Map<string, string>();

// ─── Public API ─────────────────────────────────────────────

export function startCronJobs(): void {
  // Alert evaluation cron
  cron.schedule(ALERT_CHECK_INTERVAL, async () => {
    logger.info('⏱️ Cron: Evaluating alerts...');
    await evaluateAlerts();
  });

  // Tracked wallet polling cron
  cron.schedule(WALLET_POLL_INTERVAL, async () => {
    logger.info('⏱️ Cron: Polling tracked wallets...');
    await pollTrackedWallets();
  });

  logger.info('✅ Cron jobs started');
  logger.info(`   - Alert checks: every 5 minutes`);
  logger.info(`   - Wallet polling: every 10 minutes`);
}

// ─── Alert Evaluation ───────────────────────────────────────

async function evaluateAlerts(): Promise<void> {
  try {
    const alerts = await Alert.find({ isActive: true });

    if (alerts.length === 0) {
      logger.info('No active alerts to evaluate');
      return;
    }

    logger.info(`Evaluating ${alerts.length} active alerts`);

    for (const alert of alerts) {
      try {
        await evaluateSingleAlert(alert);
      } catch (err) {
        logger.error('Failed to evaluate alert', {
          alertId: alert._id,
          error: (err as Error).message,
        });
      }
    }
  } catch (err) {
    logger.error('Alert evaluation cron failed', { error: (err as Error).message });
  }
}

async function evaluateSingleAlert(alert: any): Promise<void> {
  const { type, condition, threshold, walletId, userId } = alert;

  // For now, support price and balance alerts
  if (type === 'balance' && walletId) {
    const walletAddress = walletId.toString(); // Simplified — in real app, resolve Wallet doc

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
        logger.info('🚨 Alert triggered!', {
          alertId: alert._id,
          type,
          wallet: walletAddress,
          balance,
          threshold: thresholdValue,
          condition,
        });

        // Update last triggered
        alert.lastTriggered = new Date();
        await alert.save();

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
      logger.error('Failed to check balance for alert', {
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

// ─── Tracked Wallet Polling ─────────────────────────────────

async function pollTrackedWallets(): Promise<void> {
  try {
    // Get all users with tracked wallets
    const allUsers = walletStore.listAllUsers();

    if (allUsers.length === 0) {
      logger.info('No tracked wallets to poll');
      return;
    }

    for (const userId of allUsers) {
      const wallets = walletStore.listWallets(userId);
      const userPhone = walletStore.getUserPhone(userId);

      for (const wallet of wallets) {
        try {
          await checkWalletForNewTransactions(wallet, userId, userPhone);
        } catch (err) {
          logger.error('Failed to poll wallet', {
            wallet,
            error: (err as Error).message,
          });
        }
      }
    }
  } catch (err) {
    logger.error('Wallet polling cron failed', { error: (err as Error).message });
  }
}

async function checkWalletForNewTransactions(
  wallet: string,
  userId?: string,
  userPhone?: string
): Promise<void> {
  try {
    const data = await getTransactions(wallet, 1, 1); // Get most recent tx only

    if (data.transactions.length === 0) {
      return;
    }

    const latestTx = data.transactions[0];
    const lastSeen = lastTxHashByWallet.get(wallet);

    if (!lastSeen) {
      // First time seeing this wallet — just record
      lastTxHashByWallet.set(wallet, latestTx.hash);
      logger.info('First poll for wallet', { wallet, txHash: latestTx.hash });
      return;
    }

    if (latestTx.hash !== lastSeen) {
      // New transaction detected!
      logger.info('🆕 New transaction detected!', {
        wallet,
        txHash: latestTx.hash,
        from: latestTx.from,
        to: latestTx.to,
        value: latestTx.value,
      });

      lastTxHashByWallet.set(wallet, latestTx.hash);

      // Determine direction
      const isIncoming = latestTx.to?.toLowerCase() === wallet.toLowerCase();
      const eventType = isIncoming ? 'tx.incoming' : 'tx.outgoing';
      const valueXDC = (parseFloat(latestTx.value) / 1e18).toFixed(6);

      // Emit webhook event
      emitWebhookEventAsync(eventType, {
        walletAddress: wallet,
        txHash: latestTx.hash,
        from: latestTx.from,
        to: latestTx.to,
        value: latestTx.value,
        valueXDC,
        gasUsed: latestTx.gasUsed,
        status: latestTx.status,
        timestamp: latestTx.timestamp,
        blockNumber: latestTx.blockNumber,
        direction: isIncoming ? 'incoming' : 'outgoing',
        message: `New ${isIncoming ? 'incoming' : 'outgoing'} transaction detected for ${wallet}`,
      });

      // Send WhatsApp notification if user has phone
      if (userPhone) {
        const directionEmoji = isIncoming ? '📥' : '📤';
        const message = `${directionEmoji} *New Transaction Detected*\n\n` +
          `*Wallet:* \`${wallet}\`\n` +
          `*Type:* ${isIncoming ? 'Incoming' : 'Outgoing'}\n` +
          `*Amount:* ${valueXDC} XDC\n` +
          `*From:* \`${latestTx.from}\`\n` +
          `*To:* \`${latestTx.to}\`\n` +
          `*Tx Hash:* \`${latestTx.hash}\`\n\n` +
          `_Powered by Smart AI Explorer_`;

        sendWhatsAppNotification(userPhone, message).catch((err) => {
          logger.error('Failed to send WhatsApp transaction notification', { error: err.message });
        });
      }
    }
  } catch (err) {
    logger.error('Failed to check wallet transactions', {
      wallet,
      error: (err as Error).message,
    });
  }
}
