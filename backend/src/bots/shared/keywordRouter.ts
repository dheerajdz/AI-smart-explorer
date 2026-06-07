import { logger } from '../../utils/logger';
import { Platform, BotResponse } from './types';
import { disconnectWallet, getConnectedWallet } from '../../services/connectedWalletService';
import { detectNetwork } from '../../utils/network';
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

export async function keywordRouter(
  platform: Platform,
  userId: string,
  message: string
): Promise<BotResponse | null> {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  logger.info('[keywordRouter] Processing', { platform, userId, message: trimmed });

  const addr = extractAddress(trimmed);
  const connectedAddress = await getConnectedAddress(platform, userId);

  // ─── 0. Greetings ───────────────────────────────────────────
  if (
    lower === 'hi' ||
    lower === 'hii' ||
    lower === 'hello' ||
    lower === 'hey' ||
    lower === 'start'
  ) {
    // Greetings are handled by the dispatcher welcome service
    return null;
  }

  // ─── 1. Balance queries ─────────────────────────────────────
  if (lower.includes('balance') || lower.includes('how much')) {
    const target = addr || connectedAddress;
    if (!target) {
      return {
        text:
          '💰 *Balance Lookup*\n\n' +
          'Please provide a wallet address.\n\n' +
          'Try:\n' +
          '• `/balance xdc...`\n' +
          '• `/balance txdc...`',
        parseMode: 'markdown',
      };
    }
    return { text: (await cmdBalance(target)).text, parseMode: 'markdown' };
  }

  // ─── 2. Transaction queries ─────────────────────────────────
  if (
    lower.includes('transaction') ||
    lower.includes('tx history') ||
    lower.includes('history') ||
    lower.includes('recent tx')
  ) {
    const target = addr || connectedAddress;
    if (!target) {
      return {
        text:
          '📄 *Transaction History*\n\n' +
          'Please provide a wallet address.\n\n' +
          'Try:\n' +
          '• `/tx xdc...`\n' +
          '• `/tx txdc...`',
        parseMode: 'markdown',
      };
    }
    return { text: (await cmdTransactions(target, 5)).text, parseMode: 'markdown' };
  }

  // ─── 3. Gas price ───────────────────────────────────────────
  if (lower.includes('gas') || lower.includes('fee')) {
    return { text: (await cmdGasPrice()).text, parseMode: 'markdown' };
  }

  // ─── 4. Block info ──────────────────────────────────────────
  if (lower.includes('block')) {
    const match = trimmed.match(/(\d+)/);
    const blockNumber = match ? match[1] : 'latest';
    return { text: (await cmdBlockInfo(blockNumber)).text, parseMode: 'markdown' };
  }

  // ─── 5. Activity / Stats ────────────────────────────────────
  if (lower.includes('activity') || lower.includes('stats') || lower.includes('overview')) {
    const target = addr || connectedAddress;
    if (!target) {
      return {
        text: '📊 *Wallet Activity*\n\nPlease provide a wallet address.\n\nTry: `/activity xdc...`',
        parseMode: 'markdown',
      };
    }
    return { text: (await cmdWalletActivity(target)).text, parseMode: 'markdown' };
  }

  // ─── 6. Failed transactions ─────────────────────────────────
  if (lower.includes('failed')) {
    const target = addr || connectedAddress;
    if (!target) {
      return {
        text:
          '❌ *Failed Transactions*\n\n' +
          'Please provide a wallet address.\n\n' +
          'Try: `/failed xdc...`',
        parseMode: 'markdown',
      };
    }
    return { text: (await cmdFailedTransactions(target, 5)).text, parseMode: 'markdown' };
  }

  // ─── 7. Large transfers ─────────────────────────────────────
  if (lower.includes('large') || lower.includes('whale') || lower.includes('big transfer')) {
    const target = addr || connectedAddress;
    if (!target) {
      return {
        text:
          '🐋 *Large Transfers*\n\n' +
          'Please provide a wallet address.\n\n' +
          'Try: `/large xdc...`',
        parseMode: 'markdown',
      };
    }
    return { text: (await cmdLargeTransfers(target, 1000)).text, parseMode: 'markdown' };
  }

  // ─── 8. Price ───────────────────────────────────────────────
  if (lower.includes('price') || lower.includes('cost') || lower.includes('value')) {
    return { text: cmdPrice().text, parseMode: 'markdown' };
  }

  // ─── 9. Status / Network ────────────────────────────────────
  if (lower.includes('status') || lower.includes('network') || lower.includes('operational')) {
    return { text: (await cmdStatus()).text, parseMode: 'markdown' };
  }

  // ─── 10. Help ───────────────────────────────────────────────
  if (lower.includes('help') || lower === '?' || lower.includes('command')) {
    return { text: cmdHelp().text, parseMode: 'markdown' };
  }

  // ─── 11. Track ──────────────────────────────────────────────
  if (lower.includes('track') || lower.includes('monitor') || lower.includes('watch')) {
    const target = addr || connectedAddress;
    if (!target) {
      return {
        text:
          '🔔 *Track Wallet*\n\n' +
          'Please provide a wallet address.\n\n' +
          'Try: `/track xdc...`',
        parseMode: 'markdown',
      };
    }
    const result = await cmdTrack(target, userId);
    return { text: result.text, parseMode: 'markdown' };
  }

  // ─── 12. Untrack ────────────────────────────────────────────
  if (lower.includes('untrack') || lower.includes('stop monitoring')) {
    if (!addr) {
      return {
        text:
          '🔕 *Untrack Wallet*\n\n' +
          'Please provide a wallet address.\n\n' +
          'Try: `/untrack xdc...`',
        parseMode: 'markdown',
      };
    }
    const result = await cmdUntrack(addr, userId);
    return { text: result.text, parseMode: 'markdown' };
  }

  // ─── 13. List tracked ───────────────────────────────────────
  if (lower.includes('list') || lower.includes('tracked') || lower.includes('my wallets')) {
    const result = await cmdList(userId);
    return { text: result.text, parseMode: 'markdown' };
  }

  // ─── 14. Connect wallet ─────────────────────────────────────
  if (lower.includes('connect wallet') || lower.includes('add wallet') || lower.includes('link wallet')) {
    return {
      text:
        '🔗 *Connect Wallet*\n\n' +
        'Please send me your XDC address.\n\n' +
        'Example: `xdc1234...abcd` or `0xabcd...1234`',
      parseMode: 'markdown',
    };
  }

  // ─── 15. Disconnect wallet ──────────────────────────────────
  if (lower.includes('disconnect') || lower.includes('remove wallet') || lower.includes('logout wallet')) {
    const result = await disconnectWallet(userId, platform);
    return {
      text: result.success
        ? '✅ *Wallet Disconnected*\n\nYour wallet has been removed. Send /start to connect a new one.'
        : '⚠️ No wallet found to disconnect.',
      parseMode: 'markdown',
    };
  }

  // ─── No keyword match ───────────────────────────────────────
  return null;
}

function extractAddress(message: string): string {
  const match = message.match(/(0x[0-9a-fA-F]{40}|xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40})/);
  return match ? match[1] : '';
}

async function getConnectedAddress(platform: Platform, userId: string): Promise<string> {
  const wallet = await getConnectedWallet(userId, platform);
  if (!wallet) return '';
  const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
  return wallet.address.startsWith('0x') ? `${prefix}${wallet.address.slice(2)}` : wallet.address;
}
