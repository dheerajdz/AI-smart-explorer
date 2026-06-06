import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pollWallets } from './walletPoller';

export function startCronJobs(): void {
  cron.schedule('*/2 * * * *', async () => {
    logger.info('⏱️ Cron: wallet poll starting');
    try {
      await pollWallets();
    } catch (err) {
      logger.error('Cron wallet poll error', { error: (err as Error).message });
    }
  });

  logger.info('✅ Cron jobs started (wallet poll every 2 min)');
}
