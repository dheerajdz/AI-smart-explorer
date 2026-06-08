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

  // Handle greetings
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

  // Handle balance command with connected wallet
  if (lowerInput === 'balance' || lowerInput === '/balance') {
    const wallet = await getConnectedWallet(userId, 'whatsapp');
    if (wallet) {
      const { cmdBalance } = await import('../../services/blockchainCommands');
      const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
      const address = wallet.address.startsWith('0x')
        ? `${prefix}${wallet.address.slice(2)}`
        : wallet.address;
      const result = await cmdBalance(address);
      return result.text;
    }
  }

  // Handle transactions command with connected wallet
  if (lowerInput === 'transactions' || lowerInput === 'tx' || lowerInput === '/tx') {
    const wallet = await getConnectedWallet(userId, 'whatsapp');
    if (wallet) {
      const { cmdTransactions } = await import('../../services/blockchainCommands');
      const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
      const address = wallet.address.startsWith('0x')
        ? `${prefix}${wallet.address.slice(2)}`
        : wallet.address;
      const result = await cmdTransactions(address, 5);
      return result.text;
    }
  }

  // Handle track command with connected wallet
  if (lowerInput === 'track' || lowerInput === '/track') {
    const wallet = await getConnectedWallet(userId, 'whatsapp');
    if (wallet) {
      const { cmdTrack } = await import('../../services/blockchainCommands');
      const result = await cmdTrack(wallet.address, userId);
      return result.text;
    }
  }

  // Handle portfolio command with connected wallet
  if (lowerInput === 'portfolio' || lowerInput === '/portfolio') {
    const wallet = await getConnectedWallet(userId, 'whatsapp');
    if (wallet) {
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
  }

  // Handle gas command
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
      `*Portfolio:*\n` +
      `• portfolio - View your portfolio\n\n` +
      `*Other:*\n` +
      `• /subscription - Your subscription\n` +
      `• /upgrade - Upgrade plan\n` +
      `• disconnect - Disconnect wallet`;
  }

  // Handle disconnect command
  if (lowerInput === 'disconnect' || lowerInput === '/disconnect') {
    const { disconnectWallet } = await import('../../services/connectedWalletService');
    const result = await disconnectWallet(userId, 'whatsapp');
    return result.message;
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
    lower === 'hello' ||
    lower === 'hey' ||
    lower === 'start' ||
    lower === 'welcome'
  );
}
