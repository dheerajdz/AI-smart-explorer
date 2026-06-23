// ============================================================
// xdcscanService.ts
// XDCScan API integration for wallet data, transactions,
// activity tracking, and large transfer detection.
//
// XDCScan API Docs: https://xdcscan.io/apis
// Base URLs:
//   Mainnet: https://api.xdcscan.io/api
//   Testnet: https://api-testnet.xdcscan.io/api
// ============================================================

import axios, { AxiosError } from 'axios';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { Network, getExplorerBaseUrl, getAddressExplorerUrl, isValidXdcAddress } from '../../utils/network';

// ─── Config ─────────────────────────────────────────────────

function getXdcscanBaseUrl(network: Network = 'mainnet'): string {
  if (network === 'testnet') {
    // Testnet: RPC endpoint for balance/transactions (XDCScan testnet API is dead)
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
 * JSON-RPC call for testnet balance
 */
async function getTestnetBalance(address: string): Promise<string> {
  // Ensure address is in 0x format for RPC call
  const rpcAddress = address.startsWith('txdc') 
    ? '0x' + address.slice(4) 
    : address;
    
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
    // Convert hex wei to decimal string
    return BigInt(result).toString();
  }
  return '0';
}

// ─── Types ──────────────────────────────────────────────────

export interface WalletBalanceResponse {
  address: string;
  balance: string;          // in wei
  balanceXDC: string;       // formatted
  network: Network;
  source: 'xdcscan';
  explorerUrl: string;
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
  network: Network;
  source: 'xdcscan';
  explorerUrl: string;
}

export interface WalletActivity {
  address: string;
  totalTransactions: number;
  firstSeen: string | null;
  lastSeen: string | null;
  uniqueContractsInteracted: number;
  uniqueWalletsInteracted: number;
  network: Network;
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
  network: Network;
  source: 'xdcscan';
}

export interface TokenBalanceResponse {
  address: string;
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  balance: string;
  decimals?: string;
  network: Network;
  source: 'xdcscan';
}

export interface GasPriceResponse {
  safeGasPrice: string;
  proposeGasPrice: string;
  fastGasPrice: string;
  network: Network;
  source: 'xdcscan';
}

export interface BlockInfoResponse {
  blockNumber: string;
  timestamp: string;
  hash: string;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  transactions: number;
  network: Network;
  source: 'xdcscan';
  explorerUrl: string;
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
 * Convert gas price from wei to gwei.
 */
function weiToGwei(wei: string): string {
  try {
    const value = BigInt(wei);
    const gwei = Number(value) / 1e9;
    return gwei.toFixed(2);
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

export async function getWalletBalance(
  address: string,
  network: Network = 'mainnet'
): Promise<WalletBalanceResponse> {
  const sanitized = sanitizeAddress(address);
  if (!sanitized) {
    logger.warn('[XDCScan] Invalid address rejected', { address });
    return {
      address: address || 'invalid',
      balance: '0',
      balanceXDC: '0',
      network,
      source: 'xdcscan',
      explorerUrl: '',
    };
  }
  address = sanitized;
  logger.info('[XDCScan] getWalletBalance', { address, network });

  try {
    let balance: string;
    
    if (network === 'testnet') {
      balance = await getTestnetBalance(address);
    } else {
      const xdcscanClient = createXdcscanClient(network);
      const response = await xdcscanClient.get('', {
        params: {
          module: 'account',
          action: 'balance',
          address,
          tag: 'latest',
        },
      });
      balance = String(response.data?.result || '0');
    }

    const balanceXDC = weiToXDC(balance);
    
    // Display address in 0x format for testnet
    const displayAddress = network === 'testnet' && address.startsWith('txdc')
      ? '0x' + address.slice(4)
      : address;

    logger.info('[XDCScan] Balance retrieved', { address, balanceXDC, network });

    return {
      address: displayAddress,
      balance,
      balanceXDC,
      network,
      source: 'xdcscan',
      explorerUrl: getAddressExplorerUrl(network, address),
    };

  } catch (error) {
    return handleApiError(error, 'getWalletBalance');
  }
}

// ─── 2. getTransactions ─────────────────────────────────────

export async function getTransactions(
  address: string,
  network: Network = 'mainnet',
  page: number = 1,
  offset: number = 10,
): Promise<TransactionsResponse> {
  const sanitized = sanitizeAddress(address);
  if (!sanitized) {
    logger.warn('[XDCScan] Invalid address rejected in getTransactions', { address });
    return {
      address: address || 'invalid',
      transactions: [],
      totalCount: 0,
      network,
      source: 'xdcscan',
      explorerUrl: '',
    };
  }
  address = sanitized;
  logger.info('[XDCScan] getTransactions', { address, network, page, offset });

  const xdcscanClient = createXdcscanClient(network);

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
        network,
        source: 'xdcscan',
        explorerUrl: getAddressExplorerUrl(network, address),
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

    logger.info('[XDCScan] Transactions retrieved', { address, count: transactions.length, network });

    return {
      address,
      transactions,
      totalCount: transactions.length,
      network,
      source: 'xdcscan',
      explorerUrl: getAddressExplorerUrl(network, address),
    };

  } catch (error) {
    return handleApiError(error, 'getTransactions');
  }
}

// ─── 3. getWalletActivity ───────────────────────────────────

export async function getWalletActivity(
  address: string,
  network: Network = 'mainnet'
): Promise<WalletActivity> {
  logger.info('[XDCScan] getWalletActivity', { address, network });

  try {
    const txResponse = await getTransactions(address, network, 1, 100);
    const transactions = txResponse.transactions;

    if (transactions.length === 0) {
      return {
        address,
        totalTransactions: 0,
        firstSeen: null,
        lastSeen: null,
        uniqueContractsInteracted: 0,
        uniqueWalletsInteracted: 0,
        network,
        source: 'xdcscan',
      };
    }

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
      network,
    });

    return {
      address,
      totalTransactions: transactions.length,
      firstSeen,
      lastSeen,
      uniqueContractsInteracted: contractInteractions.length,
      uniqueWalletsInteracted: uniqueTo.size + uniqueFrom.size - 1,
      network,
      source: 'xdcscan',
    };

  } catch (error) {
    return handleApiError(error, 'getWalletActivity');
  }
}

// ─── 4. getLargeTransfers ───────────────────────────────────

export async function getLargeTransfers(
  address: string,
  network: Network = 'mainnet',
  thresholdXDC: number = 1000,
): Promise<LargeTransfersResponse> {
  logger.info('[XDCScan] getLargeTransfers', { address, network, thresholdXDC });

  try {
    const txResponse = await getTransactions(address, network, 1, 100);
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
      network,
    });

    return {
      address,
      threshold: String(thresholdXDC),
      transfers: largeTransfers,
      totalCount: largeTransfers.length,
      network,
      source: 'xdcscan',
    };

  } catch (error) {
    return handleApiError(error, 'getLargeTransfers');
  }
}

// ─── 5. getTransactionByHash ────────────────────────────────

export async function getTransactionByHash(
  txHash: string,
  network: Network = 'mainnet'
): Promise<{ transaction: Transaction | null; explorerUrl: string }> {
  logger.info('[XDCScan] getTransactionByHash', { txHash, network });

  try {
    // XDCScan doesn't have a direct tx hash endpoint in free tier.
    // We can't fetch without an address context, so return null with explorer link.
    return {
      transaction: null,
      explorerUrl: `${getExplorerBaseUrl(network)}/tx/${txHash}`,
    };
  } catch (error) {
    return handleApiError(error, 'getTransactionByHash');
  }
}

// ─── 6. getTokenBalance ─────────────────────────────────────

export async function getTokenBalance(
  address: string,
  tokenAddress: string,
  network: Network = 'mainnet'
): Promise<TokenBalanceResponse> {
  logger.info('[XDCScan] getTokenBalance', { address, tokenAddress, network });

  const xdcscanClient = createXdcscanClient(network);

  try {
    const response = await xdcscanClient.get('', {
      params: {
        module: 'account',
        action: 'tokenbalance',
        contractaddress: tokenAddress,
        address,
        tag: 'latest',
      },
    });

    const result = response.data?.result;

    return {
      address,
      tokenAddress,
      balance: result ? String(result) : '0',
      network,
      source: 'xdcscan',
    };
  } catch (error) {
    return handleApiError(error, 'getTokenBalance');
  }
}

// ─── 7. getGasPrice ─────────────────────────────────────────

export async function getGasPrice(network: Network = 'mainnet'): Promise<GasPriceResponse> {
  logger.info('[XDCScan] getGasPrice', { network });

  // Testnet: Use RPC directly (XDCScan testnet API is dead)
  if (network === 'testnet') {
    try {
      const response = await axios.post(
        'https://rpc.apothem.network',
        {
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const gasPriceHex = response.data?.result;
      const gasPriceGwei = gasPriceHex ? weiToGwei(String(parseInt(gasPriceHex, 16))) : '0';

      return {
        safeGasPrice: gasPriceGwei,
        proposeGasPrice: gasPriceGwei,
        fastGasPrice: gasPriceGwei,
        network,
        source: 'xdcscan',
      };
    } catch (error) {
      return handleApiError(error, 'getGasPrice');
    }
  }

  // Mainnet: Use XDCScan API
  const xdcscanClient = createXdcscanClient(network);

  try {
    const response = await xdcscanClient.get('', {
      params: {
        module: 'gastracker',
        action: 'gasoracle',
      },
    });

    const result = response.data?.result;

    if (result && typeof result === 'object') {
      return {
        safeGasPrice: result.SafeGasPrice || '0',
        proposeGasPrice: result.ProposeGasPrice || '0',
        fastGasPrice: result.FastGasPrice || '0',
        network,
        source: 'xdcscan',
      };
    }

    // Fallback to eth_gasPrice via proxy module
    const proxyResponse = await xdcscanClient.get('', {
      params: {
        module: 'proxy',
        action: 'eth_gasPrice',
      },
    });

    const gasPriceHex = proxyResponse.data?.result;
    const gasPriceGwei = gasPriceHex ? weiToGwei(String(parseInt(gasPriceHex, 16))) : '0';

    return {
      safeGasPrice: gasPriceGwei,
      proposeGasPrice: gasPriceGwei,
      fastGasPrice: gasPriceGwei,
      network,
      source: 'xdcscan',
    };
  } catch (error) {
    return handleApiError(error, 'getGasPrice');
  }
}

// ─── 8. getBlockByNumber ────────────────────────────────────

export async function getBlockByNumber(
  blockNumber: string | number,
  network: Network = 'mainnet'
): Promise<BlockInfoResponse> {
  logger.info('[XDCScan] getBlockByNumber', { blockNumber, network });

  const baseUrl = network === 'testnet' 
    ? 'https://api-testnet.xdcscan.io'
    : 'https://api.xdcscan.io';

  try {
    let block;
    
    if (blockNumber === 'latest') {
      // Get latest block from /blocks
      const response = await axios.get(`${baseUrl}/blocks`, { 
        timeout: 15000,
        params: { limit: 1 }
      });
      block = response.data?.items?.[0];
    } else {
      // Get specific block
      const num = typeof blockNumber === 'number' ? blockNumber : parseInt(blockNumber);
      const response = await axios.get(`${baseUrl}/blocks/${num}`, { timeout: 15000 });
      block = response.data;
    }

    if (!block || typeof block !== 'object') {
      throw new Error('Block not found');
    }

    const blockNum = String(block.number || block.height || blockNumber);
    const timestamp = block.timestamp || '';

    return {
      blockNumber: blockNum,
      timestamp,
      hash: block.hash || '',
      miner: block.miner_hash || block.miner?.hash || '',
      gasUsed: String(block.gas_used || '0'),
      gasLimit: String(block.gas_limit || '0'),
      transactions: block.tx_count || 0,
      network,
      source: 'xdcscan',
      explorerUrl: `${getExplorerBaseUrl(network)}/block/${blockNum}`,
    };
  } catch (error) {
    return handleApiError(error, 'getBlockByNumber');
  }
}

// ─── 9. getFailedTransactions ───────────────────────────────

export async function getFailedTransactions(
  address: string,
  network: Network = 'mainnet',
  limit: number = 10
): Promise<TransactionsResponse> {
  logger.info('[XDCScan] getFailedTransactions', { address, network, limit });

  try {
    const txResponse = await getTransactions(address, network, 1, 100);
    const failed = txResponse.transactions.filter(tx => tx.status === 'failed');

    return {
      address,
      transactions: failed.slice(0, limit),
      totalCount: failed.length,
      network,
      source: 'xdcscan',
      explorerUrl: getAddressExplorerUrl(network, address),
    };
  } catch (error) {
    return handleApiError(error, 'getFailedTransactions');
  }
}

// ─── 10. getNetworkStats ────────────────────────────────────

export interface NetworkStatsResponse {
  latestBlock: string;
  totalTransactions: string;
  totalBlocks: string;
  xdcPrice: string;
  marketCap: string;
  latestTransactions: Array<{
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: string;
  }>;
  network: Network;
  source: 'xdcscan';
}

export async function getNetworkStats(network: Network = 'mainnet'): Promise<NetworkStatsResponse> {
  logger.info('[XDCScan] getNetworkStats', { network });

  const baseUrl = network === 'testnet' 
    ? 'https://api-testnet.xdcscan.io'
    : 'https://api.xdcscan.io';

  try {
    // Get stats from /stats endpoint
    const statsResponse = await axios.get(`${baseUrl}/stats`, { timeout: 15000 });
    const stats = statsResponse.data;

    // Get latest blocks
    const blocksResponse = await axios.get(`${baseUrl}/blocks`, { 
      timeout: 15000,
      params: { limit: 1 }
    });
    const latestBlock = blocksResponse.data?.items?.[0];

    // Get latest transactions
    const txResponse = await axios.get(`${baseUrl}/transactions`, { 
      timeout: 15000,
      params: { limit: 5 }
    });
    const transactions = txResponse.data?.items || [];

    const latestTransactions = transactions.map((tx: any) => ({
      hash: tx.hash || '',
      from: tx.from_address_hash || '',
      to: tx.to_address_hash || '',
      value: tx.value ? weiToXDC(tx.value) : '0',
      timestamp: tx.timestamp || '',
    }));

    const xdcPrice = stats.coin_price ? String(stats.coin_price) : '0.03';
    const marketCap = stats.market_cap ? String(stats.market_cap) : '0';

    return {
      latestBlock: latestBlock?.number ? String(latestBlock.number) : '0',
      totalTransactions: latestBlock?.tx_count ? String(latestBlock.tx_count) : '0',
      totalBlocks: latestBlock?.number ? String(latestBlock.number) : '0',
      xdcPrice,
      marketCap,
      latestTransactions,
      network,
      source: 'xdcscan',
    };

  } catch (error) {
    logger.error('[XDCScan] getNetworkStats failed', { error });
    // Return fallback data
    return {
      latestBlock: '0',
      totalTransactions: '0',
      totalBlocks: '0',
      xdcPrice: '0.03',
      marketCap: '0',
      latestTransactions: [],
      network,
      source: 'xdcscan',
    };
  }
}

// ─── 11. getFailedContractDeployments ───────────────────────

export async function getFailedContractDeployments(
  network: Network = 'mainnet',
  limit: number = 10
): Promise<{ deployments: Transaction[]; totalCount: number; network: Network; source: 'xdcscan' }> {
  logger.info('[XDCScan] getFailedContractDeployments', { network, limit });

  // This requires scanning recent blocks for failed contract creations.
  // Without a specific address, we can't easily query this via XDCScan free API.
  // Return empty with explanation.
  return {
    deployments: [],
    totalCount: 0,
    network,
    source: 'xdcscan',
  };
}
