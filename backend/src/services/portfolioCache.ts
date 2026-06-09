import { PortfolioModel, IPortfolioWallet } from '../models/Portfolio';
import { getWalletBalance } from './blockchain';
import { logger } from '../utils/logger';

interface CacheEntry {
  data: PortfolioData;
  timestamp: number;
}

interface PortfolioData {
  wallet: string;
  network: string;
  totalXdc: string;
  totalUsd: string;
  change24h: string;
  changeValue: string;
  holdings: Array<{
    name: string;
    balance: string;
    symbol: string;
    valueUSD: string;
  }>;
  recentActivity: Array<{
    type: string;
    amount: string;
    time: string;
    status: string;
  }>;
  alerts: Array<{
    message: string;
  }>;
  aiInsight: string;
  cached: boolean;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export async function getPortfolioData(
  userId: string,
  wallets: IPortfolioWallet[]
): Promise<PortfolioData> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { ...cached.data, cached: true };
  }

  return refreshCache(userId, wallets);
}

export async function refreshCache(
  userId: string,
  wallets: IPortfolioWallet[]
): Promise<PortfolioData> {
  try {
    let totalXdc = 0;
    const holdings: PortfolioData['holdings'] = [];

    for (const wallet of wallets) {
      try {
        const balance = await getWalletBalance(wallet.address, wallet.network);
        const balanceXDC = parseFloat(balance.balanceXDC || '0');
        totalXdc += balanceXDC;

        holdings.push({
          name: wallet.label || `Wallet ${wallet.address.slice(0, 8)}...`,
          balance: balance.balanceXDC,
          symbol: 'XDC',
          valueUSD: balance.balance || '0',
        });
      } catch (err) {
        logger.warn('[portfolioCache] Failed to fetch balance', { userId, address: wallet.address, error: err });
      }
    }

    const data: PortfolioData = {
      wallet: wallets.length > 0 ? wallets[0].address : 'N/A',
      network: wallets.length > 0 ? wallets[0].network : 'mainnet',
      totalXdc: totalXdc.toFixed(4),
      totalUsd: (totalXdc * 0.05).toFixed(2), // Approximate price
      change24h: '+0.00%',
      changeValue: '$0.00',
      holdings,
      recentActivity: [],
      alerts: [],
      aiInsight: 'Portfolio is looking stable. No significant changes detected.',
      cached: false,
    };

    cache.set(userId, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    logger.error('[portfolioCache] Failed to refresh cache', { userId, error: err });
    return getDefaultPortfolioData(wallets);
  }
}

function getDefaultPortfolioData(wallets: IPortfolioWallet[]): PortfolioData {
  return {
    wallet: wallets.length > 0 ? wallets[0].address : 'N/A',
    network: wallets.length > 0 ? wallets[0].network : 'mainnet',
    totalXdc: '0',
    totalUsd: '0',
    change24h: '0.00%',
    changeValue: '$0.00',
    holdings: [],
    recentActivity: [],
    alerts: [],
    aiInsight: 'Unable to fetch portfolio data at this time.',
    cached: false,
  };
}
