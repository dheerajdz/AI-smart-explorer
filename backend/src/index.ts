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
import { setBotInstance } from './services/notification/telegramNotify';

async function main(): Promise<void> {
  await connectMongo();

  const app = express();
  app.use(helmet());
  app.use(cors());

  // Twilio webhook requires raw body for signature verification (future use)
  // For now, URL-encoded body is enough for Sandbox
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(requestLogger);
  app.use(routes);
  app.use(errorHandler);

  app.listen(env.PORT, () => {
    logger.info(`🚀 Server running on port ${env.PORT}`);
  });

  const bot = createTelegramBot();
  setBotInstance(bot);

  // Start cron jobs
  startCronJobs();

  // Launch with error handling to prevent crash on 409 conflicts
  bot.launch().catch((err) => {
    logger.error('Telegram bot launch failed', { error: (err as Error).message });
    logger.info('💡 Tip: Another bot instance may be running. Kill all node processes if needed.');
  });
  logger.info('🤖 Telegram bot launched');

  // WhatsApp bot
  createWhatsAppBot();
  logger.info('📱 WhatsApp webhook ready at POST /webhook/whatsapp');

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
