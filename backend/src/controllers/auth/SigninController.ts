import { Request, Response } from 'express';
import { AuthService, UserService } from '../../services/auth';
import { logger } from '../../utils/logger';

export async function signinHandler(req: Request, res: Response): Promise<void> {
  try {
    const { telegramId, otp } = req.body;

    if (!telegramId || !otp) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: telegramId and otp are required.',
      });
      return;
    }

    const result = await AuthService.completeSignin(Number(telegramId), String(otp));

    if (!result.success) {
      res.status(401).json({
        success: false,
        error: result.error,
      });
      return;
    }

    const dashboard = UserService.buildDashboardPayload(result.user!);

    res.status(200).json({
      success: true,
      message: 'Signin successful.',
      user: {
        telegramId: result.user!.telegramId,
        telegramUsername: result.user!.telegramUsername,
        email: result.user!.email,
        walletAddress: result.user!.walletAddress,
        plan: result.user!.plan,
        createdAt: result.user!.createdAt,
      },
      dashboard,
    });
  } catch (err) {
    logger.error('Signin controller error', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error.',
    });
  }
}
