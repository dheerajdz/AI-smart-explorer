import { Router, Request, Response } from 'express';
import { WebhookService, emitWebhookEvent } from '../services/webhook';
import { logger } from '../utils/logger';

const router = Router();

function getUserId(req: Request): string | undefined {
  return (req as Request & { user?: { id: string } }).user?.id
    ?? (req.body?.userId as string | undefined)
    ?? (req.query.userId as string | undefined);
}

// POST /webhooks — create webhook
router.post('/', async (req: Request, res: Response) => {
  try {
    const { url, events } = req.body;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'url and events[] are required' });
    }

    // Validate URL is HTTPS
    if (!url.startsWith('https://')) {
      return res.status(400).json({ error: 'URL must use HTTPS' });
    }

    const webhook = await WebhookService.create({ userId, url, events });

    res.status(201).json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
    });
  } catch (err) {
    logger.error('[webhooks] POST / failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// GET /webhooks — list my webhooks
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const webhooks = await WebhookService.listByUser(userId);

    res.json(
      webhooks.map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        isActive: w.isActive,
        failureCount: w.failureCount,
        lastDeliveredAt: w.lastDeliveredAt,
        lastFailureAt: w.lastFailureAt,
        createdAt: w.createdAt,
      })),
    );
  } catch (err) {
    logger.error('[webhooks] GET / failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

// DELETE /webhooks/:id — delete webhook
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deleted = await WebhookService.delete(userId, id);

    if (!deleted) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    logger.error('[webhooks] DELETE /:id failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// POST /webhooks/:id/test — send test event
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const webhook = await WebhookService.findById(id);

    if (!webhook || webhook.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await emitWebhookEvent('wallet.tracked', {
      message: 'This is a test event from Smart AI Explorer',
      walletAddress: 'xdc0000000000000000000000000000000000000000',
      test: true,
    });

    res.json({ success: true, message: 'Test event sent' });
  } catch (err) {
    logger.error('[webhooks] POST /:id/test failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to send test event' });
  }
});

// GET /webhooks/:id/logs — delivery history
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const webhook = await WebhookService.findById(id);

    if (!webhook || webhook.userId.toString() !== userId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const logs = WebhookService.getLogs(id);

    res.json({ logs });
  } catch (err) {
    logger.error('[webhooks] GET /:id/logs failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

export default router;
