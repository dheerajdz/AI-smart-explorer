import { logger } from '../utils/logger';
import { Network } from '../utils/network';
import * as store from './storage/inMemoryStore';

export interface TrackResult {
  success: boolean;
  alreadyTracked: boolean;
  network?: Network;
}

export function trackWallet(address: string, userId: string): TrackResult {
  const result = store.trackWallet(address, userId);
  if (!result.alreadyTracked) {
    logger.info('[walletService] Wallet tracked', { address, userId });
  }
  return {
    success: true,
    alreadyTracked: result.alreadyTracked,
    network: store.listWallets(userId).find(w => w.address === address.trim().toLowerCase())?.network,
  };
}

export function untrackWallet(address: string, userId: string): { success: boolean } {
  const result = store.untrackWallet(address, userId);
  if (result.success) {
    logger.info('[walletService] Wallet untracked', { address, userId });
  }
  return result;
}

export function listWallets(userId: string): store.StoredWallet[] {
  return store.listWallets(userId);
}

export function getAllTrackedUsers(): string[] {
  return store.getAllUsers();
}

export async function getWalletBalance(address: string): Promise<string> {
  try {
    const cleanAddress = address.toLowerCase().startsWith('xdc') 
      ? '0x' + address.slice(3) 
      : address;
    
    const https = require('https');
    const agent = new https.Agent({ family: 4 });
    
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [cleanAddress, 'latest'],
      id: 1
    });
    
    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'rpc.xinfin.network',
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'curl/7.68.0'
        },
        agent,
        timeout: 10000,
      }, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.result) {
              const balanceWei = BigInt(result.result);
              const balanceXDC = Number(balanceWei) / 1e18;
              resolve(balanceXDC.toFixed(4));
            } else {
              resolve('0');
            }
          } catch {
            resolve('0');
          }
        });
      });
      req.on('error', () => resolve('0'));
      req.on('timeout', () => { req.destroy(); resolve('0'); });
      req.write(postData);
      req.end();
    });
  } catch {
    return '0';
  }
}
