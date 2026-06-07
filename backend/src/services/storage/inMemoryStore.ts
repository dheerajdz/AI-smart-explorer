import { detectNetwork, Network } from '../../utils/network';

export interface StoredWallet {
  address: string;
  network: Network;
}

const walletsByUser = new Map<string, Map<string, StoredWallet>>();

// Map to store user phone numbers for notifications
const userPhones = new Map<string, string>();

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

export function getAllTrackedWallets(): { userId: string; wallets: StoredWallet[] }[] {
  return Array.from(walletsByUser.entries()).map(([userId, wallets]) => ({
    userId,
    wallets: Array.from(wallets.values()),
  }));
}

// Phone number management for WhatsApp notifications
export function setUserPhone(userId: string, phone: string): void {
  userPhones.set(userId, phone);
}

export function getUserPhone(userId: string): string | undefined {
  return userPhones.get(userId);
}

export function removeUserPhone(userId: string): void {
  userPhones.delete(userId);
}

// Compatibility functions for webhook branch
export function getUserWallets(userId: string): Set<string> {
  const wallets = walletsByUser.get(userId);
  if (!wallets) return new Set();
  return new Set(Array.from(wallets.values()).map((w) => w.address));
}

export function addWallet(userId: string, wallet: string): boolean {
  const result = trackWallet(wallet, userId);
  return !result.alreadyTracked;
}

export function removeWallet(userId: string, wallet: string): boolean {
  const result = untrackWallet(wallet, userId);
  return result.success;
}

export function clearUserWallets(userId: string): void {
  walletsByUser.delete(userId);
  userPhones.delete(userId);
}

export function listAllUsers(): string[] {
  return Array.from(walletsByUser.keys());
}
