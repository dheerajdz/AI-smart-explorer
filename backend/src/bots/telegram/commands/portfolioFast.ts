import { Context } from 'telegraf';
import { PortfolioModel } from '../../../models/Portfolio';
import { getPortfolioData, refreshCache } from '../../../services/portfolioCache';
import { sendTelegramMessage } from '../utils';
import { logger } from '../../../utils/logger';

export default async function portfolioFast(ctx: Context) {
  const userId = ctx.from?.id?.toString();
  if (!userId) return;

  // Send "Loading..." instantly
  await sendTelegramMessage(userId, '⏳ Fetching portfolio...');

  const portfolio = await PortfolioModel.findByUser(userId, 'telegram');
  if (!portfolio || portfolio.wallets.length === 0) {
    await sendTelegramMessage(userId, 
      'Portfolio\n\nYou have no wallets yet. Use the app to add wallets.');
    return;
  }

  // Get data (cached = instant, or fetch new)
  const data = await getPortfolioData(userId, portfolio.wallets);

  const holdingsText = data.holdings.map((h: any) =>
    `${h.name}: ${h.balance} ${h.symbol} ($${h.valueUSD})`
  ).join('\n');

  const activityText = data.recentActivity.map((a: any) =>
    `${a.type === 'receive' ? '↓' : '↑'} ${a.amount} — ${a.time} (${a.status})`
  ).join('\n');

  const alertsText = data.alerts.map((a: any) =>
    `• ${a.message}`
  ).join('\n');

  const message = `📊 Portfolio Summary

` +
    `Wallet: ${data.wallet}\n` +
    `Network: ${data.network}\n\n` +
    `💰 Total Value: ${data.totalXdc} XDC ($${data.totalUsd})\n` +
    `📈 24h Change: ${data.change24h} (${data.changeValue})\n\n` +
    `📋 Holdings:\n${holdingsText}\n\n` +
    `📝 Recent Activity:\n${activityText}\n\n` +
    `🔔 Alerts:\n${alertsText}\n\n` +
    `🤖 AI Insight:\n${data.aiInsight}\n\n` +
    `${data.cached ? '⚡ Cached data' : '✅ Live data'}`;

  await sendTelegramMessage(userId, message);
}

// Background refresh every 3 minutes
let refreshInterval: NodeJS.Timeout | null = null;

export function startBackgroundRefresh() {
  // Prevent multiple intervals
  if (refreshInterval) {
    logger.warn('[portfolioFast] Background refresh already running');
    return;
  }

  refreshInterval = setInterval(async () => {
    try {
      const portfolios = await PortfolioModel.getCollection().find({}).toArray();
      logger.info(`[portfolioFast] Refreshing ${portfolios.length} portfolios`);

      // Process in batches of 10 to avoid event loop blocking
      const BATCH_SIZE = 10;
      for (let i = 0; i < portfolios.length; i += BATCH_SIZE) {
        const batch = portfolios.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async (p) => {
            try {
              await refreshCache(p.userId, p.wallets);
            } catch (err: any) {
              logger.error(`[portfolioFast] Failed to refresh cache for user ${p.userId}`, {
                error: err.message,
              });
            }
          })
        );
      }

      logger.info('[portfolioFast] Background refresh complete');
    } catch (err: any) {
      logger.error('[portfolioFast] Background refresh cycle failed', { error: err.message });
    }
  }, 3 * 60 * 1000);

  logger.info('[portfolioFast] Background refresh started');
}

export function stopBackgroundRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    logger.info('[portfolioFast] Background refresh stopped');
  }
}
