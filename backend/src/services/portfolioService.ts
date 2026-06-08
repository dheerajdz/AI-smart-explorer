import { PortfolioModel, IPortfolioWallet } from '../models/Portfolio';
import { getWalletBalance, getTransactions } from './blockchain';
import { logger } from '../utils/logger';

export interface PortfolioSummary {
  totalWallets: number;
  totalBalanceXDC: string;
  totalBalanceUSD: string;
  wallets: Array<{
    address: string;
    network: string;
    balanceXDC: string;
    balanceUSD: string;
    txCount: number;
    label?: string;
  }>;
  lastUpdated: Date;
}

/**
 * Add a wallet to user's portfolio
 */
export async function addPortfolioWallet(
  userId: string,
  platform: string,
  address: string,
  network: 'mainnet' | 'testnet',
  label?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if already exists
    const portfolio = await PortfolioModel.findByUser(userId, platform);
    if (portfolio?.wallets.some(w => w.address.toLowerCase() === address.toLowerCase())) {
      return { success: false, message: '⚠️ Wallet already in portfolio.' };
    }

    await PortfolioModel.addWallet(userId, platform, {
      address,
      network,
      label,
      addedAt: new Date(),
    });

    return { success: true, message: `✅ Wallet added to portfolio.\n\nAddress: \`${address}\`\nNetwork: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}` };
  } catch (err) {
    logger.error('[PortfolioService] Add wallet failed', { userId, address, error: err });
    return { success: false, message: '❌ Failed to add wallet.' };
  }
}

/**
 * Remove a wallet from user's portfolio
 */
export async function removePortfolioWallet(
  userId: string,
  platform: string,
  address: string
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await PortfolioModel.removeWallet(userId, platform, address);
    if (!result) {
      return { success: false, message: '⚠️ Wallet not found in portfolio.' };
    }
    return { success: true, message: '✅ Wallet removed from portfolio.' };
  } catch (err) {
    logger.error('[PortfolioService] Remove wallet failed', { userId, address, error: err });
    return { success: false, message: '❌ Failed to remove wallet.' };
  }
}

/**
 * Get portfolio summary with live balances
 */
export async function getPortfolioSummary(
  userId: string,
  platform: string
): Promise<PortfolioSummary> {
  const portfolio = await PortfolioModel.findByUser(userId, platform);

  if (!portfolio || portfolio.wallets.length === 0) {
    return {
      totalWallets: 0,
      totalBalanceXDC: '0',
      totalBalanceUSD: '0',
      wallets: [],
      lastUpdated: new Date(),
    };
  }

  // Fetch live balances for all wallets
  const walletsWithBalance = await Promise.all(
    portfolio.wallets.map(async (w) => {
      try {
        const [balanceData, txData] = await Promise.all([
          getWalletBalance(w.address, w.network),
          getTransactions(w.address, w.network, 1, 1),
        ]);

        const xdcPrice = 0.03; // Approximate price
        const balanceXDC = parseFloat(balanceData.balanceXDC);
        const balanceUSD = balanceXDC * xdcPrice;

        return {
          address: w.address,
          network: w.network,
          balanceXDC: balanceData.balanceXDC,
          balanceUSD: balanceUSD.toFixed(2),
          txCount: txData.totalCount,
          label: w.label,
        };
      } catch (err) {
        logger.error('[PortfolioService] Balance fetch failed', { address: w.address, error: err });
        return {
          address: w.address,
          network: w.network,
          balanceXDC: '0',
          balanceUSD: '0.00',
          txCount: 0,
          label: w.label,
        };
      }
    })
  );

  const totalBalanceXDC = walletsWithBalance
    .reduce((sum, w) => sum + parseFloat(w.balanceXDC), 0)
    .toFixed(4);
  const totalBalanceUSD = walletsWithBalance
    .reduce((sum, w) => sum + parseFloat(w.balanceUSD), 0)
    .toFixed(2);

  // Update cached totals
  await PortfolioModel.updateBalances(userId, platform, totalBalanceXDC, totalBalanceUSD);

  return {
    totalWallets: walletsWithBalance.length,
    totalBalanceXDC,
    totalBalanceUSD,
    wallets: walletsWithBalance,
    lastUpdated: new Date(),
  };
}
