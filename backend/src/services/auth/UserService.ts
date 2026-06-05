import { User, IUser } from '../../models/User';
import { logger } from '../../utils/logger';

export interface DashboardPayload {
  wallet: {
    address: string;
    network: string;
  };
  transactions: {
    label: string;
    action: string;
  };
  analyzeWallet: {
    label: string;
    action: string;
  };
  trackWallet: {
    label: string;
    action: string;
  };
  profile: {
    telegramId: number;
    telegramUsername?: string;
    walletAddress: string;
    plan: string;
    createdAt: Date;
  };
}

export class UserService {
  /**
   * Build dashboard payload for a logged-in user
   */
  static buildDashboardPayload(user: IUser): DashboardPayload {
    return {
      wallet: {
        address: user.walletAddress,
        network: 'xdc',
      },
      transactions: {
        label: 'Transactions',
        action: 'view_transactions',
      },
      analyzeWallet: {
        label: 'Analyze Wallet',
        action: 'analyze_wallet',
      },
      trackWallet: {
        label: 'Track Wallet',
        action: 'track_wallet',
      },
      profile: {
        telegramId: user.telegramId,
        telegramUsername: user.telegramUsername || undefined,
        walletAddress: user.walletAddress,
        plan: user.plan,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Get user profile by Telegram ID
   */
  static async getProfile(telegramId: number): Promise<IUser | null> {
    return User.findOne({ telegramId });
  }

  /**
   * Update user plan
   */
  static async updatePlan(telegramId: number, plan: 'free' | 'premium'): Promise<IUser | null> {
    try {
      const user = await User.findOneAndUpdate(
        { telegramId },
        { plan },
        { new: true }
      );
      if (user) {
        logger.info('User plan updated', { telegramId, plan });
      }
      return user;
    } catch (err) {
      logger.error('Update plan error', err);
      return null;
    }
  }
}
