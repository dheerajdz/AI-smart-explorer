import { detectNetwork, Network } from '../../utils/network';

export interface StoredWallet {
  address: string;
  network: Network;
}

const walletsByUser = new Map<string, Map<string, StoredWallet>>();

export function trackWallet(address: string, userId: string): { alreadyTracked: boolean } {
  const normalized = address.trim().toLowerCase();
  const network = detectNetwork(normalized);

  if (!walletsByUser.has(userId)) {
    walletsByUser.set(userId, new Map());
  }

  const userWallets = walletsByUser.get(userId)!;

  if (userWallets.has(normalized)) {
    return { alreadyTracked: true };
  }

  userWallets.set(normalized, { address: normalized, network });
  return { alreadyTracked: false };
}

export function untrackWallet(address: string, userId: string): { success: boolean } {
  const normalized = address.trim().toLowerCase();
  const userWallets = walletsByUser.get(userId);

  if (!userWallets || !userWallets.has(normalized)) {
    return { success: false };
  }

  userWallets.delete(normalized);
  return { success: true };
}

export function listWallets(userId: string): StoredWallet[] {
  const userWallets = walletsByUser.get(userId);
  return userWallets ? Array.from(userWallets.values()) : [];
}

export function getAllUsers(): string[] {
  return Array.from(walletsByUser.keys());
}

export function getWalletsForUser(userId: string): StoredWallet[] {
  return listWallets(userId);
}
