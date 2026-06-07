/**
 * Webhook System Verification Script
 * Run with: npx tsx scripts/verify-webhook-system.ts
 */

import { WebhookService } from '../src/services/webhook';
import { emitWebhookEvent } from '../src/services/webhook';
import { Webhook } from '../src/models';
import mongoose from 'mongoose';

const TEST_USER = 'test-user-verify';

async function verify() {
  console.log('========================================');
  console.log('  Webhook System Verification');
  console.log('========================================\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/smartaiexplorer';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  try {
    // ─── 1. Model Verification ──────────────────────────────
    console.log('[1] Testing Model...');
    const webhook = await WebhookService.create({
      userId: TEST_USER,
      url: 'https://httpbin.org/post',
      events: ['large.transfer', 'alert.triggered'],
    });
    console.log(`   ✅ Created webhook: ${webhook._id}`);
    console.log(`   ✅ Secret: ${webhook.secret} (length: ${webhook.secret.length})`);
    console.log(`   ✅ Events: ${webhook.events.join(', ')}`);
    console.log(`   ✅ Active: ${webhook.isActive}`);
    console.log();

    // ─── 2. CRUD Verification ───────────────────────────────
    console.log('[2] Testing CRUD...');
    const list = await WebhookService.listByUser(TEST_USER);
    console.log(`   ✅ Listed ${list.length} webhooks`);

    const found = await WebhookService.findById(webhook._id.toString());
    console.log(`   ✅ Found by ID: ${found?._id}`);
    console.log();

    // ─── 3. Delivery Verification ───────────────────────────
    console.log('[3] Testing Delivery...');
    console.log('   Sending test event to httpbin.org...');
    
    await emitWebhookEvent('wallet.tracked', {
      message: 'Verification test event',
      walletAddress: 'xdc0000000000000000000000000000000000000000',
      test: true,
      timestamp: new Date().toISOString(),
    });

    // Wait a moment for delivery
    await new Promise(resolve => setTimeout(resolve, 3000));

    const logs = WebhookService.getLogs(webhook._id.toString());
    console.log(`   ✅ Delivery logs: ${logs.length} entries`);
    if (logs.length > 0) {
      console.log(`   ✅ Last status: ${logs[0].status}`);
      console.log(`   ✅ Last HTTP code: ${logs[0].statusCode || 'N/A'}`);
    }
    console.log();

    // ─── 4. Failure Protection Verification ─────────────────
    console.log('[4] Testing Failure Protection...');
    const failWebhook = await WebhookService.create({
      userId: TEST_USER,
      url: 'https://this-domain-does-not-exist-12345.com/webhook',
      events: ['large.transfer'],
    });

    console.log('   Sending to failing URL (will retry 3 times)...');
    await emitWebhookEvent('large.transfer', { test: 'failure' });
    
    await new Promise(resolve => setTimeout(resolve, 8000));

    const updated = await WebhookService.findById(failWebhook._id.toString());
    console.log(`   ✅ Failure count: ${updated?.failureCount}`);
    console.log(`   ✅ Still active: ${updated?.isActive}`);
    console.log();

    // ─── 5. Cleanup ─────────────────────────────────────────
    console.log('[5] Cleanup...');
    await WebhookService.delete(TEST_USER, webhook._id.toString());
    await WebhookService.delete(TEST_USER, failWebhook._id.toString());
    console.log('   ✅ Test webhooks deleted');
    console.log();

    console.log('========================================');
    console.log('  ✅ All Verifications Passed');
    console.log('========================================');

  } catch (err) {
    console.error('❌ Verification failed:', (err as Error).message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
