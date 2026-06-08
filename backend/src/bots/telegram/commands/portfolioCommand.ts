import { Context } from 'telegraf';
import { getPortfolioSummary } from '../../../services/portfolioService';
import { getConnectedWallet } from '../../../services/connectedWalletService';
import { logger } from '../../../utils/logger';

export async function portfolioCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('Unable to identify your account.');
    return;
  }

  try {
    const userId = String(telegramId);
    
    // Get connected wallet for display
    const connectedWallet = await getConnectedWallet(userId, 'telegram');
    
    // Get portfolio summary
    const portfolio = await getPortfolioSummary(userId, 'telegram');

    if (portfolio.totalWallets === 0) {
      await ctx.reply(
        '📊 *Portfolio*\n\n' +
        'You have no wallets in your portfolio yet.\n\n' +
        'Use `/track <address>` to add wallets to your portfolio.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Build the formatted portfolio message
    const mainWallet = portfolio.wallets[0];
    const displayAddress = `${mainWallet.address.slice(0, 6)}...${mainWallet.address.slice(-4)}`;
    
    let message = '';
    message += '📊 *Portfolio Summary*\n\n';
    
    if (connectedWallet) {
      const connAddr = `${connectedWallet.address.slice(0, 6)}...${connectedWallet.address.slice(-4)}`;
      message += `🔌 Connected: \`${connAddr}\`\n`;
    }
    
    message += `📈 Total Wallets: *${portfolio.totalWallets}*\n\n`;
    message += '━━━━━━━━━━━━━━━\n\n';
    message += '💰 *Total Portfolio Value*\n';
    message += `${portfolio.totalBalanceXDC} XDC\n`;
    message += `≈ $${portfolio.totalBalanceUSD} USD\n\n`;
    
    message += '━━━━━━━━━━━━━━━\n\n';
    message += '📋 *Holdings*\n\n';

    for (const wallet of portfolio.wallets) {
      const addr = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
      const networkEmoji = wallet.network === 'testnet' ? '🧪' : '🌐';
      message += `${networkEmoji} \`${addr}\`  ${wallet.balanceXDC} XDC`;
      if (wallet.label) {
        message += ` (${wallet.label})`;
      }
      message += '\n';
    }
    
    message += '\n━━━━━━━━━━━━━━━\n\n';
    message += `_💡 Tip: Use /track to add more wallets to your portfolio_`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Portfolio command failed', { error: (err as Error).message });
    await ctx.reply('❌ Sorry, failed to load your portfolio. Please try again.');
  }
}
