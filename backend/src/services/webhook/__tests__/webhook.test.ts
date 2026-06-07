import { WebhookService } from '../WebhookService';
import { deliverWebhook } from '../webhookDelivery';
import { emitWebhookEvent, emitWebhookEventAsync } from '../webhookEvents';
import { Webhook, IWebhook } from '../../../models';
import mongoose from 'mongoose';

// Mock axios
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Webhook System', () => {
  beforeAll(async () => {
    // Connect to test DB if needed
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Phase 1-2: Types & Model ───────────────────────────────
  describe('Phase 1-2: Model & Types', () => {
    it('should create a webhook with all required fields', async () => {
      const webhook = await WebhookService.create({
        userId: '507f1f77bcf86cd799439011',
        url: 'https://example.com/webhook',
        events: ['large.transfer', 'alert.triggered'],
      });

      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.events).toContain('large.transfer');
      expect(webhook.secret).toHaveLength(32);
      expect(webhook.isActive).toBe(true);
      expect(webhook.failureCount).toBe(0);
    });

    it('should reject invalid event types', async () => {
      // Mongoose enum validation handles this
      const invalidWebhook = new Webhook({
        userId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/webhook',
        events: ['invalid.event'],
        secret: 'test',
      });

      await expect(invalidWebhook.save()).rejects.toThrow();
    });
  });

  // ─── Phase 3: CRUD Service ──────────────────────────────────
  describe('Phase 3: CRUD Service', () => {
    it('should list webhooks by user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      
      // Create test webhooks
      await WebhookService.create({
        userId,
        url: 'https://a.com/webhook',
        events: ['large.transfer'],
      });
      await WebhookService.create({
        userId,
        url: 'https://b.com/webhook',
        events: ['alert.triggered'],
      });

      const webhooks = await WebhookService.listByUser(userId);
      expect(webhooks.length).toBe(2);
    });

    it('should delete a webhook', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const webhook = await WebhookService.create({
        userId,
        url: 'https://delete-me.com/webhook',
        events: ['large.transfer'],
      });

      const deleted = await WebhookService.delete(userId, webhook._id.toString());
      expect(deleted).toBe(true);

      const found = await WebhookService.findById(webhook._id.toString());
      expect(found).toBeNull();
    });
  });

  // ─── Phase 5-6: Delivery Engine & Retry ─────────────────────
  describe('Phase 5-6: Delivery & Retry', () => {
    it('should deliver webhook successfully on 200', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200 });

      const webhook = await WebhookService.create({
        userId: '507f1f77bcf86cd799439011',
        url: 'https://success.com/webhook',
        events: ['large.transfer'],
      });

      await deliverWebhook(webhook, 'large.transfer', { test: true });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://success.com/webhook',
        expect.objectContaining({
          event: 'large.transfer',
          data: { test: true },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expect.stringMatching(/^sha256=/),
            'X-Webhook-Event': 'large.transfer',
          }),
        })
      );
    });

    it('should retry on failure and disable after 5 failures', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Connection refused'));

      const webhook = await WebhookService.create({
        userId: '507f1f77bcf86cd799439011',
        url: 'https://fail.com/webhook',
        events: ['large.transfer'],
      });

      // Simulate 5 deliveries (all fail)
      for (let i = 0; i < 5; i++) {
        await deliverWebhook(webhook, 'large.transfer', { attempt: i });
        // Reload webhook to get updated failureCount
        Object.assign(webhook, await WebhookService.findById(webhook._id.toString()));
      }

      const finalWebhook = await WebhookService.findById(webhook._id.toString());
      expect(finalWebhook?.isActive).toBe(false);
      expect(finalWebhook?.failureCount).toBe(5);
    }, 30000);

    it('should reset failure count on successful delivery', async () => {
      // First fail
      mockedAxios.post.mockRejectedValueOnce(new Error('Fail'));
      
      const webhook = await WebhookService.create({
        userId: '507f1f77bcf86cd799439011',
        url: 'https://recover.com/webhook',
        events: ['large.transfer'],
      });

      await deliverWebhook(webhook, 'large.transfer', {});
      
      let updated = await WebhookService.findById(webhook._id.toString());
      expect(updated?.failureCount).toBe(1);

      // Then succeed
      mockedAxios.post.mockResolvedValueOnce({ status: 200 });
      Object.assign(webhook, updated);
      await deliverWebhook(webhook, 'large.transfer', {});

      updated = await WebhookService.findById(webhook._id.toString());
      expect(updated?.failureCount).toBe(0);
      expect(updated?.isActive).toBe(true);
    });
  });

  // ─── Phase 7: Delivery Logging ──────────────────────────────
  describe('Phase 7: Delivery Logging', () => {
    it('should log delivery attempts', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200 });

      const webhook = await WebhookService.create({
        userId: '507f1f77bcf86cd799439011',
        url: 'https://log.com/webhook',
        events: ['large.transfer'],
      });

      await deliverWebhook(webhook, 'large.transfer', { test: 'data' });

      const logs = WebhookService.getLogs(webhook._id.toString());
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].status).toBe('success');
      expect(logs[0].event).toBe('large.transfer');
    });
  });

  // ─── Phase 8: Event Emitter ─────────────────────────────────
  describe('Phase 8: Event Emitter', () => {
    it('should emit events to multiple webhooks', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const userId = '507f1f77bcf86cd799439011';
      
      await WebhookService.create({
        userId,
        url: 'https://multi1.com/webhook',
        events: ['wallet.tracked'],
      });
      await WebhookService.create({
        userId,
        url: 'https://multi2.com/webhook',
        events: ['wallet.tracked'],
      });

      await emitWebhookEvent('wallet.tracked', { address: 'xdc123' });

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should not block on async emit', (done) => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      WebhookService.create({
        userId: '507f1f77bcf86cd799439011',
        url: 'https://async.com/webhook',
        events: ['wallet.tracked'],
      }).then(() => {
        emitWebhookEventAsync('wallet.tracked', { test: true });
        
        // Should return immediately without blocking
        setTimeout(() => {
          expect(mockedAxios.post).toHaveBeenCalled();
          done();
        }, 100);
      });
    });
  });

  // ─── Phase 13: Failure Protection ───────────────────────────
  describe('Phase 13: Failure Protection', () => {
    it('should disable webhook after 5 consecutive failures', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Always fails'));

      const webhook = await WebhookService.create({
        userId: '507f1f77bcf86cd799439011',
        url: 'https://disable.com/webhook',
        events: ['large.transfer'],
      });

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        await deliverWebhook(webhook, 'large.transfer', { count: i });
        const updated = await WebhookService.findById(webhook._id.toString());
        Object.assign(webhook, updated);
      }

      const final = await WebhookService.findById(webhook._id.toString());
      expect(final?.isActive).toBe(false);
    }, 30000);
  });
});
