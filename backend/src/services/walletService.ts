import { logger } from '../utils/logger';
import { Network } from '../utils/network';
import * as store from './storage/inMemoryStore';

export interface TrackResult {
  success: boolean;
  alreadyTracked?: boolean;
  wallet: string;
  network: Network;
}

export interface UntrackResult {
  success: boolean;
  notFound?: boolean;
  wallet: string;
}

export function trackWallet(userId: string, wallet: string): TrackResult {
  const normalized = wallet.trim().toLowerCase();

  if (!normalized) {
    return { success: false, wallet: '', network: 'mainnet' };
  }

  const added = store.addWallet(userId, normalized);
  const stored = store.listWallets(userId).find(w => w.address === normalized);
  const network = stored?.network ?? 'mainnet';

  if (!added) {
    logger.info('Wallet already tracked', { userId, wallet: normalized });
    return { success: true, alreadyTracked: true, wallet: normalized, network };
  }

  logger.info('Wallet tracked', { userId, wallet: normalized, network });
  return { success: true, wallet: normalized, network };
}

export function untrackWallet(userId: string, wallet: string): UntrackResult {
  const normalized = wallet.trim().toLowerCase();

  if (!normalized) {
    return { success: false, wallet: '' };
  }

  const removed = store.removeWallet(userId, normalized);

  if (!removed) {
    logger.info('Wallet not found for untrack', { userId, wallet: normalized });
    return { success: false, notFound: true, wallet: normalized };
  }

  logger.info('Wallet untracked', { userId, wallet: normalized });
  return { success: true, wallet: normalized };
}

export function listWallets(userId: string): store.StoredWallet[] {
  return store.listWallets(userId);
}
