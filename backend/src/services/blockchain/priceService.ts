import axios from 'axios';
import { logger } from '../../utils/logger';

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

interface CoinMarketCapResponse {
  data: {
    XDC: {
      quote: {
        USD: {
          price: number;
          percent_change_24h: number;
        };
      };
    };
  };
}

let cachedPrice: { price: number; change: number; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute

const COINGECKO_IDS = ['xdc-network', 'xdce-crowd-sale', 'xinfin-network'];

export async function getXdcPrice(): Promise<{ usd: number; change24h: number }> {
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_TTL) {
    return { usd: cachedPrice.price, change24h: cachedPrice.change };
  }

  // Try CoinGecko with multiple possible IDs
  for (const id of COINGECKO_IDS) {
    try {
      const response = await axios.get<CoinGeckoResponse>(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
        { timeout: 10000 }
      );

      const data = response.data[id];
      if (data?.usd) {
        cachedPrice = {
          price: data.usd,
          change: data.usd_24h_change || 0,
          timestamp: Date.now(),
        };
        logger.info('[priceService] Price fetched from CoinGecko', { id, price: data.usd });
        return { usd: data.usd, change24h: data.usd_24h_change || 0 };
      }
    } catch (err) {
      logger.warn(`[priceService] CoinGecko ID '${id}' failed, trying next...`);
    }
  }

  // Fallback: Try CoinMarketCap free API
  try {
    const response = await axios.get<CoinMarketCapResponse>(
      'https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail?slug=xinfin-network',
      { timeout: 10000 }
    );
    const usd = response.data?.data?.XDC?.quote?.USD;
    if (usd?.price) {
      cachedPrice = {
        price: usd.price,
        change: usd.percent_change_24h || 0,
        timestamp: Date.now(),
      };
      logger.info('[priceService] Price fetched from CoinMarketCap', { price: usd.price });
      return { usd: usd.price, change24h: usd.percent_change_24h || 0 };
    }
  } catch (err) {
    logger.warn('[priceService] CoinMarketCap fallback failed');
  }

  logger.error('[priceService] All price sources failed');
  if (cachedPrice) {
    return { usd: cachedPrice.price, change24h: cachedPrice.change };
  }
  throw new Error('Failed to fetch XDC price from all sources');
}
