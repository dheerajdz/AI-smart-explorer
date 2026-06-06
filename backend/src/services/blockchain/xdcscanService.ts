import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { detectNetwork, Network } from '../../utils/network';

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasUsed: string;
  timestamp: string;
  blockNumber: string;
  isError: string;
  txReceiptStatus: string;
}

export interface BalanceResult {
  address: string;
  balance: string;
  network: Network;
}

export interface TxListResult {
  address: string;
  transactions: Transaction[];
  network: Network;
}

interface XdcscanResponse<T> {
  status?: string;
  message?: string;
  result?: T;
}

function getXdcscanApi(network: Network): string {
  return network === 'testnet'
    ? (env.XDCSCAN_TESTNET_API ?? 'https://api-testnet.xdcscan.io/api')
    : (env.XDCSCAN_API ?? 'https://api.xdcscan.io/api');
}

export async function getBalance(address: string): Promise<BalanceResult> {
  const network = detectNetwork(address);
  const apiUrl = getXdcscanApi(network);
  const url = `${apiUrl}?module=account&action=balance&address=${address}&tag=latest`;

  logger.info('XDCScan: getBalance', { address, network });

  const res = await fetch(url);
  const data = (await res.json()) as XdcscanResponse<string>;

  if (data.status !== '1' && data.message !== 'OK') {
    logger.warn('XDCScan balance error', { address, message: data.message });
    throw new Error(data.message || 'XDCScan balance fetch failed');
  }

  return { address, balance: data.result ?? '0', network };
}

export async function getTxList(address: string): Promise<TxListResult> {
  const network = detectNetwork(address);
  const apiUrl = getXdcscanApi(network);
  const url = `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc`;

  logger.info('XDCScan: getTxList', { address, network });

  const res = await fetch(url);
  const data = (await res.json()) as XdcscanResponse<unknown[]>;

  if (data.status !== '1' && data.message !== 'OK') {
    logger.warn('XDCScan txlist error', { address, message: data.message });
    if (data.message === 'No transactions found') {
      return { address, transactions: [], network };
    }
    throw new Error(data.message || 'XDCScan txlist fetch failed');
  }

  const rawTxs = data.result || [];
  const txs: Transaction[] = rawTxs.map((t: any) => ({
    hash: String(t.hash || ''),
    from: String(t.from || ''),
    to: String(t.to || ''),
    value: String(t.value || ''),
    gasPrice: String(t.gasPrice || ''),
    gasUsed: String(t.gasUsed || ''),
    timestamp: String(t.timeStamp || ''),
    blockNumber: String(t.blockNumber || ''),
    isError: String(t.isError ?? '0'),
    txReceiptStatus: String(t.txreceipt_status ?? ''),
  }));

  return { address, transactions: txs, network };
}
