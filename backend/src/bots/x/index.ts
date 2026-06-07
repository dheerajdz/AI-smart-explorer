import { Router, Request, Response } from 'express';
import { TwitterApi } from 'twitter-api-v2';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { dispatch } from '../shared';

let client: TwitterApi | null = null;
let meId: string | null = null;

export async function createXBot(): Promise<void> {
  if (!env.X_API_KEY || !env.X_API_SECRET || !env.X_ACCESS_TOKEN || !env.X_ACCESS_SECRET) {
    logger.info('X bot not configured — skipping');
    return;
  }

  client = new TwitterApi({
    appKey: env.X_API_KEY,
    appSecret: env.X_API_SECRET,
    accessToken: env.X_ACCESS_TOKEN,
    accessSecret: env.X_ACCESS_SECRET,
  });

  try {
    const user = await client.v2.me();
    meId = user.data.id;
    logger.info('🐦 X bot initialized', { handle: user.data.username, id: meId });
  } catch (err) {
    logger.error('X bot initialization failed', { error: err });
    return;
  }
}

export function getXWebhookRouter(): Router {
  const router = Router();

  router.post('/webhook/x', async (req: Request, res: Response) => {
    const { direct_message_events, users } = req.body;

    if (!direct_message_events || !Array.isArray(direct_message_events)) {
      res.sendStatus(200);
      return;
    }

    for (const event of direct_message_events) {
      if (event.type !== 'message_create') continue;

      const senderId = event.message_create.sender_id;
      const text = event.message_create.message_data.text;

      // Ignore our own messages
      if (senderId === meId) continue;

      logger.info('[x] Received DM', { senderId, text });

      try {
        const response = await dispatch('x', senderId, text);
        await sendDM(senderId, response.text);
      } catch (err) {
        logger.error('[x] dispatch failed', { error: err });
      }
    }

    res.sendStatus(200);
  });

  // CRC challenge for webhook verification
  router.get('/webhook/x', (req: Request, res: Response) => {
    const crcToken = req.query.crc_token as string;
    if (!crcToken) {
      res.sendStatus(400);
      return;
    }

    // X requires HMAC-SHA256 response
    const crypto = require('crypto');
    const hmac = crypto
      .createHmac('sha256', env.X_API_SECRET || '')
      .update(crcToken)
      .digest('base64');

    res.json({ response_token: `sha256=${hmac}` });
  });

  return router;
}

async function sendDM(userId: string, text: string): Promise<void> {
  if (!client) return;
  try {
    await client.v1.sendDm({
      recipient_id: userId,
      text,
    });
  } catch (err) {
    logger.error('[x] Failed to send DM', { error: err });
  }
}

export function getXClient(): TwitterApi | null {
  return client;
}
