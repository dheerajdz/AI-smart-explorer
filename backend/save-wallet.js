require('dotenv').config();
const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/');

async function main() {
  await client.connect();
  const db = client.db('smart_explorer');
  await db.collection('portfolios').updateOne(
    { userId: '7465044566' },
    { $set: { userId: '7465044566', wallets: [{ address: '0xfD553CBDf8cA05868B53E26D8596D4A6feb43094', label: 'Main' }] } },
    { upsert: true }
  );
  console.log('Wallet saved!');
  await client.close();
}

main().catch(e => { console.log('Error:', e.message); process.exit(1); });
