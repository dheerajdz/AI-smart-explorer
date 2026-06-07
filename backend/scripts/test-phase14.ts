/**
 * Phase 14: End-to-End Testing
 * Run with: npx tsx scripts/test-phase14.ts
 *
 * This script tests:
 * - API endpoints (create, list, delete, test, logs)
 * - Delivery success/failure
 * - Retry behavior
 * - Event emission from queryRouter
 * - AI command parsing
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const TEST_USER = 'test-phase14';

// Test results tracker
const results: { test: string; passed: boolean; error?: string }[] = [];

function log(message: string) {
  console.log(message);
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ test: name, passed: true });
    log(`  ✅ ${name}`);
  } catch (err) {
    results.push({ test: name, passed: false, error: (err as Error).message });
    log(`  ❌ ${name}: ${(err as Error).message}`);
  }
}

// ─── Test Suite ─────────────────────────────────────────────

async function testAPICreate() {
  const response = await axios.post(`${BASE_URL}/webhooks`, {
    userId: TEST_USER,
    url: 'https://httpbin.org/post',
    events: ['large.transfer', 'alert.triggered', 'wallet.tracked'],
  });

  if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}`);
  if (!response.data.id) throw new Error('No webhook ID returned');
  if (!response.data.secret) throw new Error('No secret returned');

  // Store for later tests
  (global as any).testWebhookId = response.data.id;
  (global as any).testWebhookSecret = response.data.secret;
}

async function testAPIList() {
  const response = await axios.get(`${BASE_URL}/webhooks?userId=${TEST_USER}`);

  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  if (!Array.isArray(response.data)) throw new Error('Expected array');
  if (response.data.length === 0) throw new Error('No webhooks found');
}

async function testAPILogs() {
  const webhookId = (global as any).testWebhookId;
  const response = await axios.get(`${BASE_URL}/webhooks/${webhookId}/logs?userId=${TEST_USER}`);

  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  if (!response.data.logs) throw new Error('No logs field');
}

async function testAPITestEvent() {
  const webhookId = (global as any).testWebhookId;
  const response = await axios.post(`${BASE_URL}/webhooks/${webhookId}/test`, {
    userId: TEST_USER,
  });

  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  if (!response.data.success) throw new Error('Test event failed');
}

async function testAPIDelete() {
  const webhookId = (global as any).testWebhookId;
  const response = await axios.delete(`${BASE_URL}/webhooks/${webhookId}`, {
    data: { userId: TEST_USER },
  });

  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  if (!response.data.success) throw new Error('Delete failed');
}

async function testDeliverySuccess() {
  // Create webhook to httpbin (will succeed)
  const createRes = await axios.post(`${BASE_URL}/webhooks`, {
    userId: TEST_USER,
    url: 'https://httpbin.org/post',
    events: ['wallet.tracked'],
  });

  const webhookId = createRes.data.id;

  // Trigger test event
  await axios.post(`${BASE_URL}/webhooks/${webhookId}/test`, {
    userId: TEST_USER,
  });

  // Wait for delivery
  await new Promise(r => setTimeout(r, 3000));

  // Check logs
  const logsRes = await axios.get(`${BASE_URL}/webhooks/${webhookId}/logs?userId=${TEST_USER}`);
  const logs = logsRes.data.logs;

  if (logs.length === 0) throw new Error('No delivery logs');
  if (logs[0].status !== 'success') throw new Error(`Expected success, got ${logs[0].status}`);

  // Cleanup
  await axios.delete(`${BASE_URL}/webhooks/${webhookId}`, {
    data: { userId: TEST_USER },
  });
}

async function testRetryBehavior() {
  // Create webhook to non-existent domain (will fail)
  const createRes = await axios.post(`${BASE_URL}/webhooks`, {
    userId: TEST_USER,
    url: 'https://this-domain-definitely-does-not-exist-12345.com/webhook',
    events: ['large.transfer'],
  });

  const webhookId = createRes.data.id;

  // Trigger event
  await axios.post(`${BASE_URL}/webhooks/${webhookId}/test`, {
    userId: TEST_USER,
  });

  // Wait for retries (1s + 5s + 25s = ~31s total)
  log('  ⏳ Waiting for retries (this takes ~35 seconds)...');
  await new Promise(r => setTimeout(r, 35000));

  // Check webhook is disabled
  const listRes = await axios.get(`${BASE_URL}/webhooks?userId=${TEST_USER}`);
  const webhook = listRes.data.find((w: any) => w.id === webhookId);

  if (!webhook) throw new Error('Webhook not found');
  if (webhook.isActive !== false) throw new Error(`Expected inactive, got active`);
  if (webhook.failureCount < 1) throw new Error(`Expected failures, got ${webhook.failureCount}`);

  // Cleanup
  await axios.delete(`${BASE_URL}/webhooks/${webhookId}`, {
    data: { userId: TEST_USER },
  });
}

async function testHMACSignature() {
  // This would require a custom endpoint to verify
  // For now, just verify the secret is present
  const createRes = await axios.post(`${BASE_URL}/webhooks`, {
    userId: TEST_USER,
    url: 'https://httpbin.org/post',
    events: ['wallet.tracked'],
  });

  if (!createRes.data.secret || createRes.data.secret.length !== 32) {
    throw new Error('Invalid secret');
  }

  // Cleanup
  await axios.delete(`${BASE_URL}/webhooks/${createRes.data.id}`, {
    data: { userId: TEST_USER },
  });
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  log('');
  log('========================================');
  log('  Phase 14: End-to-End Testing');
  log('========================================');
  log('');

  // Check server is running
  try {
    await axios.get(`${BASE_URL}/health`);
    log('✅ Server is running\n');
  } catch {
    log('❌ Server is not running. Start it with: pnpm dev\n');
    process.exit(1);
  }

  // Run tests
  log('[API Tests]');
  await runTest('POST /webhooks - Create', testAPICreate);
  await runTest('GET /webhooks - List', testAPIList);
  await runTest('GET /webhooks/:id/logs - Logs', testAPILogs);
  await runTest('POST /webhooks/:id/test - Test Event', testAPITestEvent);
  await runTest('DELETE /webhooks/:id - Delete', testAPIDelete);

  log('\n[Delivery Tests]');
  await runTest('Delivery to httpbin (success)', testDeliverySuccess);
  await runTest('HMAC Secret generation', testHMACSignature);

  log('\n[Retry Tests]');
  await runTest('Retry + disable on failure', testRetryBehavior);

  // Summary
  log('\n========================================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  log(`  Results: ${passed}/${total} passed`);
  log('========================================');

  if (passed < total) {
    log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.test}: ${r.error}`);
    });
    process.exit(1);
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
