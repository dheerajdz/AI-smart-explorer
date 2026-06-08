import { logger } from '../../utils/logger';
import { dispatch } from '../shared';
import { sendWhatsAppMessage } from './sendMessage';
import { ConversationStateService } from '../../services/conversation';
import { connectWallet, hasConnectedWallet } from '../../services/connectedWalletService';
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

  // Handle slash commands
  if (input.startsWith('/')) {
    const response = await dispatch('whatsapp', userId, input);
    return response.text;
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
