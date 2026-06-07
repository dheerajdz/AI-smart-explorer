import { IUser, UserModel } from '../../models/User';
import { PlanTier } from '../../types';
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
    email?: string;
    walletAddress?: string;
    plan: PlanTier;
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
        address: user.walletAddress || '',
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
        email: user.email,
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
    return UserModel.findByTelegramId(telegramId);
  }

  /**
   * Update user plan
   */
  static async updatePlan(telegramId: number, plan: PlanTier): Promise<IUser | null> {
    try {
      const updated = await UserModel.updateOne({ telegramId }, { plan });
      if (updated) {
        logger.info('User plan updated', { telegramId, plan });
        return UserModel.findByTelegramId(telegramId);
      }
      return null;
    } catch (err) {
      logger.error('Update plan error', err);
      return null;
    }
  }
}
