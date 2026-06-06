import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { createTelegramBot, createWhatsAppBot } from './bots';
import { connectMongo, redis } from './database';
import { startCronJobs } from './cron/jobs';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  await connectMongo();

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  app.use(routes);
  app.use(errorHandler);

  app.listen(env.PORT, () => {
    logger.info(`🚀 Server running on port ${env.PORT}`);
  });

  const bot = createTelegramBot();
  bot.launch();
  logger.info('🤖 Telegram bot launched');

  createWhatsAppBot();
  logger.info('📱 WhatsApp bot placeholder initialized');

  startCronJobs();

  process.once('SIGINT', () => {
    bot.stop('SIGINT');
    redis.disconnect();
  });
  process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    redis.disconnect();
  });
}

main().catch((err) => {
  logger.error('Fatal error during startup', err);
  process.exit(1);
});
