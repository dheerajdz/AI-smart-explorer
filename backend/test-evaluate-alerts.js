const mongoose = require('mongoose');

async function evaluateTestAlerts() {
  console.log('🔍 Evaluating Test Alerts...\n');

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart-ai-explorer');
  console.log('✅ Connected to MongoDB\n');

  const AlertModel = mongoose.model('Alert');
  const alerts = await AlertModel.find({ userId: 'test_user', status: 'active' });

  console.log(`Found ${alerts.length} active alerts\n`);

  // Import evaluator
  const { evaluateAlert } = require('./dist/services/alert/evaluator');

  for (const alert of alerts) {
    console.log(`─── Evaluating: ${alert.name} (${alert.type}) ───`);
    console.log(`Network: ${alert.condition.network || 'mainnet'}`);

    try {
      const result = await evaluateAlert(alert);
      console.log(`Triggered: ${result.triggered ? '✅ YES' : '❌ NO'}`);
      if (result.data) {
        console.log('Data:', JSON.stringify(result.data, null, 2));
      }
      if (result.error) {
        console.log('Error:', result.error);
      }
    } catch (err) {
      console.log('❌ Evaluation error:', err.message);
    }
    console.log('');
  }

  console.log('✅ Evaluation complete!');
  process.exit(0);
}

evaluateTestAlerts().catch(e => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
