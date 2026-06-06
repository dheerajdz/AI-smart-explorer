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
    const result = await handleWhatsAppCommand(trimmedBody, from);
    await sendWhatsAppMessage(from, result);
    return;
  }

  // ─── Keyword shortcuts (no slash) ───────────────────────────
  const keywordResult = await handleKeywordShortcut(trimmedBody, from);
  if (keywordResult) {
    await sendWhatsAppMessage(from, keywordResult);
    return;
  }

  // ─── Natural language ───────────────────────────────────────
  const response = await messageRouter(trimmedBody, from);
  await sendWhatsAppMessage(from, response.text);
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
