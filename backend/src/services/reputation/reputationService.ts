import { WalletReputationModel, IWalletReputation } from '../../models/WalletReputation';
import { calculateReputation, ReputationResult } from './reputationCalculator';
import { getWalletBalance } from '../blockchain';
import { getTransactions } from '../blockchain';
import { logger } from '../../utils/logger';
import { isValidXdcAddress } from '../../utils/network';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ReputationReport {
  address: string;
  network: 'mainnet' | 'testnet';
  overallScore: number;
  tier: string;
  metrics: IWalletReputation['metrics'];
  badges: string[];
  rank?: number;
  totalRanked?: number;
  lastUpdated: Date;
}

/**
 * Get or calculate wallet reputation
 */
export async function getReputation(
  address: string,
  network: 'mainnet' | 'testnet' = 'mainnet',
  forceRefresh = false
): Promise<ReputationReport | null> {
  if (!isValidXdcAddress(address)) {
    logger.warn('[reputationService] Invalid address', { address });
    return null;
  }

  const normalizedAddress = address.toLowerCase();

  // Check cache
  if (!forceRefresh) {
    const cached = await WalletReputationModel.findOne({
      address: normalizedAddress,
      network,
    });

    if (cached && Date.now() - cached.lastUpdated.getTime() < CACHE_TTL_MS) {
      logger.info('[reputationService] Returning cached reputation', {
        address: normalizedAddress,
        score: cached.overallScore,
      });
      return formatReport(cached);
    }
  }

  // Calculate fresh
  return await calculateAndSave(normalizedAddress, network);
}

/**
 * Force refresh reputation for a wallet
 */
export async function refreshReputation(
  address: string,
  network: 'mainnet' | 'testnet' = 'mainnet'
): Promise<ReputationReport | null> {
  return getReputation(address, network, true);
}

/**
 * Get top wallets by reputation score
 */
export async function getLeaderboard(
  network: 'mainnet' | 'testnet' = 'mainnet',
  limit = 10
): Promise<ReputationReport[]> {
  const wallets = await WalletReputationModel.find({ network })
    .sort({ overallScore: -1 })
    .limit(limit);

  const totalRanked = await WalletReputationModel.countDocuments({ network });

  return wallets.map((w, index) => ({
    ...formatReport(w),
    rank: index + 1,
    totalRanked,
  }));
}

/**
 * Get reputation tier based on score
 */
export function getTier(score: number): string {
  if (score >= 90) return 'Legendary';
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Established';
  if (score >= 60) return 'Trusted';
  if (score >= 50) return 'Active';
  if (score >= 40) return 'Growing';
  if (score >= 30) return 'Newcomer';
  return 'Unknown';
}

/**
 * Get tier emoji
 */
export function getTierEmoji(tier: string): string {
  switch (tier) {
    case 'Legendary': return '👑';
    case 'Elite': return '💎';
    case 'Established': return '🏆';
    case 'Trusted': return '✅';
    case 'Active': return '🔥';
    case 'Growing': return '🌱';
    case 'Newcomer': return '🆕';
    default: return '❓';
  }
}

// ── Internal helpers ──────────────────────────────────────────

async function calculateAndSave(
  address: string,
  network: 'mainnet' | 'testnet'
): Promise<ReputationReport | null> {
  try {
    logger.info('[reputationService] Calculating reputation', { address, network });

    // Fetch wallet data
    const [balanceResult, txResult] = await Promise.all([
      getWalletBalance(address, network),
      getTransactions(address, network, 1, 100), // Get up to 100 txs
    ]);

    const balanceXDC = parseFloat(balanceResult.balanceXDC);

    // Map transactions to reputation input format
    const transactions = txResult.transactions.map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      status: tx.status || 'success',
      timestamp: tx.timestamp,
      isContractInteraction: tx.isContractInteraction || false,
    }));

    // Calculate reputation
    const result = calculateReputation({
      transactions,
      balanceXDC,
      address,
      network,
    });

    // Save to DB
    const saved = await WalletReputationModel.findOneAndUpdate(
      { address, network },
      {
        $set: {
          overallScore: result.overallScore,
          metrics: result.metrics,
          badges: result.badges,
          lastUpdated: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    logger.info('[reputationService] Reputation saved', {
      address,
      score: result.overallScore,
      badges: result.badges,
    });

    return formatReport(saved);
  } catch (err) {
    logger.error('[reputationService] Failed to calculate reputation', {
      address,
      error: err,
    });
    return null;
  }
}

function formatReport(wallet: IWalletReputation): ReputationReport {
  const tier = getTier(wallet.overallScore);

  return {
    address: wallet.address,
    network: wallet.network,
    overallScore: wallet.overallScore,
    tier,
    metrics: wallet.metrics,
    badges: wallet.badges,
    lastUpdated: wallet.lastUpdated,
  };
}
