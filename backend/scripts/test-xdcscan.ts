// ============================================================
// Test script for Phase 8: XDCScan Service
// Run: npx tsx scripts/test-xdcscan.ts
// ============================================================

import {
  getWalletBalance,
  getTransactions,
  getWalletActivity,
  getLargeTransfers,
} from '../src/services/blockchain/xdcscanService';

const TEST_ADDRESS = 'xdc0000000000000000000000000000000000000000';

async function test() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Phase 8: XDCScan Service Test                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. getWalletBalance
  console.log('─'.repeat(60));
  console.log('1️⃣  getWalletBalance()');
  console.log('─'.repeat(60));
  try {
    const balance = await getWalletBalance(TEST_ADDRESS);
    console.log('✅ OUTPUT:', JSON.stringify(balance, null, 2));
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }

  // 2. getTransactions
  console.log('\n' + '─'.repeat(60));
  console.log('2️⃣  getTransactions()');
  console.log('─'.repeat(60));
  try {
    const txs = await getTransactions(TEST_ADDRESS, 1, 5);
    console.log('✅ OUTPUT:', JSON.stringify(txs, null, 2));
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }

  // 3. getWalletActivity
  console.log('\n' + '─'.repeat(60));
  console.log('3️⃣  getWalletActivity()');
  console.log('─'.repeat(60));
  try {
    const activity = await getWalletActivity(TEST_ADDRESS);
    console.log('✅ OUTPUT:', JSON.stringify(activity, null, 2));
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }

  // 4. getLargeTransfers
  console.log('\n' + '─'.repeat(60));
  console.log('4️⃣  getLargeTransfers()');
  console.log('─'.repeat(60));
  try {
    const large = await getLargeTransfers(TEST_ADDRESS, 1000);
    console.log('✅ OUTPUT:', JSON.stringify(large, null, 2));
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Phase 8 test complete!');
  console.log('═'.repeat(60));
}

test().catch(console.error);
