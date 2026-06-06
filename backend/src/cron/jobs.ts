import cron from 'node-cron';
import { logger } from '../utils/logger';

export function startCronJobs(): void {
  // Example: run every minute for placeholder
  cron.schedule('* * * * *', () => {
    logger.info('⏱️ Cron tick: placeholder job running');
  });

  logger.info('✅ Cron jobs started');
}
