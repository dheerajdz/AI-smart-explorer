export interface WalletMetrics {
  accountAgeDays: number;
  totalTransactions: number;
  incomingTx: number;
  outgoingTx: number;
  uniqueCounterparties: number;
  avgTransactionValue: number;
  maxTransactionValue: number;
  minTransactionValue: number;
  failedTransactions: number;
  contractInteractions: number;
  tokenTransfers: number;
  balanceXDC: string;
  lastActivityDays: number;
  activityFrequency: number;
  totalVolumeXDC: number;
  successRate: number;
}

export interface WalletReputationData {
  address: string;
  network: 'xdc' | 'xdc-testnet';
  score: number;
  tier: string;
  metrics: WalletMetrics;
  badges: string[];
  analyzedAt: string;
}

export type WalletBadge =
  | 'whale'
  | 'early_adopter'
  | 'power_user'
  | 'validator'
  | 'high_roller'
  | 'consistent';

export interface CacheEntry {
  data: WalletReputationData;
  cachedAt: number;
}
