// ============================================================
// xdcscanService.ts
// XDCScan API integration for wallet data, transactions,
// activity tracking, and large transfer detection.
//
// XDCScan API Docs: https://xdcscan.io/apis
// Base URL: https://api.xdcscan.io/api
// ============================================================

import axios, { AxiosError } from 'axios';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// ─── Config ─────────────────────────────────────────────────

const XDCSCAN_BASE_URL = env.XDCSCAN_API || 'https://api.xdcscan.io/api';

const xdcscanClient = axios.create({
  baseURL: XDCSCAN_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Types ──────────────────────────────────────────────────

export interface WalletBalanceResponse {
  address: string;
  balance: string;          // in wei
  balanceXDC: string;       // formatted
  source: 'xdcscan';
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
  blockNumber: string;
  input: string;
  isContractCreation: boolean;
}

export interface TransactionsResponse {
  address: string;
  transactions: Transaction[];
  totalCount: number;
  source: 'xdcscan';
}

export interface WalletActivity {
  address: string;
  totalTransactions: number;
  firstSeen: string | null;
  lastSeen: string | null;
  uniqueContractsInteracted: number;
  uniqueWalletsInteracted: number;
  source: 'xdcscan';
}

export interface LargeTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueXDC: string;
  timestamp: string;
  blockNumber: string;
}

export interface LargeTransfersResponse {
  address: string;
  threshold: string;        // in XDC
  transfers: LargeTransfer[];
  totalCount: number;
  source: 'xdcscan';
}

// ─── Helper ─────────────────────────────────────────────────

/**
 * Convert wei to XDC (18 decimals).
 */
function weiToXDC(wei: string): string {
  try {
    const value = BigInt(wei);
    const xdc = Number(value) / 1e18;
    return xdc.toFixed(6);
  } catch {
    return '0';
  }
}

/**
 * Handle API errors consistently.
 */
function handleApiError(error: unknown, context: string): never {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError;
    logger.error(`[XDCScan] ${context} failed`, {
      status: axiosErr.response?.status,
      data: axiosErr.response?.data,
      message: axiosErr.message,
    });
  } else {
    logger.error(`[XDCScan] ${context} failed`, { error });
  }
  throw new Error(`XDCScan ${context} failed`);
}

// ─── 1. getWalletBalance ────────────────────────────────────

/**
 * Get XDC balance for a wallet address.
 *
 * @param address XDC wallet address (xdc... or 0x...)
 * @returns Balance in wei and formatted XDC
 */
export async function getWalletBalance(address: string): Promise<WalletBalanceResponse> {
  logger.info('[XDCScan] getWalletBalance', { address });

  try {
    const response = await xdcscanClient.get('', {
      params: {
        module: 'account',
        action: 'balance',
        address,
        tag: 'latest',
      },
    });

    const result = response.data?.result;

    if (result === undefined || result === null) {
      logger.warn('[XDCScan] Empty balance response', { address, data: response.data });
      return {
        address,
        balance: '0',
        balanceXDC: '0',
        source: 'xdcscan',
      };
    }

    const balance = String(result);
    const balanceXDC = weiToXDC(balance);

    logger.info('[XDCScan] Balance retrieved', { address, balanceXDC });

    return {
      address,
      balance,
      balanceXDC,
      source: 'xdcscan',
    };

  } catch (error) {
    return handleApiError(error, 'getWalletBalance');
  }
}

// ─── 2. getTransactions ─────────────────────────────────────

/**
 * Get transaction list for a wallet address.
 *
 * @param address XDC wallet address
 * @param page Page number (default 1)
 * @param offset Items per page (default 10)
 * @returns List of transactions
 */
export async function getTransactions(
  address: string,
  page: number = 1,
  offset: number = 10,
): Promise<TransactionsResponse> {
  logger.info('[XDCScan] getTransactions', { address, page, offset });

  try {
    const response = await xdcscanClient.get('', {
      params: {
        module: 'account',
        action: 'txlist',
        address,
        page,
        offset,
        sort: 'desc',
      },
    });

    const result = response.data?.result;

    if (!Array.isArray(result)) {
      logger.warn('[XDCScan] Empty txlist response', { address, data: response.data });
      return {
        address,
        transactions: [],
        totalCount: 0,
        source: 'xdcscan',
      };
    }

    const transactions: Transaction[] = result.map((tx: any) => ({
      hash: tx.hash || tx.transactionHash || '',
      from: tx.from || '',
      to: tx.to || '',
      value: tx.value || '0',
      gasUsed: tx.gasUsed || '0',
      gasPrice: tx.gasPrice || '0',
      timestamp: tx.timeStamp || tx.timestamp || '',
      status: tx.txreceipt_status === '1' || tx.status === '1'
        ? 'success'
        : tx.txreceipt_status === '0' || tx.status === '0'
          ? 'failed'
          : 'pending',
      blockNumber: tx.blockNumber || '',
      input: tx.input || '',
      isContractCreation: !tx.to || tx.to === '',
    }));

    logger.info('[XDCScan] Transactions retrieved', { address, count: transactions.length });

    return {
      address,
      transactions,
      totalCount: transactions.length,
      source: 'xdcscan',
    };

  } catch (error) {
    return handleApiError(error, 'getTransactions');
  }
}

// ─── 3. getWalletActivity ───────────────────────────────────

/**
 * Get comprehensive activity stats for a wallet.
 * Combines multiple API calls to build a profile.
 *
 * @param address XDC wallet address
 * @returns Activity summary
 */
export async function getWalletActivity(address: string): Promise<WalletActivity> {
  logger.info('[XDCScan] getWalletActivity', { address });

  try {
    // Get all transactions (first page with high offset for stats)
    const txResponse = await getTransactions(address, 1, 100);
    const transactions = txResponse.transactions;

    if (transactions.length === 0) {
      return {
        address,
        totalTransactions: 0,
        firstSeen: null,
        lastSeen: null,
        uniqueContractsInteracted: 0,
        uniqueWalletsInteracted: 0,
        source: 'xdcscan',
      };
    }

    // Calculate stats
    const uniqueTo = new Set(transactions.map(tx => tx.to).filter(Boolean));
    const uniqueFrom = new Set(transactions.map(tx => tx.from).filter(Boolean));
    const contractInteractions = transactions.filter(tx =>
      tx.input && tx.input !== '0x' && tx.input.length > 10,
    );

    const timestamps = transactions
      .map(tx => tx.timestamp)
      .filter(Boolean)
      .map(ts => parseInt(ts, 10))
      .filter(ts => !isNaN(ts));

    const firstSeen = timestamps.length > 0
      ? new Date(Math.min(...timestamps) * 1000).toISOString()
      : null;
    const lastSeen = timestamps.length > 0
      ? new Date(Math.max(...timestamps) * 1000).toISOString()
      : null;

    logger.info('[XDCScan] Activity stats built', {
      address,
      totalTransactions: transactions.length,
      uniqueContracts: contractInteractions.length,
    });

    return {
      address,
      totalTransactions: transactions.length,
      firstSeen,
      lastSeen,
      uniqueContractsInteracted: contractInteractions.length,
      uniqueWalletsInteracted: uniqueTo.size + uniqueFrom.size - 1, // exclude self
      source: 'xdcscan',
    };

  } catch (error) {
    return handleApiError(error, 'getWalletActivity');
  }
}

// ─── 4. getLargeTransfers ───────────────────────────────────

/**
 * Detect large token/XDC transfers for a wallet.
 * Filters transactions above a threshold.
 *
 * @param address XDC wallet address
 * @param thresholdXDC Minimum transfer value in XDC (default 1000)
 * @returns Large transfers above threshold
 */
export async function getLargeTransfers(
  address: string,
  thresholdXDC: number = 1000,
): Promise<LargeTransfersResponse> {
  logger.info('[XDCScan] getLargeTransfers', { address, thresholdXDC });

  try {
    const txResponse = await getTransactions(address, 1, 100);
    const transactions = txResponse.transactions;

    const thresholdWei = BigInt(Math.floor(thresholdXDC * 1e18));

    const largeTransfers: LargeTransfer[] = transactions
      .filter((tx) => {
        try {
          const value = BigInt(tx.value);
          return value >= thresholdWei;
        } catch {
          return false;
        }
      })
      .map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        valueXDC: weiToXDC(tx.value),
        timestamp: tx.timestamp,
        blockNumber: tx.blockNumber,
      }));

    logger.info('[XDCScan] Large transfers found', {
      address,
      threshold: thresholdXDC,
      count: largeTransfers.length,
    });

    return {
      address,
      threshold: String(thresholdXDC),
      transfers: largeTransfers,
      totalCount: largeTransfers.length,
      source: 'xdcscan',
    };

  } catch (error) {
    return handleApiError(error, 'getLargeTransfers');
  }
}
