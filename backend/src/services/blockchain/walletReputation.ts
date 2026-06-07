import { logger } from '../../utils/logger';
import { WalletReputationData, WalletMetrics, WalletBadge } from '../../types/walletReputation';
import { getCachedReputation, setCachedReputation } from '../cache/reputationCache';

// ─── API Configuration ─────────────────────────────────────────────

const XDCSCAN_MAINNET = 'https://api.xdcscan.io/api';
const XDCSCAN_TESTNET = 'https://api-apothem.xdcscan.io/api';

const BLOCKSCOUT_MAINNET = 'https://xdc.blockscout.com/api';
const BLOCKSCOUT_TESTNET = 'https://apothem.blockscout.com/api';

const RPC_NODES = [
  'https://rpc.xinfin.network',
  'https://rpc.xdcrpc.com',
  'https://rpc.xdc.org',
];

const RPC_TESTNET = 'https://rpc.apothem.network';

// ─── Types ─────────────────────────────────────────────────────────

interface XDCScanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError?: string;
  input?: string;
  gasUsed?: string;
  txreceipt_status?: string;
}

interface RawTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  isError: boolean;
  input: string;
  gasUsed: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

function normalizeAddress(address: string): string {
  if (address.toLowerCase().startsWith('xdc')) {
    return '0x' + address.slice(3);
  }
  return address.toLowerCase();
}

function withXdcPrefix(address: string): string {
  if (address.toLowerCase().startsWith('0x')) {
    return 'xdc' + address.slice(2);
  }
  return address;
}

function isValidAddress(address: string): boolean {
  const xdcRegex = /^xdc[a-fA-F0-9]{40}$/;
  const ethRegex = /^0x[a-fA-F0-9]{40}$/;
  return xdcRegex.test(address) || ethRegex.test(address);
}

async function fetchJSON(url: string, timeoutMs = 15000): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── API Fetchers ──────────────────────────────────────────────────

async function fetchXDCScan(
  network: 'mainnet' | 'testnet',
  params: string
): Promise<any> {
  const base = network === 'mainnet' ? XDCSCAN_MAINNET : XDCSCAN_TESTNET;
  const url = `${base}?${params}`;
  const data = await fetchJSON(url);
  if (data.status !== '1' && data.message !== 'No transactions found') {
    throw new Error(`XDCScan error: ${data.message}`);
  }
  return data.result;
}

async function fetchBlockscout(
  network: 'mainnet' | 'testnet',
  path: string
): Promise<any> {
  const base = network === 'mainnet' ? BLOCKSCOUT_MAINNET : BLOCKSCOUT_TESTNET;
  return fetchJSON(`${base}${path}`);
}

async function fetchRPC(
  network: 'mainnet' | 'testnet',
  method: string,
  params: any[]
): Promise<any> {
  const nodes = network === 'mainnet' ? RPC_NODES : [RPC_TESTNET];
  const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });

  for (const url of nodes) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10000),
      });
      const data: any = await res.json();
      if (data.result !== undefined) return data.result;
    } catch (err) {
      logger.warn('RPC node failed', { url, method, error: (err as Error).message });
    }
  }
  throw new Error('All RPC nodes failed');
}

// ─── Data Fetching ─────────────────────────────────────────────────

async function fetchAllTransactions(
  address: string,
  network: 'mainnet' | 'testnet'
): Promise<RawTx[]> {
  const txs: RawTx[] = [];

  // Try XDCScan first with pagination (max 1000 txs for performance)
  try {
    const result = await fetchXDCScan(
      network,
      `module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&page=1&offset=100`
    );
    if (Array.isArray(result)) {
      // Limit to first 100 transactions for performance
      const limited = result.slice(0, 100);
      limited.forEach((tx: XDCScanTx) => {
        txs.push({
          hash: tx.hash,
          from: (tx.from || '').toLowerCase(),
          to: (tx.to || '').toLowerCase(),
          value: tx.value,
          timestamp: parseInt(tx.timeStamp, 10) * 1000,
          isError: tx.isError === '1' || tx.txreceipt_status === '0',
          input: tx.input || '0x',
          gasUsed: tx.gasUsed || '0',
        });
      });
    }
  } catch (err) {
    logger.warn('XDCScan txlist failed, trying Blockscout', {
      address,
      error: (err as Error).message,
    });

    // Fallback to Blockscout
    try {
      const data = await fetchBlockscout(
        network,
        `/v2/addresses/${address}/transactions`
      );
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((tx: any) => {
          txs.push({
            hash: tx.hash,
            from: (tx.from?.hash || '').toLowerCase(),
            to: (tx.to?.hash || '').toLowerCase(),
            value: tx.value || '0',
            timestamp: new Date(tx.timestamp).getTime(),
            isError: tx.result === 'error' || tx.status === 'error',
            input: tx.raw_input || '0x',
            gasUsed: tx.gas_used || '0',
          });
        });
      }
    } catch (err2) {
      logger.warn('Blockscout txlist also failed', {
        address,
        error: (err2 as Error).message,
      });
    }
  }

  return txs;
}

async function fetchBalance(
  address: string,
  network: 'mainnet' | 'testnet'
): Promise<string> {
  // Try XDCScan
  try {
    const result = await fetchXDCScan(
      network,
      `module=account&action=balance&address=${address}&tag=latest`
    );
    return result;
  } catch {
    // Fallback to RPC
    try {
      const result = await fetchRPC(network, 'eth_getBalance', [address, 'latest']);
      // RPC returns hex
      return BigInt(result).toString();
    } catch (err) {
      logger.warn('Balance fetch failed', { address, error: (err as Error).message });
      return '0';
    }
  }
}

async function fetchTokenTransfers(
  address: string,
  network: 'mainnet' | 'testnet'
): Promise<number> {
  try {
    const result = await fetchXDCScan(
      network,
      `module=account&action=tokentx&address=${address}&sort=asc`
    );
    return Array.isArray(result) ? result.length : 0;
  } catch {
    return 0;
  }
}

// ─── Scoring ───────────────────────────────────────────────────────

function calculateScore(metrics: WalletMetrics): number {
  let score = 0;

  // Account age (max 15 pts) — 1 pt per 30 days, capped at 15
  score += Math.min(15, metrics.accountAgeDays / 30);

  // Transaction count (max 20 pts) — 1 pt per 5 txs, capped at 20
  score += Math.min(20, metrics.totalTransactions / 5);

  // Success rate (max 15 pts) — linear from 0 failed = 15 pts
  const successRate =
    metrics.totalTransactions > 0
      ? 1 - metrics.failedTransactions / metrics.totalTransactions
      : 1;
  score += successRate * 15;

  // Volume (max 10 pts) — logarithmic
  score += Math.min(10, Math.log10(metrics.totalVolumeXDC + 1) * 2);

  // Whale score / balance (max 10 pts) — logarithmic
  const balance = parseFloat(metrics.balanceXDC);
  score += Math.min(10, Math.log10(balance + 1) * 2);

  // Activity recency (max 15 pts)
  if (metrics.lastActivityDays <= 7) score += 15;
  else if (metrics.lastActivityDays <= 30) score += 10;
  else if (metrics.lastActivityDays <= 90) score += 5;

  // Counterparty diversity (max 10 pts) — 1 pt per 3 unique, capped at 10
  score += Math.min(10, metrics.uniqueCounterparties / 3);

  // Penalties
  if (metrics.lastActivityDays > 90 && metrics.accountAgeDays > 90) score -= 5;
  if (metrics.lastActivityDays > 180 && metrics.accountAgeDays > 180) score -= 10;
  if (metrics.totalTransactions > 0 && metrics.failedTransactions / metrics.totalTransactions > 0.1)
    score -= 5;
  if (metrics.totalTransactions > 0 && metrics.failedTransactions / metrics.totalTransactions > 0.25)
    score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getTier(score: number): string {
  if (score >= 90) return '🏆 Legendary';
  if (score >= 75) return '👑 Elite';
  if (score >= 60) return '⚔️ Veteran';
  if (score >= 40) return '🔍 Explorer';
  if (score >= 20) return '🌱 Newcomer';
  return '⚪ Unverified';
}

function getBadges(metrics: WalletMetrics): string[] {
  const badges: WalletBadge[] = [];

  if (parseFloat(metrics.balanceXDC) >= 100000) badges.push('whale');
  if (metrics.accountAgeDays >= 365) badges.push('early_adopter');
  if (metrics.totalTransactions >= 100) badges.push('power_user');
  if (metrics.contractInteractions >= 10) badges.push('validator');
  if (metrics.maxTransactionValue >= 10000) badges.push('high_roller');
  if (metrics.activityFrequency >= 1 && metrics.lastActivityDays <= 7)
    badges.push('consistent');

  return badges;
}

// ─── Main Analyzer ─────────────────────────────────────────────────

export async function analyzeWalletReputation(
  address: string
): Promise<WalletReputationData> {
  if (!isValidAddress(address)) {
    throw new Error('Invalid wallet address format');
  }

  const normalizedAddr = normalizeAddress(address);
  const displayAddr = withXdcPrefix(address);

  // Check cache
  const cached = await getCachedReputation(normalizedAddr);
  if (cached) {
    logger.info('Wallet reputation served from cache', { address: displayAddr });
    return cached;
  }

  // Detect network: try mainnet first
  let network: 'xdc' | 'xdc-testnet' = 'xdc';
  let txs: RawTx[] = [];
  let balance = '0';
  let tokenTransfers = 0;

  try {
    [txs, balance, tokenTransfers] = await Promise.all([
      fetchAllTransactions(normalizedAddr, 'mainnet'),
      fetchBalance(normalizedAddr, 'mainnet'),
      fetchTokenTransfers(normalizedAddr, 'mainnet'),
    ]);
  } catch (err) {
    logger.warn('Mainnet fetch failed, trying testnet', {
      address: displayAddr,
      error: (err as Error).message,
    });
    network = 'xdc-testnet';
    [txs, balance, tokenTransfers] = await Promise.all([
      fetchAllTransactions(normalizedAddr, 'testnet'),
      fetchBalance(normalizedAddr, 'testnet'),
      fetchTokenTransfers(normalizedAddr, 'testnet'),
    ]);
  }

  // Compute metrics
  const now = Date.now();
  const timestamps = txs.map((t) => t.timestamp).sort((a, b) => a - b);

  const firstTxTimestamp = timestamps.length > 0 ? timestamps[0] : now;
  const lastTxTimestamp = timestamps.length > 0 ? timestamps[timestamps.length - 1] : now;

  const accountAgeDays = Math.floor((now - firstTxTimestamp) / (1000 * 60 * 60 * 24));
  const lastActivityDays = Math.floor((now - lastTxTimestamp) / (1000 * 60 * 60 * 24));

  const incomingTx = txs.filter((tx) => tx.to === normalizedAddr).length;
  const outgoingTx = txs.filter((tx) => tx.from === normalizedAddr).length;

  const counterparties = new Set<string>();
  txs.forEach((tx) => {
    if (tx.from) counterparties.add(tx.from);
    if (tx.to) counterparties.add(tx.to);
  });
  counterparties.delete(normalizedAddr);

  const values = txs
    .map((tx) => parseFloat(tx.value) / 1e18)
    .filter((v) => !isNaN(v));

  const totalVolumeXDC = values.reduce((a, b) => a + b, 0);
  const avgTransactionValue = values.length > 0 ? totalVolumeXDC / values.length : 0;
  const maxTransactionValue = values.length > 0 ? Math.max(...values) : 0;
  const minTransactionValue = values.length > 0 ? Math.min(...values) : 0;

  const failedTransactions = txs.filter((tx) => tx.isError).length;

  const contractInteractions = txs.filter(
    (tx) => tx.input && tx.input !== '0x' && tx.input.length > 10
  ).length;

  const weeksActive = Math.max(1, accountAgeDays / 7);
  const activityFrequency = txs.length / weeksActive;

  const balanceXDC = (parseFloat(balance) / 1e18).toFixed(4);

  const metrics: WalletMetrics = {
    accountAgeDays,
    totalTransactions: txs.length,
    incomingTx,
    outgoingTx,
    uniqueCounterparties: counterparties.size,
    avgTransactionValue,
    maxTransactionValue,
    minTransactionValue,
    failedTransactions,
    contractInteractions,
    tokenTransfers,
    balanceXDC,
    lastActivityDays,
    activityFrequency: Math.round(activityFrequency * 10) / 10,
    totalVolumeXDC,
    successRate:
      txs.length > 0
        ? Math.round(((txs.length - failedTransactions) / txs.length) * 100)
        : 100,
  };

  const score = calculateScore(metrics);
  const tier = getTier(score);
  const badges = getBadges(metrics);

  const result: WalletReputationData = {
    address: displayAddr,
    network,
    score,
    tier,
    metrics,
    badges,
    analyzedAt: new Date().toISOString(),
  };

  // Cache result
  await setCachedReputation(normalizedAddr, result);

  logger.info('Wallet reputation analyzed', {
    address: displayAddr,
    network,
    score,
    tier,
    txs: txs.length,
  });

  return result;
}

// ─── Formatter ─────────────────────────────────────────────────────

export function formatReputationMessage(data: WalletReputationData): string {
  const m = data.metrics;

  const badgeLine =
    data.badges.length > 0
      ? '\n🏅 *Badges:* ' + data.badges.map((b) => `\`${b}\``).join(' ') + '\n'
      : '';

  return (
    `💎 *Wallet Reputation*\n\n` +
    `*Address:*\n\`${data.address}\`\n\n` +
    `*Score:* ${data.score}/100\n` +
    `*Tier:* ${data.tier}\n` +
    `*Network:* ${data.network === 'xdc' ? 'XDC Mainnet' : 'XDC Testnet'}\n` +
    badgeLine +
    `\n*📊 Metrics*\n` +
    `• Account Age: ${m.accountAgeDays} days\n` +
    `• Total Transactions: ${m.totalTransactions}\n` +
    `• Incoming: ${m.incomingTx} | Outgoing: ${m.outgoingTx}\n` +
    `• Unique Counterparties: ${m.uniqueCounterparties}\n` +
    `• Balance: ${m.balanceXDC} XDC\n` +
    `• Last Activity: ${m.lastActivityDays} days ago\n` +
    `• Activity: ${m.activityFrequency} tx/week\n` +
    `• Success Rate: ${m.successRate}%\n\n` +
    `*📈 Transaction Details*\n` +
    `• Total Volume: ${m.totalVolumeXDC.toFixed(4)} XDC\n` +
    `• Avg Value: ${m.avgTransactionValue.toFixed(4)} XDC\n` +
    `• Max Value: ${m.maxTransactionValue.toFixed(4)} XDC\n` +
    `• Min Value: ${m.minTransactionValue.toFixed(4)} XDC\n` +
    `• Failed: ${m.failedTransactions}\n` +
    `• Contract Interactions: ${m.contractInteractions}\n` +
    `• Token Transfers: ${m.tokenTransfers}\n\n` +
    `⏱️ Analyzed: ${new Date(data.analyzedAt).toLocaleString()}`
  );
}

export { isValidAddress };
