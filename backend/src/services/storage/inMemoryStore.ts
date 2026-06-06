import { detectNetwork, Network } from '../../utils/network';

export interface StoredWallet {
  address: string;
  network: Network;
}

const walletsByUser = new Map<string, Map<string, StoredWallet>>();

function getUserWalletMap(userId: string): Map<string, StoredWallet> {
  if (!walletsByUser.has(userId)) {
    walletsByUser.set(userId, new Map());
  }
  return walletsByUser.get(userId)!;
}

export function addWallet(userId: string, address: string): boolean {
  const normalized = address.trim().toLowerCase();
  if (!normalized) return false;

  const network = detectNetwork(normalized);
  const wallets = getUserWalletMap(userId);
  if (wallets.has(normalized)) return false;

  wallets.set(normalized, { address: normalized, network });
  return true;
}

export function removeWallet(userId: string, address: string): boolean {
  const normalized = address.trim().toLowerCase();
  if (!normalized) return false;

  const wallets = getUserWalletMap(userId);
  if (!wallets.has(normalized)) return false;

  wallets.delete(normalized);
  return true;
}

export function listWallets(userId: string): StoredWallet[] {
  const wallets = getUserWalletMap(userId);
  return Array.from(wallets.values());
}

export function getAllUsers(): IterableIterator<[string, Map<string, StoredWallet>]> {
  return walletsByUser.entries();
}

export function clearUserWallets(userId: string): void {
  walletsByUser.delete(userId);
}
