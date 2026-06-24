import { logger } from '../utils/logger';
import { redis } from '../database/redis';
import mongoose from 'mongoose';
import {
  getActiveAlerts,
  evaluateAlert,
  sendAlertNotification,
  markAlertTriggered,
  checkAlertCooldown,
  checkMaxTriggers,
} from '../services/alert';

// ─── Distributed Lock Utilities ──────────────────────────────

const LOCK_PREFIX = 'cron:lock:';
const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function acquireLock(lockKey: string, ttlMs: number = DEFAULT_LOCK_TTL_MS): Promise<boolean> {
  try {
    const acquired = await redis.set(`${LOCK_PREFIX}${lockKey}`, '1', 'PX', ttlMs, 'NX');
    if (acquired === 'OK') {
      logger.info(`[distributedLock] Acquired lock: ${lockKey}`);
      return true;
    }
    logger.debug(`[distributedLock] Lock already held: ${lockKey}`);
    return false;
  } catch (err: any) {
    logger.error(`[distributedLock] Failed to acquire lock: ${lockKey}`, { error: err.message });
    return false;
  }
}

async function releaseLock(lockKey: string): Promise<void> {
  try {
    await redis.del(`${LOCK_PREFIX}${lockKey}`);
    logger.debug(`[distributedLock] Released lock: ${lockKey}`);
  } catch (err: any) {
    logger.error(`[distributedLock] Failed to release lock: ${lockKey}`, { error: err.message });
  }
}

/**
 * Execute a function with distributed lock protection.
 * Prevents multiple server instances from running the same job simultaneously.
 */
export async function withDistributedLock(
  lockKey: string,
  fn: () => Promise<void>,
  ttlMs: number = DEFAULT_LOCK_TTL_MS
): Promise<void> {
  const acquired = await acquireLock(lockKey, ttlMs);
  if (!acquired) {
    logger.info(`[distributedLock] Skipping job - lock held: ${lockKey}`);
    return;
  }

  try {
    await fn();
  } finally {
    await releaseLock(lockKey);
  }
}

// ─── Alert Poller ────────────────────────────────────────────

export async function pollAlerts(): Promise<void> {
  await withDistributedLock('alertPoller', async () => {
    logger.info('[alertPoller] Starting alert evaluation cycle');

    // Ensure MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      logger.warn('[alertPoller] MongoDB not connected, skipping cycle');
      return;
    }

    const alerts = await getActiveAlerts();
    logger.info('[alertPoller] Found active alerts', { count: alerts.length });

    for (const alert of alerts) {
      try {
        // Check cooldown
        const cooledDown = await checkAlertCooldown(alert);
        if (!cooledDown) {
          logger.debug('[alertPoller] Alert in cooldown', { alertId: alert._id, lastTriggered: alert.lastTriggered, cooldownMinutes: alert.cooldownMinutes });
          continue;
        }

        // Check max triggers
        const underLimit = await checkMaxTriggers(alert);
        if (!underLimit) {
          logger.info('[alertPoller] Alert reached max triggers, pausing', { alertId: alert._id });
          // Auto-pause if max triggers reached
          const { pauseAlert } = await import('../services/alert/alertService');
          await pauseAlert(alert._id.toString(), alert.userId);
          continue;
        }

        // Evaluate condition
        const result = await evaluateAlert(alert);

        if (result.triggered) {
          logger.info('[alertPoller] Alert triggered', {
            alertId: alert._id,
            type: alert.type,
            userId: alert.userId,
          });

          // Send notification
          await sendAlertNotification(alert, result.data);
          logger.info('[alertPoller] Notification sent, marking triggered', { alertId: alert._id });

          // Mark as triggered
          await markAlertTriggered(alert._id.toString());
          logger.info('[alertPoller] Alert marked triggered', { alertId: alert._id });
        }
      } catch (err) {
        logger.error('[alertPoller] Failed to evaluate alert', {
          alertId: alert._id,
          error: err,
        });
      }
    }

    logger.info('[alertPoller] Alert evaluation cycle complete');
  });
}
