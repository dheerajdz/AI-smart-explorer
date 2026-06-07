import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import {
  getActiveAlerts,
  evaluateAlert,
  sendAlertNotification,
  markAlertTriggered,
  checkAlertCooldown,
  checkMaxTriggers,
} from '../services/alert';

export async function pollAlerts(): Promise<void> {
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
        logger.debug('[alertPoller] Alert in cooldown', { alertId: alert._id });
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

        // Mark as triggered
        await markAlertTriggered(alert._id.toString());
      }
    } catch (err) {
      logger.error('[alertPoller] Failed to evaluate alert', {
        alertId: alert._id,
        error: err,
      });
    }
  }

  logger.info('[alertPoller] Alert evaluation cycle complete');
}
