import { logger } from '../../utils/logger';
import { env } from '../../config/env';

export async function getXdcscanBalance(address: string): Promise<unknown> {
  logger.info('XDCScan: getBalance', { address });
  // TODO: Call XDCScan API
  // const res = await fetch(`${env.XDCSCAN_API}?module=account&action=balance&address=${address}&tag=latest`);
  // return res.json();
  return { address, balance: '0', source: 'xdcscan' };
}

export async function getXdcscanTxList(address: string): Promise<unknown> {
  logger.info('XDCScan: getTxList', { address });
  return { address, transactions: [], source: 'xdcscan' };
}
