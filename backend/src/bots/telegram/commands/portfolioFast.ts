import { Context } from 'telegraf';
import { PortfolioModel } from '../../../models/Portfolio';
import { getPortfolioData, refreshCache } from '../../../services/portfolioCache';
import { sendTelegramMessage } from '../utils';

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
export function startBackgroundRefresh() {
  setInterval(async () => {
    const portfolios = await PortfolioModel.getCollection().find({}).toArray();
    for (const p of portfolios) {
      await refreshCache(p.userId, p.wallets).catch(() => {});
    }
  }, 3 * 60 * 1000);
}
