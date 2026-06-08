import { Context } from 'telegraf';
import { getReputation, getLeaderboard } from '../../../services/reputation/reputationService';
import { getConnectedWallet } from '../../../services/connectedWalletService';
import { logger } from '../../../utils/logger';

export async function reputationCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('Unable to identify your account.');
    return;
  }

  try {
    const userId = String(telegramId);
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.split(/\s+/);
    let address = parts[1] || '';

    // If no address provided, use connected wallet
    if (!address) {
      const wallet = await getConnectedWallet(userId, 'telegram');
      if (wallet) {
        address = wallet.address;
      }
    }

    if (!address) {
      await ctx.reply(
        '💎 *Reputation Check*\n\n' +
        'Usage: `/reputation <address>`\n\n' +
        'Or connect a wallet with /start',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const reputation = await getReputation(address);

    if (!reputation) {
      await ctx.reply(
        '💎 *Reputation*\n\n' +
        `Address: \`${address}\`\n\n` +
        'No reputation data found.\n' +
        'This wallet has not been analyzed yet.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const tierEmoji = reputation.overallScore >= 90 ? '👑' : 
                      reputation.overallScore >= 80 ? '🥇' :
                      reputation.overallScore >= 70 ? '🥈' :
                      reputation.overallScore >= 60 ? '🥉' : '📊';

    let message = '';
    message += `💎 *Wallet Reputation*\n\n`;
    message += `Address: \`${address}\`\n`;
    message += `Score: *${reputation.overallScore}/100* ${tierEmoji}\n`;
    message += `Tier: *${reputation.tier}*\n\n`;
    
    message += '📊 *Metrics*\n';
    message += `• Transaction Count: ${reputation.metrics.transactionCount}\n`;
    message += `• Account Age: ${reputation.metrics.accountAgeDays} days\n`;
    message += `• Avg Tx Value: ${reputation.metrics.avgTxValueXDC} XDC\n`;
    message += `• Contract Interactions: ${reputation.metrics.contractInteractions}\n\n`;

    if (reputation.badges && reputation.badges.length > 0) {
      message += '🏅 *Badges*\n';
      reputation.badges.forEach((badge: string) => {
        const emoji = badge === 'whale' ? '🐋' :
                     badge === 'early_adopter' ? '🚀' :
                     badge === 'power_user' ? '⚡' :
                     badge === 'contract_deployer' ? '📜' :
                     badge === 'validator' ? '✅' : '🌟';
        message += `${emoji} ${badge.replace('_', ' ')}\n`;
      });
      message += '\n';
    }

    message += `_💡 Tip: Use /leaderboard to see top wallets_`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Reputation command failed', { error: (err as Error).message });
    await ctx.reply('❌ Failed to load reputation. Please try again.');
  }
}

export async function leaderboardCommand(ctx: Context): Promise<void> {
  try {
    const leaderboard = await getLeaderboard('mainnet', 10);

    if (!leaderboard || leaderboard.length === 0) {
      await ctx.reply(
        '🏆 *Leaderboard*\n\n' +
        'No wallets ranked yet.\n' +
        'Be the first to build your reputation!',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let message = '';
    message += '🏆 *Reputation Leaderboard*\n\n';
    message += 'Top 10 Wallets by Reputation Score\n\n';

    leaderboard.forEach((entry: any, index: number) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const addr = `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`;
      message += `${medal} \`${addr}\` — *${entry.overallScore}* pts\n`;
    });

    message += '\n💎 *How to improve:*\n';
    message += '• Make more transactions\n';
    message += '• Interact with contracts\n';
    message += '• Hold tokens long-term\n\n';
    message += `_Check your score: /reputation <address>_`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Leaderboard command failed', { error: (err as Error).message });
    await ctx.reply('❌ Failed to load leaderboard. Please try again.');
  }
}
