import { redis } from '../../database/redis';
import { logger } from '../../utils/logger';

export interface OTPData {
  otp: string;
  email: string;
  telegramId: number;
  telegramUsername?: string;
  purpose: 'signup' | 'signin';
  walletAddress?: string;
  attempts: number;
  createdAt: number;
}

const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 3;

function getKey(telegramId: number, purpose: string): string {
  return `otp:${purpose}:${telegramId}`;
}

export class OTPService {
  /**
   * Generate a 6-digit OTP
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Store OTP in Redis with metadata
   */
  static async storeOTP(data: Omit<OTPData, 'otp' | 'attempts' | 'createdAt'>): Promise<string> {
    const otp = this.generateOTP();
    const key = getKey(data.telegramId, data.purpose);

    const otpData: OTPData = {
      otp,
      email: data.email,
      telegramId: data.telegramId,
      telegramUsername: data.telegramUsername,
      purpose: data.purpose,
      walletAddress: data.walletAddress,
      attempts: 0,
      createdAt: Date.now(),
    };

    await redis.setex(key, OTP_TTL_SECONDS, JSON.stringify(otpData));
    logger.info('OTP stored', { telegramId: data.telegramId, purpose: data.purpose, email: data.email });

    return otp;
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(telegramId: number, purpose: 'signup' | 'signin', inputOTP: string): Promise<{ valid: boolean; data?: OTPData; error?: string }> {
    const key = getKey(telegramId, purpose);
    const stored = await redis.get(key);

    if (!stored) {
      return { valid: false, error: 'OTP expired or not found. Please request a new one.' };
    }

    const data: OTPData = JSON.parse(stored);

    if (data.attempts >= MAX_ATTEMPTS) {
      await redis.del(key);
      return { valid: false, error: 'Too many failed attempts. Please request a new OTP.' };
    }

    if (data.otp !== inputOTP.trim()) {
      data.attempts += 1;
      await redis.setex(key, OTP_TTL_SECONDS, JSON.stringify(data));
      const remaining = MAX_ATTEMPTS - data.attempts;
      return { valid: false, error: `Invalid OTP. ${remaining} attempt(s) remaining.` };
    }

    // OTP is valid — delete it so it can't be reused
    await redis.del(key);
    logger.info('OTP verified', { telegramId, purpose, email: data.email });

    return { valid: true, data };
  }

  /**
   * Resend OTP — generates new code, resets attempts
   */
  static async resendOTP(telegramId: number, purpose: 'signup' | 'signin'): Promise<{ success: boolean; otp?: string; error?: string }> {
    const key = getKey(telegramId, purpose);
    const stored = await redis.get(key);

    if (!stored) {
      return { success: false, error: 'No active OTP session. Please start signup/signin again.' };
    }

    const oldData: OTPData = JSON.parse(stored);
    const newOTP = this.generateOTP();

    const newData: OTPData = {
      ...oldData,
      otp: newOTP,
      attempts: 0,
      createdAt: Date.now(),
    };

    await redis.setex(key, OTP_TTL_SECONDS, JSON.stringify(newData));
    logger.info('OTP resent', { telegramId, purpose, email: oldData.email });

    return { success: true, otp: newOTP };
  }

  /**
   * Get OTP data (for checking if session exists)
   */
  static async getOTPData(telegramId: number, purpose: 'signup' | 'signin'): Promise<OTPData | null> {
    const key = getKey(telegramId, purpose);
    const stored = await redis.get(key);
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * Clear OTP session
   */
  static async clearOTP(telegramId: number, purpose: 'signup' | 'signin'): Promise<void> {
    const key = getKey(telegramId, purpose);
    await redis.del(key);
  }
}
