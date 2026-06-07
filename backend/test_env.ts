
import 'dotenv/config';
import { env } from './src/config/env';

console.log('ENV loaded successfully');
console.log('PORT:', env.PORT);
console.log('MONGO_URI:', env.MONGO_URI);
console.log('REDIS_URL:', env.REDIS_URL);
console.log('TELEGRAM_BOT_TOKEN starts with:', env.TELEGRAM_BOT_TOKEN?.split(':')[0]);

import { connectMongo } from './src/database/mongodb';

connectMongo().then(() => {
  console.log('MongoDB connected');
  process.exit(0);
}).catch((err) => {
  console.error('MongoDB failed:', err);
  process.exit(1);
});
