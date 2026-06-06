import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pollWallets } from './walletPoller';

export function startCronJobs(): void {
  cron.schedule('*/2 * * * *', async () => {
    try {
      await pollWallets();
    } catch (err) {
      logger.error('[cron] Wallet poll failed', { error: err });
    }
  });

  logger.info('[cron] Wallet polling scheduled every 2 minutes');
}
