import axios from 'axios';
import { ChainConfig, getChainConfig } from '../../config/chains';
import { logger } from '../../utils/logger';

export interface BalanceResult {
  address: string;
  balance: string;
  balanceFormatted: string;
  symbol: string;
  chain: string;
  explorerUrl: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
  status: string;
  gasUsed?: string;
  gasPrice?: string;
}

export interface TxResult {
  address: string;
  transactions: Transaction[];
  totalCount: number;
  chain: string;
  explorerUrl: string;
}

export interface GasPrice {
  safeGasPrice: string;
  proposeGasPrice: string;
  fastGasPrice: string;
  chain: string;
}

// ─── Generic EVM Adapter (Etherscan-compatible APIs) ─────────

class EvmAdapter {
  constructor(private config: ChainConfig) {}

  async getBalance(address: string): Promise<BalanceResult> {
    try {
      const params: any = {
        module: 'account',
        action: 'balance',
        address,
        tag: 'latest',
      };
      if (this.config.apiKey) params.apikey = this.config.apiKey;

      const response = await axios.get(this.config.apiUrl, { params, timeout: 10000 });
      const balanceWei = response.data.result;
      const decimals = this.config.nativeToken === 'BNB' ? 18 : 18;
      const balanceFormatted = (parseInt(balanceWei) / Math.pow(10, decimals)).toFixed(6);

      return {
        address,
        balance: balanceWei,
        balanceFormatted,
        symbol: this.config.nativeToken,
        chain: this.config.id,
        explorerUrl: `${this.config.explorerUrl}/address/${address}`,
      };
    } catch (err) {
      logger.error(`[multiChain] ${this.config.id} getBalance failed`, { address, error: err });
      throw err;
    }
  }

  async getTransactions(address: string, page = 1, offset = 10): Promise<TxResult> {
    try {
      const params: any = {
        module: 'account',
        action: 'txlist',
        address,
        startblock: 0,
        endblock: 99999999,
        sort: 'desc',
        page,
        offset,
      };
      if (this.config.apiKey) params.apikey = this.config.apiKey;

      const response = await axios.get(this.config.apiUrl, { params, timeout: 15000 });
      const txs = response.data.result || [];

      return {
        address,
        transactions: txs.map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
          status: tx.txreceipt_status === '1' ? 'success' : 'failed',
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice,
        })),
        totalCount: txs.length,
        chain: this.config.id,
        explorerUrl: `${this.config.explorerUrl}/address/${address}`,
      };
    } catch (err) {
      logger.error(`[multiChain] ${this.config.id} getTransactions failed`, { address, error: err });
      throw err;
    }
  }

  async getGasPrice(): Promise<GasPrice> {
    try {
      const params: any = {
        module: 'gastracker',
        action: 'gasoracle',
      };
      if (this.config.apiKey) params.apikey = this.config.apiKey;

      const response = await axios.get(this.config.apiUrl, { params, timeout: 10000 });
      const data = response.data.result;

      return {
        safeGasPrice: data.SafeGasPrice || '0',
        proposeGasPrice: data.ProposeGasPrice || '0',
        fastGasPrice: data.FastGasPrice || '0',
        chain: this.config.id,
      };
    } catch (err) {
      logger.error(`[multiChain] ${this.config.id} getGasPrice failed`, { error: err });
      // Fallback to RPC
      return this.getGasPriceFromRpc();
    }
  }

  private async getGasPriceFromRpc(): Promise<GasPrice> {
    try {
      const response = await axios.post(
        this.config.rpcUrl,
        {
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1,
        },
        { timeout: 10000 }
      );
      const gasPriceGwei = (parseInt(response.data.result, 16) / 1e9).toFixed(2);
      return {
        safeGasPrice: gasPriceGwei,
        proposeGasPrice: gasPriceGwei,
        fastGasPrice: gasPriceGwei,
        chain: this.config.id,
      };
    } catch (err) {
      logger.error(`[multiChain] ${this.config.id} RPC gas price failed`, { error: err });
      return {
        safeGasPrice: '0',
        proposeGasPrice: '0',
        fastGasPrice: '0',
        chain: this.config.id,
      };
    }
  }
}

// ─── XDC Adapter (uses existing XDCScan service) ─────────────

class XdcAdapter {
  constructor(private config: ChainConfig) {}

  async getBalance(address: string): Promise<BalanceResult> {
    const { getWalletBalance } = await import('../blockchain');
    const network = this.config.isTestnet ? 'testnet' : 'mainnet';
    const result = await getWalletBalance(address, network);

    return {
      address: result.address,
      balance: result.balanceXDC,
      balanceFormatted: result.balanceXDC,
      symbol: this.config.nativeToken,
      chain: this.config.id,
      explorerUrl: result.explorerUrl,
    };
  }

  async getTransactions(address: string, page = 1, offset = 10): Promise<TxResult> {
    const { getTransactions } = await import('../blockchain');
    const network = this.config.isTestnet ? 'testnet' : 'mainnet';
    const result = await getTransactions(address, network, page, offset);

    return {
      address: result.address,
      transactions: result.transactions.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        timestamp: tx.timestamp,
        status: tx.status || 'success',
      })),
      totalCount: result.totalCount,
      chain: this.config.id,
      explorerUrl: `${this.config.explorerUrl}/address/${address}`,
    };
  }

  async getGasPrice(): Promise<GasPrice> {
    const { getGasPrice } = await import('../blockchain');
    const network = this.config.isTestnet ? 'testnet' : 'mainnet';
    const result = await getGasPrice(network);

    return {
      safeGasPrice: result.safeGasPrice,
      proposeGasPrice: result.proposeGasPrice,
      fastGasPrice: result.fastGasPrice,
      chain: this.config.id,
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────

function getAdapter(chainId: string): EvmAdapter | XdcAdapter {
  const config = getChainConfig(chainId);
  if (!config) throw new Error(`Unsupported chain: ${chainId}`);

  if (config.id === 'xdc' || config.id === 'txdc') {
    return new XdcAdapter(config);
  }
  return new EvmAdapter(config);
}

// ─── Public API ──────────────────────────────────────────────

export async function getMultiChainBalance(
  address: string,
  chainId: string
): Promise<BalanceResult> {
  const adapter = getAdapter(chainId);
  return adapter.getBalance(address);
}

export async function getMultiChainTransactions(
  address: string,
  chainId: string,
  page = 1,
  offset = 10
): Promise<TxResult> {
  const adapter = getAdapter(chainId);
  return adapter.getTransactions(address, page, offset);
}

export async function getMultiChainGasPrice(chainId: string): Promise<GasPrice> {
  const adapter = getAdapter(chainId);
  return adapter.getGasPrice();
}

export async function getAllChainBalances(address: string): Promise<BalanceResult[]> {
  const chains = Object.keys(getChainConfig('xdc') ? { xdc: true, txdc: true, eth: true, base: true, polygon: true, bsc: true } : {});
  const results = await Promise.allSettled(
    chains.map((chainId) => getMultiChainBalance(address, chainId))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<BalanceResult> => r.status === 'fulfilled')
    .map((r) => r.value);
}
