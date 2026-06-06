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
