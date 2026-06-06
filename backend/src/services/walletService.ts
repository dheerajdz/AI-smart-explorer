import { logger } from '../utils/logger';
import * as store from './storage/inMemoryStore';

export interface TrackResult {
  success: boolean;
  alreadyTracked?: boolean;
  wallet: string;
}

export interface UntrackResult {
  success: boolean;
  notFound?: boolean;
  wallet: string;
}

export function trackWallet(userId: string, wallet: string): TrackResult {
  const normalized = wallet.trim().toLowerCase();

  if (!normalized) {
    return { success: false, wallet: '' };
  }

  const added = store.addWallet(userId, normalized);

  if (!added) {
    logger.info('Wallet already tracked', { userId, wallet: normalized });
    return { success: true, alreadyTracked: true, wallet: normalized };
  }

  logger.info('Wallet tracked', { userId, wallet: normalized });
  return { success: true, wallet: normalized };
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

export function listWallets(userId: string): string[] {
  return store.listWallets(userId);
}
