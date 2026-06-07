import { App, ExpressReceiver } from '@slack/bolt';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { dispatch } from '../shared';

let app: App | null = null;

export function createSlackBot(): App | null {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_SIGNING_SECRET) {
    logger.info('Slack bot not configured — skipping');
    return null;
  }

  const receiver = new ExpressReceiver({
    signingSecret: env.SLACK_SIGNING_SECRET,
    endpoints: '/slack/events',
  });

  app = new App({
    token: env.SLACK_BOT_TOKEN,
    receiver,
  });

  // Handle direct messages
  app.message(async ({ message, say }) => {
    if (message.subtype === 'bot_message') return;
    if (!('text' in message)) return;

    const userId = message.user;
    const text = message.text || '';

    logger.info('[slack] Received message', { userId, text });

    try {
      const response = await dispatch('slack', userId, text);
      await say(response.text);
    } catch (err) {
      logger.error('[slack] dispatch failed', { error: err });
      await say('Sorry, something went wrong. Please try again.');
    }
  });

  // Handle app mentions (@botname)
  app.event('app_mention', async ({ event, say }) => {
    const userId = event.user;
    const text = event.text.replace(/<@\w+>/g, '').trim();

    logger.info('[slack] App mention', { userId, text });

    try {
      const response = await dispatch('slack', userId, text);
      await say(response.text);
    } catch (err) {
      logger.error('[slack] mention dispatch failed', { error: err });
      await say('Sorry, something went wrong. Please try again.');
    }
  });

  logger.info('🤖 Slack bot initialized');
  return app;
}

export function getSlackReceiver() {
  return app?.receiver;
}
