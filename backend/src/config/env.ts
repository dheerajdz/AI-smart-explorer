import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  
  // ── Bot Tokens ──────────────────────────────────────────────
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  
  // ── Kimi AI ─────────────────────────────────────────────────
  KIMI_API_KEY: z.string().min(1, 'KIMI_API_KEY is required'),
  KIMI_BASE_URL: z.string().url().optional().default('https://api.moonshot.cn/v1'),
  KIMI_MODEL: z.string().optional().default('moonshot-v1-8k'),
  
  // ── OpenRouter AI ───────────────────────────────────────────
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENROUTER_MODEL: z.string().optional().default('meta-llama/llama-3.1-8b-instruct:free'),
  
  // ── Groq AI ──────────────────────────────────────────────────
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().optional().default('llama-3.3-70b-versatile'),
  
  // ── Stripe Billing ──────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_ENTERPRISE_PRICE_ID: z.string().optional(),
  
  // ── JWT ───────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url().optional().default('http://localhost:3000'),
  
  // ── Blockchain APIs ─────────────────────────────────────────
  XDCSCAN_API: z.string().url().optional().default('https://api.xdcscan.io/api'),
  XDCSCAN_TESTNET_API: z.string().url().optional().default('https://erpc.apothem.network'),
  XDC_TESTNET_RPC: z.string().url().optional().default('https://erpc.apothem.network'),
  
  // ── Twilio (WhatsApp) ───────────────────────────────────────
  TWILIO_ACCOUNT_SID: z.string().min(1, 'TWILIO_ACCOUNT_SID is required'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'TWILIO_AUTH_TOKEN is required'),
  TWILIO_WHATSAPP_NUMBER: z.string().min(1, 'TWILIO_WHATSAPP_NUMBER is required'),
  
  // ── Slack ───────────────────────────────────────────────────
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  
  // ── X (Twitter) ─────────────────────────────────────────────
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_SECRET: z.string().optional(),
  
  // ── Email / SMTP (for OTP) ──────────────────────────────────
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
