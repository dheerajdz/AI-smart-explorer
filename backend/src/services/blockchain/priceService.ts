import axios from 'axios';
import { logger } from '../../utils/logger';

interface PriceResponse {
  xdc: {
    usd: number;
    usd_24h_change: number;
  };
}

let cachedPrice: { price: number; change: number; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute

export async function getXdcPrice(): Promise<{ usd: number; change24h: number }> {
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_TTL) {
    return { usd: cachedPrice.price, change24h: cachedPrice.change };
  }

  try {
    const response = await axios.get<PriceResponse>(
      'https://api.coingecko.com/api/v3/simple/price?ids=xdc-network&vs_currencies=usd&include_24hr_change=true',
      { timeout: 10000 }
    );

    const price = response.data.xdc.usd;
    const change = response.data.xdc.usd_24h_change;

    cachedPrice = { price, change, timestamp: Date.now() };
    return { usd: price, change24h: change };
  } catch (err) {
    logger.error('[priceService] Failed to fetch XDC price', { error: err });
    if (cachedPrice) {
      return { usd: cachedPrice.price, change24h: cachedPrice.change };
    }
    throw err;
  }
}
