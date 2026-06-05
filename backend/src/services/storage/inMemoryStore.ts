// Temporary in-memory storage for wallets
// Replace with MongoDB persistence later without changing service consumers

const walletsByUser = new Map<string, Set<string>>();

export function getUserWallets(userId: string): Set<string> {
  if (!walletsByUser.has(userId)) {
    walletsByUser.set(userId, new Set());
  }
  return walletsByUser.get(userId)!;
}

export function addWallet(userId: string, wallet: string): boolean {
  const normalized = wallet.trim().toLowerCase();
  if (!normalized) return false;

  const wallets = getUserWallets(userId);
  if (wallets.has(normalized)) return false;

  wallets.add(normalized);
  return true;
}

export function removeWallet(userId: string, wallet: string): boolean {
  const normalized = wallet.trim().toLowerCase();
  if (!normalized) return false;

  const wallets = getUserWallets(userId);
  if (!wallets.has(normalized)) return false;

  wallets.delete(normalized);
  return true;
}

export function listWallets(userId: string): string[] {
  const wallets = getUserWallets(userId);
  return Array.from(wallets);
}

export function clearUserWallets(userId: string): void {
  walletsByUser.delete(userId);
}
