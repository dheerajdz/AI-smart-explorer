
import { MongoClient, ServerApiVersion } from 'mongodb';

const client = new MongoClient('mongodb://127.0.0.1:27017/', {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

console.log('Connecting with serverApi...');
const start = Date.now();

const timeout = setTimeout(() => {
  console.log('Connection timed out after', Date.now() - start, 'ms');
  process.exit(1);
}, 10000);

client.connect().then(() => {
  clearTimeout(timeout);
  console.log('Connected in', Date.now() - start, 'ms');
  const db = client.db('smart-ai-explorer');
  return db.command({ ping: 1 });
}).then((r) => {
  console.log('Ping ok:', r);
  process.exit(0);
}).catch((err) => {
  clearTimeout(timeout);
  console.error('Error:', err);
  process.exit(1);
});
