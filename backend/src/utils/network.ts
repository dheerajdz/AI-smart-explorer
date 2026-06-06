export type Network = 'mainnet' | 'testnet';

export function detectNetwork(address: string): Network {
  const lower = address.trim().toLowerCase();
  if (lower.startsWith('txdc')) return 'testnet';
  return 'mainnet';
}

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function isValidXdcAddress(address: string): boolean {
  const lower = normalizeAddress(address);
  if (/^xdc[0-9a-f]{39}$/i.test(lower)) return true;
  if (/^txdc[0-9a-f]{39}$/i.test(lower)) return true;
  if (/^0x[0-9a-f]{40}$/i.test(lower)) return true;
  return false;
}

export function getExplorerBaseUrl(network: Network): string {
  return network === 'testnet'
    ? 'https://testnet.xdcscan.com'
    : 'https://xdcscan.io';
}

export function getExplorerTxUrl(network: Network, txHash: string): string {
  return `${getExplorerBaseUrl(network)}/tx/${txHash}`;
}

export function getExplorerAddressUrl(network: Network, address: string): string {
  return `${getExplorerBaseUrl(network)}/address/${address}`;
}
