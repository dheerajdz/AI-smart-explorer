import { User, IUser } from '../../models/User';
import { logger } from '../../utils/logger';

export interface SignupData {
  telegramId: number;
  telegramUsername?: string;
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
}

export class AuthService {
  /**
   * Validate XDC wallet address
   * XDC addresses start with 'xdc' (mainnet) or '0x' (EVM-compatible)
   */
  static isValidWalletAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim().toLowerCase();
    // XDC mainnet: xdc... (42 chars), EVM: 0x... (42 chars)
    if (trimmed.startsWith('xdc')) {
      return /^xdc[0-9a-f]{40}$/i.test(trimmed);
    }
    if (trimmed.startsWith('0x')) {
      return /^0x[0-9a-f]{40}$/i.test(trimmed);
    }
    return false;
  }

  /**
   * Sign up a new user
   */
  static async signup(data: SignupData): Promise<AuthResult> {
    try {
      const { telegramId, telegramUsername, walletAddress } = data;

      if (!this.isValidWalletAddress(walletAddress)) {
        return { success: false, error: 'Invalid wallet address. Must be a valid XDC address (xdc... or 0x...).' };
      }

      const existingUser = await User.findOne({
        $or: [{ telegramId }, { walletAddress: walletAddress.trim().toLowerCase() }],
      });

      if (existingUser) {
        return { success: false, error: 'User already exists. Please sign in instead.' };
      }

      const user = new User({
        telegramId,
        telegramUsername: telegramUsername || undefined,
        walletAddress: walletAddress.trim().toLowerCase(),
        plan: 'free',
      });

      await user.save();
      logger.info('User signed up', { telegramId, walletAddress: user.walletAddress });

      return { success: true, user };
    } catch (err) {
      logger.error('Signup error', err);
      return { success: false, error: 'Internal error during signup.' };
    }
  }

  /**
   * Sign in an existing user
   */
  static async signin(data: SigninData): Promise<AuthResult> {
    try {
      const { telegramId, walletAddress } = data;

      if (!this.isValidWalletAddress(walletAddress)) {
        return { success: false, error: 'Invalid wallet address.' };
      }

      const user = await User.findOne({
        telegramId,
        walletAddress: walletAddress.trim().toLowerCase(),
      });

      if (!user) {
        return { success: false, error: 'User not found. Please sign up first.' };
      }

      logger.info('User signed in', { telegramId, walletAddress: user.walletAddress });
      return { success: true, user };
    } catch (err) {
      logger.error('Signin error', err);
      return { success: false, error: 'Internal error during signin.' };
    }
  }

  /**
   * Find user by Telegram ID
   */
  static async findByTelegramId(telegramId: number): Promise<IUser | null> {
    return User.findOne({ telegramId });
  }
}
