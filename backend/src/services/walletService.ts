import { logger } from '../utils/logger';
import { Network, detectNetwork } from '../utils/network';
import { TrackedWalletModel, ITrackedWallet } from '../models/TrackedWallet';

export interface TrackResult {
  success: boolean;
  alreadyTracked: boolean;
  network?: Network;
}

export async function trackWallet(
  address: string,
  userId: string,
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x' = 'telegram'
): Promise<TrackResult> {
  const normalized = address.trim().toLowerCase();
  const network = detectNetwork(normalized);

  // Check if already tracked
  const existing = await TrackedWalletModel.findByUserAndAddress(userId, normalized);
  if (existing && existing.isActive) {
    logger.info('[walletService] Wallet already tracked', { address: normalized, userId });
    return {
      success: true,
      alreadyTracked: true,
      network: existing.network as Network,
    };
  }

  // Track (or reactivate)
  await TrackedWalletModel.track({
    userId,
    address: normalized,
    network,
    platform,
    isActive: true,
  });

  logger.info('[walletService] Wallet tracked', { address: normalized, userId, network });
  return {
    success: true,
    alreadyTracked: false,
    network,
  };
}

export async function untrackWallet(
  address: string,
  userId: string
): Promise<{ success: boolean }> {
  const success = await TrackedWalletModel.untrack(userId, address);
  if (success) {
    logger.info('[walletService] Wallet untracked', { address, userId });
  }
  return { success };
}

export async function listWallets(userId: string): Promise<ITrackedWallet[]> {
  return TrackedWalletModel.listWallets(userId);
}

export async function getAllTrackedUsers(): Promise<string[]> {
  return TrackedWalletModel.getAllTrackedUsers();
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
