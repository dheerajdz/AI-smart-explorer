import { UserModel, IUser } from '../../models/User';
import { logger } from '../../utils/logger';
import { OTPService } from '../otp';
import { EmailService } from '../email';

export interface SignupData {
  telegramId: number;
  telegramUsername?: string;
  email: string;
  walletAddress: string;
}

export interface SigninData {
  telegramId: number;
  walletAddress: string;
}

export interface AuthResult {
  success: boolean;
  user?: IUser;
  error?: string;
  previewUrl?: string;
}

export class AuthService {
  /**
   * Validate XDC wallet address
   */
  static isValidWalletAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim().toLowerCase();
    if (trimmed.startsWith('xdc')) {
      return /^xdc[0-9a-f]{40}$/i.test(trimmed);
    }
    if (trimmed.startsWith('0x')) {
      return /^0x[0-9a-f]{40}$/i.test(trimmed);
    }
    return false;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim().toLowerCase());
  }

  /**
   * Step 1: Initiate signup — send OTP to email
   */
  static async initiateSignup(data: Omit<SignupData, 'walletAddress'>): Promise<AuthResult> {
    try {
      const { telegramId, telegramUsername, email } = data;

      if (!this.isValidEmail(email)) {
        return { success: false, error: 'Invalid email format.' };
      }

      // Check if user already exists
      const existingUser = await UserModel.findOne({
        telegramId,
      });

      if (existingUser) {
        return { success: false, error: 'User already exists. Please sign in instead.' };
      }

      const existingEmail = await UserModel.findByEmail(email.trim().toLowerCase());
      if (existingEmail) {
        return { success: false, error: 'Email already registered. Please sign in instead.' };
      }

      // Store OTP session
      const otp = await OTPService.storeOTP({
        email: email.trim().toLowerCase(),
        telegramId,
        telegramUsername,
        purpose: 'signup',
      });

      // Send OTP email
      const emailResult = await EmailService.sendOTPEmail(email.trim().toLowerCase(), otp, 'signup');

      if (!emailResult.success) {
        await OTPService.clearOTP(telegramId, 'signup');
        return { success: false, error: emailResult.error || 'Failed to send OTP email.' };
      }

      logger.info('Signup OTP sent', { telegramId, email });
      return { success: true, previewUrl: emailResult.previewUrl };
    } catch (err) {
      logger.error('Initiate signup error', err);
      return { success: false, error: 'Internal error during signup initiation.' };
    }
  }

  /**
   * Step 2: Verify OTP and complete signup
   */
  static async completeSignup(telegramId: number, otp: string, walletAddress: string): Promise<AuthResult> {
    try {
      if (!this.isValidWalletAddress(walletAddress)) {
        return { success: false, error: 'Invalid wallet address. Must be a valid XDC address (xdc... or 0x...).' };
      }

      const otpResult = await OTPService.verifyOTP(telegramId, 'signup', otp);

      if (!otpResult.valid || !otpResult.data) {
        return { success: false, error: otpResult.error || 'Invalid OTP.' };
      }

      const { email, telegramUsername } = otpResult.data;

      // Check if wallet already used
      const existingWallet = await UserModel.findByWalletAddress(walletAddress.trim().toLowerCase());
      if (existingWallet) {
        return { success: false, error: 'Wallet address already registered.' };
      }

      const savedUser = await UserModel.create({
        telegramId,
        telegramUsername: telegramUsername || undefined,
        email: email.trim().toLowerCase(),
        walletAddress: walletAddress.trim().toLowerCase(),
        plan: 'free',
        isEmailVerified: true,
      });

      logger.info('User signed up', { telegramId, userId: savedUser._id, email, walletAddress: savedUser.walletAddress });

      return { success: true, user: savedUser };
    } catch (err) {
      logger.error('Complete signup error', { error: err instanceof Error ? err.message : err, telegramId });
      return { success: false, error: 'Internal error during signup completion.' };
    }
  }

  /**
   * Step 1: Initiate signin — send OTP to email
   */
  static async initiateSignin(telegramId: number): Promise<AuthResult> {
    try {
      const user = await UserModel.findByTelegramId(telegramId);

      if (!user) {
        return { success: false, error: 'User not found. Please sign up first.' };
      }

      // Store OTP session
      const otp = await OTPService.storeOTP({
        email: user.email,
        telegramId,
        telegramUsername: user.telegramUsername || undefined,
        purpose: 'signin',
      });

      // Send OTP email
      const emailResult = await EmailService.sendOTPEmail(user.email, otp, 'signin');

      if (!emailResult.success) {
        await OTPService.clearOTP(telegramId, 'signin');
        return { success: false, error: emailResult.error || 'Failed to send OTP email.' };
      }

      logger.info('Signin OTP sent', { telegramId, email: user.email });
      return { success: true, previewUrl: emailResult.previewUrl };
    } catch (err) {
      logger.error('Initiate signin error', err);
      return { success: false, error: 'Internal error during signin initiation.' };
    }
  }

  /**
   * Step 2: Verify OTP and complete signin
   */
  static async completeSignin(telegramId: number, otp: string): Promise<AuthResult> {
    try {
      const otpResult = await OTPService.verifyOTP(telegramId, 'signin', otp);

      if (!otpResult.valid) {
        return { success: false, error: otpResult.error || 'Invalid OTP.' };
      }

      const user = await UserModel.findByTelegramId(telegramId);

      if (!user) {
        return { success: false, error: 'User not found.' };
      }

      logger.info('User signed in', { telegramId, email: user.email });
      return { success: true, user };
    } catch (err) {
      logger.error('Complete signin error', err);
      return { success: false, error: 'Internal error during signin completion.' };
    }
  }

  /**
   * Resend OTP
   */
  static async resendOTP(telegramId: number, purpose: 'signup' | 'signin'): Promise<AuthResult> {
    try {
      const resendResult = await OTPService.resendOTP(telegramId, purpose);

      if (!resendResult.success || !resendResult.otp) {
        return { success: false, error: resendResult.error || 'Failed to resend OTP.' };
      }

      // Get email from existing OTP data
      const otpData = await OTPService.getOTPData(telegramId, purpose);
      if (!otpData) {
        return { success: false, error: 'No active OTP session found.' };
      }

      const emailResult = await EmailService.sendOTPEmail(otpData.email, resendResult.otp, purpose);

      if (!emailResult.success) {
        return { success: false, error: emailResult.error || 'Failed to resend OTP email.' };
      }

      logger.info('OTP resent', { telegramId, purpose, email: otpData.email });
      return { success: true, previewUrl: emailResult.previewUrl };
    } catch (err) {
      logger.error('Resend OTP error', err);
      return { success: false, error: 'Internal error during OTP resend.' };
    }
  }

  /**
   * Find user by Telegram ID
   */
  static async findByTelegramId(telegramId: number): Promise<IUser | null> {
    return UserModel.findByTelegramId(telegramId);
  }
}
