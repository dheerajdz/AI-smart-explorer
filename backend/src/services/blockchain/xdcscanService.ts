import axios, { AxiosError } from 'axios';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { Network, getExplorerBaseUrl, getAddressExplorerUrl, isValidXdcAddress } from '../../utils/network';

// ─── Circuit Breaker State ───────────────────────────────────

interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number | null;
  isOpen: boolean;
}

const FAILURE_THRESHOLD = 5;
const COOLDOWN_PERIOD_MS = 60000; // 1 minute

const circuitBreaker: CircuitBreakerState = {
  failureCount: 0,
  lastFailureTime: null,
  isOpen: false,
};

function isCircuitOpen(): boolean {
  if (!circuitBreaker.isOpen) return false;
  
  // Check if cooldown has elapsed
  if (circuitBreaker.lastFailureTime && 
      Date.now() - circuitBreaker.lastFailureTime > COOLDOWN_PERIOD_MS) {
    logger.info('[circuitBreaker] Cooldown elapsed, resetting circuit');
    circuitBreaker.isOpen = false;
    circuitBreaker.failureCount = 0;
    return false;
  }
  
  return true;
}

function recordSuccess(): void {
  circuitBreaker.failureCount = 0;
  circuitBreaker.isOpen = false;
}

function recordFailure(): void {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = Date.now();
  
  if (circuitBreaker.failureCount >= FAILURE_THRESHOLD) {
    circuitBreaker.isOpen = true;
    logger.error(`[circuitBreaker] Circuit OPEN after ${FAILURE_THRESHOLD} failures`);
  }
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  fallback?: () => T
): Promise<T> {
  if (isCircuitOpen()) {
    logger.warn('[circuitBreaker] Circuit is OPEN, rejecting request');
    if (fallback) {
      return fallback();
    }
    throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
  }

  try {
    const result = await fn();
    recordSuccess();
    return result;
  } catch (error) {
    recordFailure();
    throw error;
  }
}

// ─── Config ─────────────────────────────────────────────────

function getXdcscanBaseUrl(network: Network = 'mainnet'): string {
  if (network === 'testnet') {
    return 'https://rpc.apothem.network';
  }
  return env.XDCSCAN_API;
}

function createXdcscanClient(network: Network = 'mainnet') {
  return axios.create({
    baseURL: getXdcscanBaseUrl(network),
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Sanitize and validate blockchain address.
 * Returns sanitized address or null if invalid.
 */
function sanitizeAddress(address: string): string | null {
  if (!address || typeof address !== 'string') return null;
  const trimmed = address.trim();
  if (!isValidXdcAddress(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * JSON-RPC call for testnet balance with circuit breaker
 */
async function getTestnetBalance(address: string): Promise<string> {
  const rpcAddress = address.startsWith('txdc') 
    ? '0x' + address.slice(4) 
    : address;
    
  return withCircuitBreaker(async () => {
    const response = await axios.post('https://rpc.apothem.network', {
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [rpcAddress, 'latest'],
      id: 1,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    const result = response.data?.result;
    if (result) {
      return BigInt(result).toString();
    }
    return '0';
  }, () => '0');
}

// ─── Types ──────────────────────────────────────────────────

export interface WalletBalanceResponse {
  address: string;
  balance: string;
  balanceXDC: string;
  network: Network;
  timestamp: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  timestamp: number;
  status: 'success' | 'failed' | 'pending';
  blockNumber: number;
}

export interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  token: string;
  tokenSymbol: string;
  value: string;
  timestamp: number;
  blockNumber: number;
}

export interface WalletActivity {
  transactions: Transaction[];
  tokenTransfers: TokenTransfer[];
  totalCount: number;
}

export interface LargeTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueXDC: string;
  timestamp: number;
  blockNumber: number;
}

// ─── Wallet Balance ─────────────────────────────────────────

export async function getWalletBalance(
  address: string,
  network: Network = 'mainnet'
): Promise<WalletBalanceResponse | null> {
  const sanitized = sanitizeAddress(address);
  if (!sanitized) {
    logger.warn('[xdcscanService] Invalid address', { address });
    return null;
  }

  try {
    if (network === 'testnet') {
      const balance = await getTestnetBalance(sanitized);
      return {
        address: sanitized,
        balance,
        balanceXDC: (Number(balance) / 1e18).toFixed(4),
        network,
        timestamp: Date.now(),
      };
    }

    return withCircuitBreaker(async () => {
      const client = createXdcscanClient(network);
      const response = await client.get('/account', {
        params: {
          address: sanitized,
        },
      });

      const data = response.data;
      if (!data || data.status !== '1') {
        logger.warn('[xdcscanService] API error', { address: sanitized, result: data?.result });
        return null;
      }

      const balance = data.result?.balance || '0';
      
      return {
        address: sanitized,
        balance,
        balanceXDC: (Number(balance) / 1e18).toFixed(4),
        network,
        timestamp: Date.now(),
      };
    }, () => null);

  } catch (error) {
    logger.error('[xdcscanService] Failed to fetch balance', { address: sanitized, error });
    return null;
  }
}

// ─── Wallet Transactions ──────────────────────────────────────

export async function getWalletTransactions(
  address: string,
  network: Network = 'mainnet',
  page: number = 1,
  offset: number = 20
): Promise<WalletActivity | null> {
  const sanitized = sanitizeAddress(address);
  if (!sanitized) {
    logger.warn('[xdcscanService] Invalid address for transactions', { address });
    return null;
  }

  try {
    return withCircuitBreaker(async () => {
      const client = createXdcscanClient(network);
      
      const [txResponse, tokenResponse] = await Promise.all([
        client.get('/transactions', {
          params: {
            address: sanitized,
            page,
            offset,
          },
        }),
        client.get('/tokentxns', {
          params: {
            address: sanitized,
            page,
            offset,
          },
        }),
      ]);

      const txData = txResponse.data;
      const tokenData = tokenResponse.data;

      if (!txData || txData.status !== '1') {
        logger.warn('[xdcscanService] Transaction API error', { address: sanitized });
        return null;
      }

      const transactions: Transaction[] = (txData.result || []).map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        timestamp: parseInt(tx.timeStamp) * 1000,
        status: tx.txreceipt_status === '1' ? 'success' : 'failed',
        blockNumber: parseInt(tx.blockNumber),
      }));

      const tokenTransfers: TokenTransfer[] = (tokenData.result || []).map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        token: tx.contractAddress,
        tokenSymbol: tx.tokenSymbol,
        value: tx.value,
        timestamp: parseInt(tx.timeStamp) * 1000,
        blockNumber: parseInt(tx.blockNumber),
      }));

      return {
        transactions,
        tokenTransfers,
        totalCount: parseInt(txData.result?.length || '0') + parseInt(tokenData.result?.length || '0'),
      };
    }, () => null);

  } catch (error) {
    logger.error('[xdcscanService] Failed to fetch transactions', { address: sanitized, error });
    return null;
  }
}

// ─── Large Transfer Detection ───────────────────────────────

export async function detectLargeTransfers(
  address: string,
  network: Network = 'mainnet',
  thresholdXDC: number = 10000
): Promise<LargeTransfer[]> {
  const sanitized = sanitizeAddress(address);
  if (!sanitized) {
    logger.warn('[xdcscanService] Invalid address for large transfer detection', { address });
    return [];
  }

  try {
    return withCircuitBreaker(async () => {
      const client = createXdcscanClient(network);
      const response = await client.get('/transactions', {
        params: {
          address: sanitized,
          page: 1,
          offset: 100, // Get more transactions to filter
        },
      });

      const data = response.data;
      if (!data || data.status !== '1') {
        return [];
      }

      const thresholdWei = BigInt(thresholdXDC) * BigInt(1e18);
      
      const largeTransfers: LargeTransfer[] = (data.result || [])
        .filter((tx: any) => {
          const value = BigInt(tx.value || '0');
          return value >= thresholdWei;
        })
        .map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          valueXDC: (Number(tx.value) / 1e18).toFixed(4),
          timestamp: parseInt(tx.timeStamp) * 1000,
          blockNumber: parseInt(tx.blockNumber),
        }));

      return largeTransfers;
    }, () => []);

  } catch (error) {
    logger.error('[xdcscanService] Failed to detect large transfers', { address: sanitized, error });
    return [];
  }
}

// ─── Health Check ────────────────────────────────────────────

export function getCircuitBreakerStatus(): { isOpen: boolean; failureCount: number; lastFailure: number | null } {
  return {
    isOpen: circuitBreaker.isOpen,
    failureCount: circuitBreaker.failureCount,
    lastFailure: circuitBreaker.lastFailureTime,
  };
}

export function resetCircuitBreaker(): void {
  circuitBreaker.isOpen = false;
  circuitBreaker.failureCount = 0;
  circuitBreaker.lastFailureTime = null;
  logger.info('[circuitBreaker] Manually reset');
}

export { sanitizeAddress, getXdcscanBaseUrl, createXdcscanClient };
