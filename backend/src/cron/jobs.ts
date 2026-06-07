import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pollWallets } from './walletPoller';
import { pollAlerts } from './alertPoller';

export function startCronJobs(): void {
  cron.schedule('*/2 * * * *', async () => {
    try {
      await pollWallets();
    } catch (err) {
      logger.error('[cron] Wallet poll failed', { error: err });
    }
  });

  logger.info('[cron] Wallet polling scheduled every 2 minutes');

  cron.schedule('* * * * *', async () => {
    try {
      await pollAlerts();
    } catch (err) {
      logger.error('[cron] Alert poll failed', { error: err, message: (err as Error).message, stack: (err as Error).stack });
    }
  });

  logger.info('[cron] Alert polling scheduled every minute');
}
