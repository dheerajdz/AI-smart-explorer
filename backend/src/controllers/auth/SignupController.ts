import { Request, Response } from 'express';
import { AuthService } from '../../services/auth';
import { logger } from '../../utils/logger';

export async function signupHandler(req: Request, res: Response): Promise<void> {
  try {
    const { telegramId, telegramUsername, email, walletAddress, otp } = req.body;

    if (!telegramId || !email || !walletAddress || !otp) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: telegramId, email, walletAddress, and otp are required.',
      });
      return;
    }

    const result = await AuthService.completeSignup(
      Number(telegramId),
      String(otp),
      String(walletAddress)
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Signup successful.',
      user: {
        telegramId: result.user!.telegramId,
        telegramUsername: result.user!.telegramUsername,
        email: result.user!.email,
        walletAddress: result.user!.walletAddress,
        plan: result.user!.plan,
        createdAt: result.user!.createdAt,
      },
    });
  } catch (err) {
    logger.error('Signup controller error', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error.',
    });
  }
}
