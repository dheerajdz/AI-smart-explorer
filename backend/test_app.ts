
import 'dotenv/config';
console.log('1. dotenv loaded');

import { env } from './src/config/env';
console.log('2. env parsed, PORT=', env.PORT);

import { connectMongo } from './src/database/mongodb';
console.log('3. mongodb module loaded');

import { redis } from './src/database/redis';
console.log('4. redis module loaded');

Promise.race([
  connectMongo(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('mongo timeout')), 10000))
]).then(() => {
  console.log('5. mongo connected');
  return redis.ping();
}).then((pong) => {
  console.log('6. redis ping:', pong);
  process.exit(0);
}).catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
