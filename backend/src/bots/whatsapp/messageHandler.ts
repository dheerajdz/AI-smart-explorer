import { logger } from '../../utils/logger';
import { sendWhatsAppMessage } from './sendMessage';
import { messageRouter } from '../../services/messageRouter';
import {
  cmdBalance,
  cmdTransactions,
  cmdTrack,
  cmdUntrack,
  cmdList,
  cmdGasPrice,
  cmdBlockInfo,
  cmdFailedTransactions,
  cmdWalletActivity,
  cmdLargeTransfers,
  cmdPrice,
  cmdStatus,
  cmdHelp,
} from '../../services/blockchainCommands';

export async function messageHandler(from: string, body: string): Promise<void> {
  const trimmedBody = body.trim();

  logger.info('Processing WhatsApp message', { from, body: trimmedBody });

  // ─── Slash commands ─────────────────────────────────────────
  if (trimmedBody.startsWith('/')) {
    logger.info('WhatsApp: slash command detected');
    const result = await handleWhatsAppCommand(trimmedBody, from);
    logger.info('WhatsApp: sending slash response', { resultLength: result.length });
    await sendWhatsAppMessage(from, result);
    return;
  }

  // ─── Greetings ──────────────────────────────────────────────
  const lower = trimmedBody.toLowerCase();
  if (
    lower === 'hi' ||
    lower === 'hii' ||
    lower === 'hello' ||
    lower === 'hey' ||
    lower === 'start'
  ) {
    await sendWelcomeMessage(from);
    return;
  }

  // ─── Connect wallet intent ──────────────────────────────────
  if (lower.includes('connect wallet') || lower.includes('add wallet') || lower.includes('link wallet')) {
    logger.info('WhatsApp: connect wallet intent');
    await sendWhatsAppMessage(
      from,
      '🔗 *Connect Wallet*\n\nPlease send me your XDC address.\n\nExample: `xdc1234...abcd` or `0xabcd...1234`'
    );
    return;
  }

  // ─── Address-only message → connect wallet + show balance ────
  const addressMatch = trimmedBody.match(/\b(0x[0-9a-fA-F]{40}|xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40})\b/);
  if (addressMatch && trimmedBody.replace(addressMatch[0], '').trim().length === 0) {
    const address = addressMatch[1];
    logger.info('WhatsApp: address-only message', { address });

    const { connectWallet } = await import('../../services/connectedWalletService');
    const connectResult = await connectWallet(from, 'whatsapp', address);

    const balanceResult = await cmdBalance(address);

    await sendWhatsAppMessage(
      from,
      `${connectResult.message}\n\n${balanceResult.text}\n\n---\n\n💡 *Tip:* Try:\n• "transactions"\n• "activity"\n• "track this wallet"`
    );
    return;
  }

  // ─── Keyword shortcuts (no slash) ───────────────────────────
  logger.info('WhatsApp: checking keyword shortcuts');
  const keywordResult = await handleKeywordShortcut(trimmedBody, from);
  if (keywordResult) {
    logger.info('WhatsApp: sending keyword response');
    await sendWhatsAppMessage(from, keywordResult);
    return;
  }

  // ─── Natural language ───────────────────────────────────────
  logger.info('WhatsApp: routing to AI');
  const response = await messageRouter(trimmedBody, from);
  logger.info('WhatsApp: sending AI response', { textLength: response.text.length });
  await sendWhatsAppMessage(from, response.text);
}

async function sendWelcomeMessage(from: string): Promise<void> {
  const { hasConnectedWallet, getConnectedWallet } = await import('../../services/connectedWalletService');
  const connected = await hasConnectedWallet(from, 'whatsapp');

  if (connected) {
    const wallet = await getConnectedWallet(from, 'whatsapp');
    const address = wallet?.address ?? '';
    const networkLabel = wallet?.network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet';
    const shortAddr = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'Unknown';

    await sendWhatsAppMessage(
      from,
      `👋 *Welcome back!*\n\n` +
        `Your connected wallet:\n` +
        `${networkLabel} \`${shortAddr}\`\n\n` +
        `What would you like to do?\n\n` +
        `• "Balance"\n` +
        `• "Transactions"\n` +
        `• "Activity"\n` +
        `• "Gas price"\n` +
        `• "Track this wallet"\n` +
        `• "Disconnect wallet"`
    );
  } else {
    await sendWhatsAppMessage(
      from,
      `👋 *Welcome to Smart AI Explorer!*\n\n` +
        `I am your AI assistant for the *XDC blockchain*.\n\n` +
        `You can text me things like:\n` +
        `• "Balance of xdc..."\n` +
        `• "Show transactions"\n` +
        `• "Gas price"\n` +
        `• "Track wallet xdc..."\n\n` +
        `To get started, connect your wallet:\n` +
        `👉 Send: *connect wallet*`
    );
  }
}

async function handleWhatsAppCommand(message: string, userId: string): Promise<string> {
  const parts = message.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const address = args[0] || '';

  switch (command) {
    case '/help':
      return cmdHelp().text;

    case '/balance':
      if (!address) return 'Usage: /balance <address>';
      return (await cmdBalance(address)).text;

    case '/tx':
      if (!address) return 'Usage: /tx <address>';
      return (await cmdTransactions(address, 5)).text;

    case '/track':
      if (!address) return 'Usage: /track <address>';
      return cmdTrack(address, userId).text;

    case '/untrack':
      if (!address) return 'Usage: /untrack <address>';
      return cmdUntrack(address, userId).text;

    case '/list':
      return cmdList(userId).text;

    case '/gas':
      return (await cmdGasPrice()).text;

    case '/block':
      if (!address) return 'Usage: /block <number>';
      return (await cmdBlockInfo(address)).text;

    case '/failed':
      if (!address) return 'Usage: /failed <address>';
      return (await cmdFailedTransactions(address, 5)).text;

    case '/activity':
      if (!address) return 'Usage: /activity <address>';
      return (await cmdWalletActivity(address)).text;

    case '/large':
      if (!address) return 'Usage: /large <address>';
      return (await cmdLargeTransfers(address, 1000)).text;

    case '/price':
      return cmdPrice().text;

    case '/status':
      return (await cmdStatus()).text;

    default:
      return 'Unknown command. Type /help for available commands.';
  }
}

async function handleKeywordShortcut(message: string, userId: string): Promise<string | null> {
  const parts = message.split(/\s+/);
  const keyword = parts[0].toLowerCase();
  const rest = parts.slice(1).join(' ');

  const addrMatch = rest.match(/(0x[0-9a-fA-F]{40}|xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40})/);
  const address = addrMatch ? addrMatch[1] : '';

  switch (keyword) {
    case 'b':
    case 'bal':
      if (!address) return null;
      return (await cmdBalance(address)).text;

    case 't':
    case 'txs':
      if (!address) return null;
      return (await cmdTransactions(address, 5)).text;

    case 'gas':
      return (await cmdGasPrice()).text;

    case 'block':
      return (await cmdBlockInfo(rest || 'latest')).text;

    case 'status':
      return (await cmdStatus()).text;

    case 'track':
      if (!address) return null;
      return cmdTrack(address, userId).text;

    case 'untrack':
      if (!address) return null;
      return cmdUntrack(address, userId).text;

    case 'list':
      return cmdList(userId).text;

    case 'activity':
      if (!address) return null;
      return (await cmdWalletActivity(address)).text;

    case 'failed':
      if (!address) return null;
      return (await cmdFailedTransactions(address, 5)).text;

    case 'large':
      if (!address) return null;
      return (await cmdLargeTransfers(address, 1000)).text;

    case 'price':
      return cmdPrice().text;

    case 'help':
      return cmdHelp().text;

    default:
      return null;
  }
}
