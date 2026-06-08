import { logger } from '../../utils/logger';
import { dispatch } from '../shared';
import { sendWhatsAppMessage } from './sendMessage';
import { ConversationStateService } from '../../services/conversation';
import { connectWallet, disconnectWallet, getConnectedWallet, hasConnectedWallet } from '../../services/connectedWalletService';
import { setUserLanguage } from '../../services/i18nService';

/**
 * Handle incoming WhatsApp messages with conversation state support
 */
export async function handleWhatsAppMessage(fromNumber: string, text: string): Promise<string> {
  const input = text.trim();
  const userId = fromNumber;

  logger.info('[whatsapp/adapter] Received message', { from: fromNumber, input });

  // Auto-detect language on first interaction
  const isFirstInteraction = !(await hasConnectedWallet(userId, 'whatsapp'));
  if (isFirstInteraction) {
    await setUserLanguage(userId, 'whatsapp', 'en');
  }

  // Check conversation state
  const state = await ConversationStateService.getState(Number(userId));

  // Handle network selection via text
  const lowerInput = input.toLowerCase();

  // Handle greetings FIRST (before network selection check)
  if (isGreeting(lowerInput)) {
    const { generateWelcome } = await import('../shared/welcome');
    const welcome = await generateWelcome('whatsapp', userId);

    // Set select_network state for new users
    if (isFirstInteraction) {
      await ConversationStateService.setState({
        step: 'select_network',
        telegramId: Number(userId),
      });
    }

    return welcome.text;
  }

  if (state?.step === 'select_network' || isFirstInteraction) {
    if (['1', 'mainnet', 'xdc mainnet', 'main'].includes(lowerInput)) {
      return handleNetworkSelection(userId, 'mainnet');
    }
    if (['2', 'testnet', 'xdc testnet', 'test'].includes(lowerInput)) {
      return handleNetworkSelection(userId, 'testnet');
    }
  }

  if (state?.step === 'enter_wallet_address') {
    return handleWalletAddressInput(userId, input, state.network || 'mainnet');
  }

  // Handle menu numbers (1-6) for connected wallets
  const wallet = await getConnectedWallet(userId, 'whatsapp');
  
  if (wallet) {
    // Menu option 1: View Balance
    if (lowerInput === '1' || lowerInput === 'balance' || lowerInput.includes('balance')) {
      const { cmdBalance } = await import('../../services/blockchainCommands');
      const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
      const address = wallet.address.startsWith('0x')
        ? `${prefix}${wallet.address.slice(2)}`
        : wallet.address;
      const result = await cmdBalance(address);
      return result.text;
    }

    // Menu option 2: Transactions
    if (lowerInput === '2' || lowerInput === 'tx' || lowerInput === 'transactions' || lowerInput.includes('transaction')) {
      const { cmdTransactions } = await import('../../services/blockchainCommands');
      const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
      const address = wallet.address.startsWith('0x')
        ? `${prefix}${wallet.address.slice(2)}`
        : wallet.address;
      const result = await cmdTransactions(address, 5);
      return result.text;
    }

    // Menu option 3: Activity
    if (lowerInput === '3' || lowerInput === 'activity' || lowerInput.includes('activity')) {
      const { cmdWalletActivity } = await import('../../services/blockchainCommands');
      const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
      const address = wallet.address.startsWith('0x')
        ? `${prefix}${wallet.address.slice(2)}`
        : wallet.address;
      const result = await cmdWalletActivity(address);
      return result.text;
    }

    // Menu option 4: Gas Price
    if (lowerInput === '4' || lowerInput === 'gas' || lowerInput.includes('gas')) {
      const { cmdGasPrice } = await import('../../services/blockchainCommands');
      const result = await cmdGasPrice();
      return result.text;
    }

    // Menu option 5: Track
    if (lowerInput === '5' || lowerInput === 'track' || lowerInput.includes('track')) {
      const { cmdTrack } = await import('../../services/blockchainCommands');
      const result = await cmdTrack(wallet.address, userId);
      return result.text;
    }

    // Menu option 6: Disconnect
    if (lowerInput === '6' || lowerInput === 'disconnect' || lowerInput.includes('disconnect')) {
      const result = await disconnectWallet(userId, 'whatsapp');
      return result.message;
    }

    // Portfolio command
    if (lowerInput === 'portfolio' || lowerInput === '/portfolio' || lowerInput.includes('portfolio')) {
      const { getPortfolioSummary } = await import('../../services/portfolioService');
      const portfolio = await getPortfolioSummary(userId, 'whatsapp');
      
      if (portfolio.totalWallets === 0) {
        return '📊 *Portfolio*\n\nYou have no wallets in your portfolio yet.\n\nUse `/track <address>` to add wallets.';
      }
      
      let message = '📊 *Portfolio Summary*\n\n';
      message += `📈 Total Wallets: *${portfolio.totalWallets}*\n\n`;
      message += '💰 *Total Portfolio Value*\n';
      message += `${portfolio.totalBalanceXDC} XDC\n`;
      message += `≈ $${portfolio.totalBalanceUSD} USD\n\n`;
      message += '📋 *Holdings*\n\n';
      
      for (const w of portfolio.wallets) {
        const addr = `${w.address.slice(0, 6)}...${w.address.slice(-4)}`;
        const networkEmoji = w.network === 'testnet' ? '🧪' : '🌐';
        message += `${networkEmoji} \`${addr}\`  ${w.balanceXDC} XDC\n`;
      }
      
      return message;
    }

    // Reputation command
    if (lowerInput.startsWith('reputation') || lowerInput.startsWith('/reputation')) {
      const parts = input.split(/\s+/);
      let address = parts[1] || '';
      
      // If no address provided, use connected wallet
      if (!address) {
        address = wallet.address;
      }
      
      if (!address) {
        return '💎 *Reputation Check*\n\nUsage: `reputation <address>`\n\nOr connect a wallet first.';
      }
      
      const { getReputation } = await import('../../services/reputation/reputationService');
      const reputation = await getReputation(address);
      
      if (!reputation) {
        return '💎 *Reputation*\n\n' +
          `Address: \`${address}\`\n\n` +
          'No reputation data found.\n' +
          'This wallet has not been analyzed yet.';
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
      
      message += `_💡 Tip: Use "leaderboard" to see top wallets_`;
      
      return message;
    }

    // Leaderboard command
    if (lowerInput === 'leaderboard' || lowerInput === '/leaderboard') {
      const { getLeaderboard } = await import('../../services/reputation/reputationService');
      const leaderboard = await getLeaderboard('mainnet', 10);
      
      if (!leaderboard || leaderboard.length === 0) {
        return '🏆 *Leaderboard*\n\nNo wallets ranked yet.\nBe the first to build your reputation!';
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
      message += `_Check your score: reputation <address>_`;
      
      return message;
    }
  }

  // Handle gas command (without wallet)
  if (lowerInput === 'gas' || lowerInput === '/gas') {
    const { cmdGasPrice } = await import('../../services/blockchainCommands');
    const result = await cmdGasPrice();
    return result.text;
  }

  // Handle status command
  if (lowerInput === 'status' || lowerInput === '/status') {
    const { cmdStatus } = await import('../../services/blockchainCommands');
    const result = await cmdStatus();
    return result.text;
  }

  // Handle help command
  if (lowerInput === 'help' || lowerInput === '/help') {
    return `🤖 *AI Smart Explorer - Help*\n\n` +
      `*Wallet Commands:*\n` +
      `• balance - Check your connected wallet balance\n` +
      `• tx - View your transactions\n` +
      `• track <address> - Track a wallet\n` +
      `• untrack <address> - Stop tracking\n` +
      `• list - Show tracked wallets\n\n` +
      `*Network Commands:*\n` +
      `• gas - Current gas prices\n` +
      `• status - Network status\n` +
      `• block <number> - Block info\n\n` +
      `*Portfolio & Reputation:*\n` +
      `• portfolio - View your portfolio\n` +
      `• reputation <address> - Check wallet reputation\n` +
      `• leaderboard - Top wallets by reputation\n\n` +
      `*Other:*\n` +
      `• /subscription - Your subscription\n` +
      `• /upgrade - Upgrade plan\n` +
      `• disconnect - Disconnect wallet`;
  }

  // Route through unified dispatcher for everything else
  const response = await dispatch('whatsapp', userId, input);
  return response.text;
}

async function handleNetworkSelection(userId: string, network: 'mainnet' | 'testnet'): Promise<string> {
  logger.info('[whatsapp/adapter] Network selected', { userId, network });

  // Set state to await wallet address
  await ConversationStateService.setState({
    step: 'enter_wallet_address',
    telegramId: Number(userId),
    network,
  });

  const label = network === 'mainnet' ? '🌐 XDC Mainnet' : '🧪 XDC Testnet';
  return `${label} selected.\n\nPlease enter your wallet address:`;
}

async function handleWalletAddressInput(userId: string, address: string, network: 'mainnet' | 'testnet'): Promise<string> {
  logger.info('[whatsapp/adapter] Wallet address input', { userId, address });

  const result = await connectWallet(userId, 'whatsapp', address, network);

  if (result.success) {
    await ConversationStateService.clearState(Number(userId));
    return result.message + '\n\nYou can now use commands like:\n• /balance\n• /tx\n• /track\n• /portfolio';
  } else {
    return result.message + '\n\nPlease enter a valid wallet address:';
  }
}

function isGreeting(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    lower === 'hi' ||
    lower === 'hii' ||
    lower === 'hiii' ||
    lower === 'hello' ||
    lower === 'hey' ||
    lower === 'start' ||
    lower === 'welcome' ||
    /^hi+$/i.test(lower) || // Matches hi, hii, hiii, etc.
    /^he+y+$/i.test(lower) || // Matches hey, heyy, etc.
    /^hello+$/i.test(lower) // Matches hello, helloo, etc.
  );
}
