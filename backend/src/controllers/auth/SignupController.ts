import { Request, Response } from 'express';
import { AuthService, SignupData } from '../../services/auth';
import { logger } from '../../utils/logger';

export async function signupHandler(req: Request, res: Response): Promise<void> {
  try {
    const { telegramId, telegramUsername, walletAddress } = req.body;

    if (!telegramId || !walletAddress) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: telegramId and walletAddress are required.',
      });
      return;
    }

    const data: SignupData = {
      telegramId: Number(telegramId),
      telegramUsername: telegramUsername || undefined,
      walletAddress: String(walletAddress),
    };

    const result = await AuthService.signup(data);

    if (!result.success) {
      res.status(409).json({
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
