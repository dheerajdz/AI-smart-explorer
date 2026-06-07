import { PortfolioModel, IPortfolio, IPortfolioWallet } from '../models/Portfolio';
import { logger } from '../utils/logger';
import * as walletService from './walletService';

export async function createPortfolio(
  userId: string,
  wallets: IPortfolioWallet[]
): Promise<IPortfolio> {
  const existing = await PortfolioModel.findOne({ userId });
  if (existing) {
    throw new Error('Portfolio already exists for this user');
  }

  const portfolio = await PortfolioModel.create({ userId, wallets });
  logger.info('Portfolio created', { userId, walletCount: wallets.length });
  return portfolio;
}

export async function getPortfolio(userId: string): Promise<IPortfolio | null> {
  return PortfolioModel.findOne({ userId });
}

export async function addWallet(
  userId: string,
  wallet: IPortfolioWallet
): Promise<IPortfolio | null> {
  const portfolio = await PortfolioModel.findOneAndUpdate(
    { userId },
    { $addToSet: { wallets: { address: wallet.address.toLowerCase(), network: wallet.network } } },
    { new: true, upsert: true }
  );

  logger.info('Wallet added to portfolio', { userId, address: wallet.address });
  return portfolio;
}

export async function removeWallet(
  userId: string,
  address: string
): Promise<IPortfolio | null> {
  const portfolio = await PortfolioModel.findOneAndUpdate(
    { userId },
    { $pull: { wallets: { address: address.toLowerCase() } } },
    { new: true }
  );

  logger.info('Wallet removed from portfolio', { userId, address });
  return portfolio;
}

export async function getPortfolioBalance(
  userId: string
): Promise<{ totalBalance: string; walletBalances: Array<{ address: string; balance: string }> }> {
  const portfolio = await PortfolioModel.findOne({ userId });

  if (!portfolio || portfolio.wallets.length === 0) {
    return { totalBalance: '0', walletBalances: [] };
  }

  let totalBalance = 0;
  const walletBalances: Array<{ address: string; balance: string }> = [];

  for (const wallet of portfolio.wallets) {
    try {
      const balance = await walletService.getWalletBalance(wallet.address);
      const balanceNum = parseFloat(balance);
      totalBalance += isNaN(balanceNum) ? 0 : balanceNum;
      walletBalances.push({ address: wallet.address, balance });
    } catch (err) {
      logger.error('Failed to fetch wallet balance', { address: wallet.address, error: (err as Error).message });
      walletBalances.push({ address: wallet.address, balance: '0' });
    }
  }

  return {
    totalBalance: totalBalance.toString(),
    walletBalances,
  };
}
