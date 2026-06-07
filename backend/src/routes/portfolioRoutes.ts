import { Router, Request, Response } from 'express';
import * as portfolioService from '../services/portfolioService';
import { logger } from '../utils/logger';

const router = Router();

/* POST /portfolio — create or replace portfolio */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, wallets } = req.body;

    if (!userId || !Array.isArray(wallets)) {
      return res.status(400).json({ error: 'userId and wallets[] are required' });
    }

    const portfolio = await portfolioService.createPortfolio(userId, wallets);
    return res.status(201).json(portfolio);
  } catch (err) {
    logger.error('Create portfolio failed', { error: (err as Error).message });
    return res.status(400).json({ error: (err as Error).message });
  }
});

/* GET /portfolio/:userId — get user's portfolio with balances */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const portfolio = await portfolioService.getPortfolio(userId);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const balanceData = await portfolioService.getPortfolioBalance(userId);

    return res.json({
      portfolio,
      ...balanceData,
    });
  } catch (err) {
    logger.error('Get portfolio failed', { error: (err as Error).message });
    return res.status(500).json({ error: (err as Error).message });
  }
});

/* POST /portfolio/:userId/wallet — add wallet */
router.post('/:userId/wallet', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { address, network = 'mainnet' } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }

    const portfolio = await portfolioService.addWallet(userId, { address, network });
    return res.json(portfolio);
  } catch (err) {
    logger.error('Add wallet failed', { error: (err as Error).message });
    return res.status(500).json({ error: (err as Error).message });
  }
});

/* DELETE /portfolio/:userId/wallet — remove wallet */
router.delete('/:userId/wallet', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }

    const portfolio = await portfolioService.removeWallet(userId, address);
    return res.json(portfolio);
  } catch (err) {
    logger.error('Remove wallet failed', { error: (err as Error).message });
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
