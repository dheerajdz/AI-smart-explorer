import { Platform, BotResponse } from './types';
import { logger } from '../../utils/logger';
import { connectWallet, disconnectWallet, getConnectedWallet } from '../../services/connectedWalletService';
import { isValidXdcAddress, detectNetwork } from '../../utils/network';
import { ActivityLogModel } from '../../models/ActivityLog';
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
  cmdListAlerts,
  cmdPauseAllAlerts,
  cmdSetLanguage,
  cmdCreateAlert,
  cmdDeleteAlert,
  cmdPremium,
  cmdReputation,
  cmdLeaderboard,
} from '../../services/blockchainCommands';
import { getMultiChainBalance, getMultiChainTransactions, getMultiChainGasPrice } from '../../services/multiChain/multiChainService';
import { getSupportedChains, getChainConfig } from '../../config/chains';
import { getUserTranslation, setUserLanguage } from '../../services/i18nService';

export async function commandRouter(
  platform: Platform,
  userId: string,
  command: string,
  args: string[]
): Promise<BotResponse> {
  const normalized = command.toLowerCase();
  const address = args[0] || '';

  logger.info('[commandRouter]', { platform, userId, command: normalized, args });

  switch (normalized) {
    case '/start':
      return { text: 'Use the greeting flow from dispatcher.', parseMode: 'markdown' };

    case '/help':
      return { text: cmdHelp().text, parseMode: 'markdown' };

    case '/status':
      return { text: (await cmdStatus()).text, parseMode: 'markdown' };

    case '/price':
      return { text: cmdPrice().text, parseMode: 'markdown' };

    case '/gas': {
      const gasChainId = args[0]?.toLowerCase();
      if (gasChainId && ['xdc', 'txdc', 'eth', 'base', 'polygon', 'bsc'].includes(gasChainId)) {
        try {
          const result = await getMultiChainGasPrice(gasChainId);
          return {
            text:
              `⛽ *Gas Price*\n\n` +
              `Chain: ${getChainConfig(gasChainId)?.name || gasChainId}\n` +
              `Safe: **${result.safeGasPrice} Gwei**\n` +
              `Standard: **${result.proposeGasPrice} Gwei**\n` +
              `Fast: **${result.fastGasPrice} Gwei**`,
            parseMode: 'markdown',
          };
        } catch (err) {
          return { text: `❌ Failed to fetch gas price for ${gasChainId}.` };
        }
      }
      return { text: (await cmdGasPrice()).text, parseMode: 'markdown' };
    }

    case '/block':
      if (!address) return { text: 'Usage: /block <number>' };
      return { text: (await cmdBlockInfo(address)).text, parseMode: 'markdown' };

    case '/chains':
      const chains = getSupportedChains();
      const chainList = chains.map(c => `${c.logo} ${c.name} (${c.id}) — ${c.nativeToken}`).join('\n');
      return {
        text: `🌐 *Supported Chains*\n\n${chainList}\n\nUse: \`/balance <chain> <address>\`\nExample: \`/balance eth 0x1234...\``,
        parseMode: 'markdown',
      };

    case '/balance': {
      const chainId = args[0]?.toLowerCase();
      const addr = args[1] || (await getConnectedAddress(platform, userId));
      
      // If first arg is a chain ID
      if (chainId && ['xdc', 'txdc', 'eth', 'base', 'polygon', 'bsc'].includes(chainId)) {
        if (!addr) return { text: `Usage: /balance ${chainId} <address>\n\nOr connect a wallet first.` };
        try {
          const result = await getMultiChainBalance(addr, chainId);
          return {
            text:
              `${getChainConfig(chainId)?.logo || '💰'} *Wallet Balance*\n\n` +
              `Chain: ${getChainConfig(chainId)?.name || chainId}\n` +
              `Address: \`${result.address}\`\n` +
              `Balance: **${result.balanceFormatted} ${result.symbol}**\n\n` +
              `[View on Explorer](${result.explorerUrl})`,
            parseMode: 'markdown',
          };
        } catch (err) {
          return { text: `❌ Failed to fetch balance on ${chainId}. Please try again later.` };
        }
      }
      
      // Default XDC behavior
      const xdcAddr = chainId || (await getConnectedAddress(platform, userId));
      if (!xdcAddr) return { text: 'Usage: /balance <address>\n\nOr connect a wallet first.' };
      return { text: (await cmdBalance(xdcAddr)).text, parseMode: 'markdown' };
    }

    case '/tx':
    case '/transactions': {
      const txChainId = args[0]?.toLowerCase();
      const txAddr = args[1] || (await getConnectedAddress(platform, userId));
      
      if (txChainId && ['xdc', 'txdc', 'eth', 'base', 'polygon', 'bsc'].includes(txChainId)) {
        if (!txAddr) return { text: `Usage: /tx ${txChainId} <address>\n\nOr connect a wallet first.` };
        try {
          const result = await getMultiChainTransactions(txAddr, txChainId, 1, 5);
          let text = `${getChainConfig(txChainId)?.logo || '📄'} *Recent Transactions*\n\n` +
            `Chain: ${getChainConfig(txChainId)?.name || txChainId}\n` +
            `Address: \`${result.address}\`\n` +
            `Showing: ${result.transactions.length}\n\n`;
          
          result.transactions.forEach((tx, i) => {
            text += `${i + 1}. \`${tx.hash.slice(0, 20)}...\` — ${parseFloat(tx.value) / 1e18} ${getChainConfig(txChainId)?.nativeToken}\n`;
          });
          
          text += `\n[View on Explorer](${result.explorerUrl})`;
          return { text, parseMode: 'markdown' };
        } catch (err) {
          return { text: `❌ Failed to fetch transactions on ${txChainId}. Please try again later.` };
        }
      }
      
      const xdcTxAddr = txChainId || (await getConnectedAddress(platform, userId));
      if (!xdcTxAddr) return { text: 'Usage: /tx <address>\n\nOr connect a wallet first.' };
      return { text: (await cmdTransactions(xdcTxAddr, 5)).text, parseMode: 'markdown' };
    }

    case '/activity': {
      const addr = address || (await getConnectedAddress(platform, userId));
      if (!addr) return { text: 'Usage: /activity <address>\n\nOr connect a wallet first.' };
      return { text: (await cmdWalletActivity(addr)).text, parseMode: 'markdown' };
    }

    case '/failed': {
      const addr = address || (await getConnectedAddress(platform, userId));
      if (!addr) return { text: 'Usage: /failed <address>\n\nOr connect a wallet first.' };
      return { text: (await cmdFailedTransactions(addr, 5)).text, parseMode: 'markdown' };
    }

    case '/large': {
      const addr = address || (await getConnectedAddress(platform, userId));
      if (!addr) return { text: 'Usage: /large <address>\n\nOr connect a wallet first.' };
      return { text: (await cmdLargeTransfers(addr, 1000)).text, parseMode: 'markdown' };
    }

    case '/track': {
      const addr = address || (await getConnectedAddress(platform, userId));
      if (!addr) return { text: 'Usage: /track <address>\n\nOr connect a wallet first.' };
      await ActivityLogModel.create({
        userId,
        platform,
        action: 'track_wallet',
        input: addr,
        metadata: { address: addr },
      });
      return { text: (await cmdTrack(addr, userId, platform)).text, parseMode: 'markdown' };
    }

    case '/untrack':
      if (!address) return { text: 'Usage: /untrack <address>' };
      await ActivityLogModel.create({
        userId,
        platform,
        action: 'untrack_wallet',
        input: address,
        metadata: { address },
      });
      return { text: (await cmdUntrack(address, userId)).text, parseMode: 'markdown' };

    case '/list':
      return { text: cmdList(userId).text, parseMode: 'markdown' };

    case '/alerts':
      return { text: (await cmdListAlerts(userId)).text, parseMode: 'markdown' };

    case '/stopalerts':
    case '/pausealerts':
      return { text: (await cmdPauseAllAlerts(userId)).text, parseMode: 'markdown' };

    case '/premium':
      return { text: (await cmdPremium(userId)).text, parseMode: 'markdown' };

    case '/language': {
      const lang = args[0]?.toLowerCase();
      const validLangs = ['en', 'hi', 'mr'];
      
      // If no language provided, show picker
      if (!lang || !validLangs.includes(lang)) {
        return {
          text:
            `🌐 *Select Language*\n\n` +
            `Current: ${(await getUserTranslation(userId, platform)).prompt_select_language}\n\n` +
            `Choose:\n` +
            `• \`/language en\` — English 🇬🇧\n` +
            `• \`/language hi\` — हिन्दी 🇮🇳\n` +
            `• \`/language mr\` — मराठी 🇮🇳`,
          parseMode: 'markdown',
        };
      }
      
      // Set language using i18nService
      const success = await setUserLanguage(userId, platform, lang);
      if (!success) {
        return { text: '❌ Failed to set language. Please try again.' };
      }
      
      const messages: Record<string, string> = {
        en: '✅ Language set to English 🇬🇧',
        hi: '✅ भाषा हिंदी में सेट की गई 🇮🇳',
        mr: '✅ भाषा मराठीत सेट केली 🇮🇳',
      };
      
      return { text: messages[lang] || messages['en'] };
    }

    case '/alert': {
      if (!address) {
        return {
          text:
            `🔔 *Create Alert*\n\n` +
            `Usage examples:\n` +
            `• \`/alert gas > 50\` — Gas price alert\n` +
            `• \`/alert price < 0.02\` — Price alert\n` +
            `• \`/alert failed xdc...\` — Failed tx alert\n` +
            `• \`/alert incoming xdc...\` — Incoming tx alert\n\n` +
            `Or use natural language:\n` +
            `"Alert me when XDC drops below \$0.02"`,
          parseMode: 'markdown',
        };
      }
      // Map symbolic operators to schema enum values
      const mappedArgs = [...args];
      if (mappedArgs[1] === '>') mappedArgs[1] = 'above';
      if (mappedArgs[1] === '<') mappedArgs[1] = 'below';
      if (mappedArgs[1] === '=') mappedArgs[1] = 'equals';
      return { text: (await cmdCreateAlert(userId, platform, userId, mappedArgs)).text, parseMode: 'markdown' };
    }

    case '/deletealert':
      if (!address) return { text: 'Usage: /deletealert <id>\n\nUse /alerts to see your alert IDs.' };
      return { text: (await cmdDeleteAlert(address, userId)).text, parseMode: 'markdown' };

    case '/disconnect':
      const result = await disconnectWallet(userId, platform);
      await ActivityLogModel.create({
        userId,
        platform,
        action: result.success ? 'wallet_disconnect' : 'wallet_disconnect_failed',
        metadata: { success: result.success },
      });
      return {
        text: result.success
          ? '✅ *Wallet Disconnected*\n\nYour wallet has been removed. Send /start to connect a new one.'
          : '⚠️ No wallet found to disconnect.',
        parseMode: 'markdown',
      };

    case '/rep':
    case '/reputation': {
      const addr = address || (await getConnectedAddress(platform, userId));
      if (!addr) return { text: 'Usage: /reputation <address>\n\nOr connect a wallet first.' };
      return { text: (await cmdReputation(addr)).text, parseMode: 'markdown' };
    }

    case '/leaderboard':
      return { text: (await cmdLeaderboard()).text, parseMode: 'markdown' };

    default:
      return { text: 'Unknown command. Type /help for available commands.' };
  }
}

async function getConnectedAddress(platform: Platform, userId: string): Promise<string> {
  const wallet = await getConnectedWallet(userId, platform);
  if (!wallet) return '';
  const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
  return wallet.address.startsWith('0x') ? `${prefix}${wallet.address.slice(2)}` : wallet.address;
}

export async function handleAddressOnly(
  platform: Platform,
  userId: string,
  address: string
): Promise<BotResponse> {
  if (!isValidXdcAddress(address)) {
    return { text: '❌ Invalid XDC address. Please check and try again.' };
  }

  // Check for conversation state (WhatsApp network selection)
  let network: 'mainnet' | 'testnet' | undefined;
  if (platform === 'whatsapp') {
    const { ConversationStateService } = await import('../../services/conversation/ConversationState');
    const state = await ConversationStateService.getState(parseInt(userId) || 0);
    if (state && state.step === 'enter_wallet_address') {
      network = state.network;
      await ConversationStateService.clearState(parseInt(userId) || 0);
    }
  }

  const connectResult = await connectWallet(userId, platform, address, network);
  const balanceResult = await cmdBalance(address, network);

  await ActivityLogModel.create({
    userId,
    platform,
    action: connectResult.success ? 'wallet_connect' : 'wallet_connect_failed',
    input: address,
    output: connectResult.message.substring(0, 200),
    metadata: { address, success: connectResult.success, network },
  });

  return {
    text:
      `${connectResult.message}\n\n${balanceResult.text}\n\n---\n\n` +
      `💡 *Tip:* Try:\n• "transactions"\n• "activity"\n• "track this wallet"`,
    parseMode: 'markdown',
  };
}
