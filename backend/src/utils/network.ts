export type Network = 'mainnet' | 'testnet';

/**
 * Detect network from address prefix.
 * - xdc...  → mainnet
 * - txdc... → testnet
 * - 0x...   → mainnet (EVM default)
 */
export function detectNetwork(address: string): Network {
  const lower = address.trim().toLowerCase();
  if (lower.startsWith('txdc')) return 'testnet';
  if (lower.startsWith('xdc') || lower.startsWith('0x')) return 'mainnet';
  return 'mainnet';
}

/**
 * Validate XDC/EVM address format.
 */
export function isValidXdcAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim().toLowerCase();
  if (trimmed.startsWith('xdc')) {
    return /^xdc[0-9a-f]{40}$/i.test(trimmed);
  }
  if (trimmed.startsWith('txdc')) {
    return /^txdc[0-9a-f]{40}$/i.test(trimmed);
  }
  if (trimmed.startsWith('0x')) {
    return /^0x[0-9a-f]{40}$/i.test(trimmed);
  }
  return false;
}

/**
 * Normalize address for API calls.
 * XDCScan accepts both xdc... and 0x... formats.
 */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Get explorer base URL for a network.
 */
export function getExplorerBaseUrl(network: Network): string {
  return network === 'testnet'
    ? 'https://testnet.xdcscan.com'
    : 'https://xdcscan.io';
}

/**
 * Get explorer link for a transaction.
 */
export function getTxExplorerUrl(txHash: string, network: Network): string {
  return `${getExplorerBaseUrl(network)}/tx/${txHash}`;
}

/**
 * Get explorer link for an address.
 */
export function getAddressExplorerUrl(address: string, network: Network): string {
  return `${getExplorerBaseUrl(network)}/address/${address}`;
}
