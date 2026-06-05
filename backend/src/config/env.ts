import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  KIMI_API_KEY: z.string().min(1, 'KIMI_API_KEY is required'),
  BLOCKSCOUT_API: z.string().url().optional(),
  XDCSCAN_API: z.string().url().optional(),
  // Email / SMTP Configuration
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.string().default('587').transform((v) => parseInt(v, 10)),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  SMTP_FROM: z.string().email().default('noreply@smartaiexplorer.com'),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
