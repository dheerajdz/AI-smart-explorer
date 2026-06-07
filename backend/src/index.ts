import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { createTelegramBot, createWhatsAppBot } from './bots';
import { createSlackBot, handleSlackEvent } from './bots/slack';
import { createXBot, getXWebhookRouter } from './bots/x';
import { connectMongo, redis } from './database';
import { startCronJobs } from './cron/jobs';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';
import { logger } from './utils/logger';
import { setBotInstance } from './services/notification/telegramNotify';

function verifySlackSignature(rawBody: Buffer, req: Request): boolean {
  if (!env.SLACK_SIGNING_SECRET) {
    return false;
  }

  const timestamp = req.header('x-slack-request-timestamp');
  const signature = req.header('x-slack-signature');
  if (!timestamp || !signature) {
    return false;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowInSeconds - Number(timestamp)) > 60 * 5) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody.toString('utf8')}`;
  const expectedSignature = `v0=${crypto
    .createHmac('sha256', env.SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest('hex')}`;

  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

async function main(): Promise<void> {
  await connectMongo();

  const app = express();
  app.use(helmet());
  app.use(cors());

  // Twilio webhook requires raw body for signature verification (future use)
  // For now, URL-encoded body is enough for Sandbox
  app.use(express.urlencoded({ extended: false }));

  // ── Slack events ────────────────────────────────────────────
  // Bolt's ExpressReceiver requires signature headers on ALL requests,
  // but Slack's URL verification doesn't send them. We handle URL
  // verification manually, then forward events to Bolt's receiver.
  const slackApp = createSlackBot();
  if (slackApp) {
    app.post('/slack/events', express.raw({ type: '*/*' }), (req: Request, res: Response) => {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

      let payload: any;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (err) {
        logger.error('[slack] invalid JSON payload', { error: err });
        return res.status(400).send('Invalid JSON');
      }

      if (payload?.type === 'url_verification' && payload.challenge) {
        logger.info('[slack] URL verification challenge received');
        return res.type('text/plain').send(payload.challenge);
      }

      if (!verifySlackSignature(rawBody, req)) {
        logger.warn('[slack] rejected request with invalid signature');
        return res.status(401).send('Unauthorized');
      }

      res.status(200).send();
      void handleSlackEvent(payload);
    });
  }

  app.use(express.json());
  app.use(requestLogger);

  // X webhook router
  app.use(getXWebhookRouter());

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

  // X bot
  await createXBot();
  logger.info('🐦 X webhook ready at POST /webhook/x');

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
