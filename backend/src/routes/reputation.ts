import { Router, Request, Response } from 'express';
import { getReputation, getLeaderboard } from '../services/reputation/reputationService';
import { logger } from '../utils/logger';
import { isValidXdcAddress } from '../utils/network';

const router = Router();

/**
 * GET /api/reputation/:address
 * Get reputation score for a wallet address
 */
router.get('/:address', async (req: Request, res: Response) => {
  const address = String(req.params.address);
  const networkRaw = Array.isArray(req.query.network) ? req.query.network[0] : (req.query.network as string) || 'mainnet';
  const network = String(networkRaw);

  if (!isValidXdcAddress(address)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid XDC address',
    });
  }

  try {
    const reputation = await getReputation(address, network as 'mainnet' | 'testnet');

    if (!reputation) {
      return res.status(404).json({
        success: false,
        error: 'Reputation not found or could not be calculated',
      });
    }

    res.json({
      success: true,
      data: reputation,
    });
  } catch (err) {
    logger.error('[reputationRoute] Failed to get reputation', { address, error: err });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/reputation/leaderboard
 * Get top wallets by reputation score
 */
router.get('/', async (req: Request, res: Response) => {
  const network = (req.query.network as 'mainnet' | 'testnet') || 'mainnet';
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

  try {
    const leaderboard = await getLeaderboard(network, limit);

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (err) {
    logger.error('[reputationRoute] Failed to get leaderboard', { error: err });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
