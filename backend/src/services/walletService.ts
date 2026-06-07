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
