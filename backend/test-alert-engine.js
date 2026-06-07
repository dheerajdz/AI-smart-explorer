const mongoose = require('mongoose');

async function testAlertEngine() {
  console.log('🧪 Testing Alert Engine...\n');

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart-ai-explorer');
  console.log('✅ Connected to MongoDB\n');

  const AlertModel = mongoose.model('Alert', new mongoose.Schema({
    userId: String,
    platform: String,
    chatId: String,
    type: String,
    name: String,
    condition: Object,
    status: { type: String, default: 'active' },
    isActive: { type: Boolean, default: true },
    triggerCount: { type: Number, default: 0 },
    cooldownMinutes: { type: Number, default: 60 },
    lastTriggered: Date,
  }, { timestamps: true }));

  // Clean up old test alerts
  await AlertModel.deleteMany({ userId: 'test_user' });
  console.log('🧹 Cleaned up old test alerts\n');

  // Test 1: Gas Spike Alert (easiest to trigger)
  console.log('─── Test 1: Gas Spike Alert ───');
  const gasAlert = new AlertModel({
    userId: 'test_user',
    platform: 'telegram',
    chatId: '5723078075',
    type: 'gas_spike',
    name: 'Gas > 1 Gwei',
    condition: {
      operator: 'above',
      value: 1,
      unit: 'Gwei',
      network: 'mainnet'
    },
    cooldownMinutes: 1
  });
  await gasAlert.save();
  console.log('✅ Created gas alert:', gasAlert._id.toString());

  // Test 2: Price Threshold Alert
  console.log('\n─── Test 2: Price Threshold Alert ───');
  const priceAlert = new AlertModel({
    userId: 'test_user',
    platform: 'telegram',
    chatId: '5723078075',
    type: 'price_threshold',
    name: 'XDC < $1',
    condition: {
      operator: 'below',
      value: 1,
      currency: 'USD',
      network: 'mainnet'
    },
    cooldownMinutes: 1
  });
  await priceAlert.save();
  console.log('✅ Created price alert:', priceAlert._id.toString());

  // Test 3: Balance Change Alert
  console.log('\n─── Test 3: Balance Change Alert ───');
  const balanceAlert = new AlertModel({
    userId: 'test_user',
    platform: 'telegram',
    chatId: '5723078075',
    type: 'balance_change',
    name: 'Balance Change',
    condition: {
      address: 'xdc0000000000000000000000000000000000000000',
      network: 'mainnet'
    },
    cooldownMinutes: 1
  });
  await balanceAlert.save();
  console.log('✅ Created balance alert:', balanceAlert._id.toString());

  // Test 4: Failed Transaction Alert
  console.log('\n─── Test 4: Failed Transaction Alert ───');
  const failedTxAlert = new AlertModel({
    userId: 'test_user',
    platform: 'telegram',
    chatId: '5723078075',
    type: 'tx_failed',
    name: 'Failed TX Alert',
    condition: {
      address: 'xdc0000000000000000000000000000000000000000',
      network: 'mainnet'
    },
    cooldownMinutes: 1
  });
  await failedTxAlert.save();
  console.log('✅ Created failed tx alert:', failedTxAlert._id.toString());

  // Test 5: Testnet Alert
  console.log('\n─── Test 5: Testnet Gas Alert ───');
  const testnetAlert = new AlertModel({
    userId: 'test_user',
    platform: 'telegram',
    chatId: '5723078075',
    type: 'gas_spike',
    name: 'Testnet Gas > 1',
    condition: {
      operator: 'above',
      value: 1,
      unit: 'Gwei',
      network: 'testnet'
    },
    cooldownMinutes: 1
  });
  await testnetAlert.save();
  console.log('✅ Created testnet alert:', testnetAlert._id.toString());

  // List all alerts
  console.log('\n─── All Created Alerts ───');
  const alerts = await AlertModel.find({ userId: 'test_user' }).sort({ createdAt: -1 });
  alerts.forEach((alert, i) => {
    console.log(`${i + 1}. ${alert.name} (${alert.type}) — ${alert.condition.network || 'mainnet'} — ${alert.status}`);
  });

  console.log('\n✅ Test setup complete!');
  console.log('\nNext steps:');
  console.log('1. Start server: pnpm dev');
  console.log('2. Watch logs for [alertPoller] messages');
  console.log('3. Or manually trigger evaluation via API');

  process.exit(0);
}

testAlertEngine().catch(e => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
