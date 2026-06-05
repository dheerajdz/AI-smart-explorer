import { logger } from '../../utils/logger';
import { env } from '../../config/env';

export async function getBlockscoutBalance(address: string): Promise<unknown> {
  logger.info('Blockscout: getBalance', { address });
  // TODO: Call Blockscout API
  // const res = await fetch(`${env.BLOCKSCOUT_API}?module=account&action=balance&address=${address}`);
  // return res.json();
  return { address, balance: '0', source: 'blockscout' };
}

export async function getBlockscoutTxList(address: string): Promise<unknown> {
  logger.info('Blockscout: getTxList', { address });
  return { address, transactions: [], source: 'blockscout' };
}
