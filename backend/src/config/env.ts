import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000'),
  MONGO_URI: z.string().optional().default('mongodb://localhost:27017/smart-explorer'),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default('dummy-token'),
  KIMI_API_KEY: z.string().optional().default('dummy-key'),
  KIMI_BASE_URL: z.string().url().optional().default('https://api.moonshot.cn/v1'),
  KIMI_MODEL: z.string().optional().default('moonshot-v1-8k'),
  BLOCKSCOUT_API: z.string().url().optional(),
  XDCSCAN_API: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
