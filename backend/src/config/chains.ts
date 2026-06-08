export interface ChainConfig {
  id: string;
  name: string;
  nativeToken: string;
  rpcUrl: string;
  explorerUrl: string;
  apiUrl: string;
  apiKey?: string;
  chainId: number;
  isTestnet: boolean;
  logo: string;
}

export const CHAINS: Record<string, ChainConfig> = {
  xdc: {
    id: 'xdc',
    name: 'XDC Network',
    nativeToken: 'XDC',
    rpcUrl: 'https://rpc.xdc.org',
    explorerUrl: 'https://xdcscan.com',
    apiUrl: 'https://api.xdcscan.io',
    chainId: 50,
    isTestnet: false,
    logo: '🔷',
  },
  txdc: {
    id: 'txdc',
    name: 'XDC Testnet',
    nativeToken: 'TXDC',
    rpcUrl: 'https://rpc.apothem.network',
    explorerUrl: 'https://testnet.xdcscan.com',
    apiUrl: 'https://api-testnet.xdcscan.io',
    chainId: 51,
    isTestnet: true,
    logo: '🧪',
  },
  eth: {
    id: 'eth',
    name: 'Ethereum',
    nativeToken: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    apiUrl: 'https://api.etherscan.io/api',
    apiKey: process.env.ETHERSCAN_API_KEY,
    chainId: 1,
    isTestnet: false,
    logo: '💠',
  },
  base: {
    id: 'base',
    name: 'Base',
    nativeToken: 'ETH',
    rpcUrl: 'https://base.llamarpc.com',
    explorerUrl: 'https://basescan.org',
    apiUrl: 'https://api.basescan.org/api',
    apiKey: process.env.BASESCAN_API_KEY,
    chainId: 8453,
    isTestnet: false,
    logo: '🔵',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    nativeToken: 'MATIC',
    rpcUrl: 'https://polygon.llamarpc.com',
    explorerUrl: 'https://polygonscan.com',
    apiUrl: 'https://api.polygonscan.com/api',
    apiKey: process.env.POLYGONSCAN_API_KEY,
    chainId: 137,
    isTestnet: false,
    logo: '🟣',
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    nativeToken: 'BNB',
    rpcUrl: 'https://binance.llamarpc.com',
    explorerUrl: 'https://bscscan.com',
    apiUrl: 'https://api.bscscan.com/api',
    apiKey: process.env.BSCSCAN_API_KEY,
    chainId: 56,
    isTestnet: false,
    logo: '🟡',
  },
};

export function getChainConfig(chainId: string): ChainConfig | undefined {
  return CHAINS[chainId.toLowerCase()];
}

export function getSupportedChains(): ChainConfig[] {
  return Object.values(CHAINS);
}

export function getMainnetChains(): ChainConfig[] {
  return Object.values(CHAINS).filter((c) => !c.isTestnet);
}
