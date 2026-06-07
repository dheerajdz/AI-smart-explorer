import { IWalletReputationMetrics } from '../../models/WalletReputation';
import { logger } from '../../utils/logger';

export interface ReputationInput {
  transactions: Array<{
    hash: string;
    from: string;
    to: string;
    value: string;
    status: string;
    timestamp: string;
    isContractInteraction?: boolean;
  }>;
  balanceXDC: number;
  address: string;
  network: 'mainnet' | 'testnet';
}

export interface ReputationResult {
  overallScore: number;
  metrics: IWalletReputationMetrics;
  badges: string[];
}

// Scoring weights (must sum to 1.0)
const WEIGHTS = {
  accountAge: 0.15,
  transactionVolume: 0.20,
  transactionCount: 0.15,
  successRate: 0.20,
  contractInteractions: 0.15,
  whaleScore: 0.15,
};

// Badge thresholds
const BADGE_THRESHOLDS = {
  whale: { minBalance: 1_000_000 },           // 1M XDC
  earlyAdopter: { minAgeDays: 730 },           // 2 years
  powerUser: { minTxCount: 1000 },
  contractDeployer: { minContracts: 1 },
  validator: { minTxCount: 500, maxFailRatio: 0.01 },
  newcomer: { maxAgeDays: 30 },
  highRoller: { minMaxTxValue: 100_000 },      // 100K XDC single tx
  consistent: { minTxCount: 100, minAgeDays: 365 },
};

/**
 * Calculate reputation score from wallet data
 */
export function calculateReputation(input: ReputationInput): ReputationResult {
  const { transactions, balanceXDC, address } = input;

  logger.info('[reputationCalculator] Calculating reputation', {
    address,
    txCount: transactions.length,
    balance: balanceXDC,
  });

  // ── Basic metrics ───────────────────────────────────────────
  const sortedTxs = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstTxDate = sortedTxs.length > 0 ? new Date(sortedTxs[0].timestamp) : undefined;
  const lastTxDate = sortedTxs.length > 0 ? new Date(sortedTxs[sortedTxs.length - 1].timestamp) : undefined;

  const accountAgeDays = firstTxDate
    ? Math.floor((Date.now() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const transactionCount = transactions.length;

  const totalVolumeXDC = transactions.reduce(
    (sum, tx) => sum + parseFloat(tx.value) / 1e18,
    0
  );

  const failedTxs = transactions.filter((tx) => tx.status === 'failed');
  const failedTxRatio = transactionCount > 0 ? failedTxs.length / transactionCount : 0;

  const contractInteractions = transactions.filter(
    (tx) => tx.isContractInteraction || tx.to?.startsWith('0x') // Simplified check
  ).length;

  const verifiedContracts = 0; // Would need contract verification API

  const counterparties = new Set([
    ...transactions.map((tx) => tx.from.toLowerCase()),
    ...transactions.map((tx) => tx.to.toLowerCase()),
  ]);
  counterparties.delete(address.toLowerCase());
  const uniqueCounterparties = counterparties.size;

  const avgTxValueXDC = transactionCount > 0 ? totalVolumeXDC / transactionCount : 0;

  const maxTxValueXDC = transactions.length > 0
    ? Math.max(...transactions.map((tx) => parseFloat(tx.value) / 1e18))
    : 0;

  // ── Whale score (0-100) ─────────────────────────────────────
  const whaleScore = calculateWhaleScore(balanceXDC);

  // ── Sub-scores (0-100 each) ─────────────────────────────────
  const accountAgeScore = Math.min((accountAgeDays / 365) * 50, 100); // 2 years = 100

  const volumeScore = Math.min(Math.log10(totalVolumeXDC + 1) * 20, 100); // Log scale

  const countScore = Math.min(transactionCount / 10, 100); // 1000 txs = 100

  const successRateScore = (1 - failedTxRatio) * 100;

  const contractScore = Math.min(contractInteractions / 5, 100); // 500 interactions = 100

  // ── Composite score ─────────────────────────────────────────
  const overallScore = Math.round(
    accountAgeScore * WEIGHTS.accountAge +
    volumeScore * WEIGHTS.transactionVolume +
    countScore * WEIGHTS.transactionCount +
    successRateScore * WEIGHTS.successRate +
    contractScore * WEIGHTS.contractInteractions +
    whaleScore * WEIGHTS.whaleScore
  );

  // ── Badges ──────────────────────────────────────────────────
  const badges = assignBadges({
    balanceXDC,
    accountAgeDays,
    transactionCount,
    failedTxRatio,
    verifiedContracts,
    maxTxValueXDC,
  });

  const metrics: IWalletReputationMetrics = {
    accountAgeDays,
    transactionCount,
    totalVolumeXDC: Math.round(totalVolumeXDC * 1000) / 1000,
    failedTxRatio: Math.round(failedTxRatio * 1000) / 1000,
    contractInteractions,
    verifiedContracts,
    uniqueCounterparties,
    avgTxValueXDC: Math.round(avgTxValueXDC * 1000) / 1000,
    maxTxValueXDC: Math.round(maxTxValueXDC * 1000) / 1000,
    whaleScore,
    firstTxDate,
    lastTxDate,
  };

  logger.info('[reputationCalculator] Reputation calculated', {
    address,
    overallScore,
    badges,
  });

  return {
    overallScore: Math.min(Math.max(overallScore, 0), 100),
    metrics,
    badges,
  };
}

function calculateWhaleScore(balanceXDC: number): number {
  // Logarithmic scale: 100 XDC = 20, 1K = 40, 10K = 60, 100K = 80, 1M = 100
  const score = Math.log10(balanceXDC + 1) * 16.67;
  return Math.min(Math.round(score), 100);
}

function assignBadges(params: {
  balanceXDC: number;
  accountAgeDays: number;
  transactionCount: number;
  failedTxRatio: number;
  verifiedContracts: number;
  maxTxValueXDC: number;
}): string[] {
  const badges: string[] = [];
  const t = BADGE_THRESHOLDS;

  if (params.balanceXDC >= t.whale.minBalance) badges.push('whale');
  if (params.accountAgeDays >= t.earlyAdopter.minAgeDays) badges.push('early_adopter');
  if (params.transactionCount >= t.powerUser.minTxCount) badges.push('power_user');
  if (params.verifiedContracts >= t.contractDeployer.minContracts) badges.push('contract_deployer');
  if (
    params.transactionCount >= t.validator.minTxCount &&
    params.failedTxRatio <= t.validator.maxFailRatio
  ) badges.push('validator');
  if (params.accountAgeDays <= t.newcomer.maxAgeDays) badges.push('newcomer');
  if (params.maxTxValueXDC >= t.highRoller.minMaxTxValue) badges.push('high_roller');
  if (
    params.transactionCount >= t.consistent.minTxCount &&
    params.accountAgeDays >= t.consistent.minAgeDays
  ) badges.push('consistent');

  return badges;
}
