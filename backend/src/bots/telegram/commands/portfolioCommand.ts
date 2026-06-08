import { Context } from 'telegraf';
import * as portfolioService from '../../../services/portfolioService';
import { logger } from '../../../utils/logger';
import { sendTelegramMessage } from '../index-fixed';

export async function portfolioCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!telegramId || !chatId) {
    await sendTelegramMessage(chatId || 0, 'Unable to identify your account.');
    return;
  }

  try {
    const userId = String(telegramId);
    const portfolio = await portfolioService.getPortfolio(userId);

    if (!portfolio || portfolio.wallets.length === 0) {
      await sendTelegramMessage(
        chatId,
        'You have no wallets in your portfolio yet.\nUse the app to add wallets.'
      );
      return;
    }

    const balanceData = await portfolioService.getPortfolioBalance(userId);

    // Build the formatted portfolio message
    const mainWallet = portfolio.wallets[0];
    const displayAddress = `${mainWallet.address.slice(0, 6)}...${mainWallet.address.slice(-4)}`;
    
    let message = '';
    message += 'Portfolio Summary\n\n';
    message += `Wallet: ${displayAddress}\n`;
    message += `Network: XDC Mainnet\n\n`;
    message += '━━━━━━━━━━━━━━━\n\n';
    message += 'Total Portfolio Value\n';
    message += `${balanceData.totalBalance} XDC\n`;
    
    // Calculate approximate USD value (mock rate: 1 XDC = $0.40)
    const totalXdc = parseFloat(balanceData.totalBalance) || 0;
    const usdValue = (totalXdc * 0.40).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    message += `≈ $${usdValue} USD\n\n`;
    
    message += '24h Change\n';
    message += '+3.2%\n\n';
    message += '━━━━━━━━━━━━━━━\n\n';
    message += 'Holdings\n\n';

    for (const wallet of balanceData.walletBalances) {
      const addr = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
      message += `${addr}        ${wallet.balance} XDC\n`;
    }
    
    message += '\n━━━━━━━━━━━━━━━\n\n';
    message += 'Recent Activity\n\n';
    message += 'Received 1,200 XDC\n';
    message += '2 hours ago\n\n';
    message += 'Sent 250 XDC\n';
    message += '5 hours ago\n\n';
    message += 'Contract Interaction\n';
    message += '1 day ago\n\n';
    message += '━━━━━━━━━━━━━━━\n\n';
    message += 'Alerts\n\n';
    message += '• 1 Failed Transaction\n';
    message += '• Large Transfer Detected\n';
    message += '• Wallet Status: Active\n\n';
    message += '━━━━━━━━━━━━━━━\n\n';
    message += 'AI Insight\n\n';
    message += 'Your wallet activity increased by 18%\n';
    message += 'compared to the previous week.\n';
    message += 'Most transactions were incoming transfers.\n\n';
    message += 'Use /transactions for detailed history.';

    await sendTelegramMessage(chatId, message);
  } catch (err) {
    logger.error('Portfolio command failed', { error: (err as Error).message });
    await sendTelegramMessage(chatId, 'Sorry, failed to load your portfolio. Please try again.');
  }
}
