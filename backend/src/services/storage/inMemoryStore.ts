// Temporary in-memory storage for wallets
// Replace with MongoDB persistence later without changing service consumers

const walletsByUser = new Map<string, Set<string>>();

// Map to store user phone numbers for notifications
const userPhones = new Map<string, string>();

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
  userPhones.delete(userId);
}

export function listAllUsers(): string[] {
  return Array.from(walletsByUser.keys());
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
