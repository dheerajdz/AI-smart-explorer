import { Platform, BotResponse } from './types';
import { logger } from '../../utils/logger';
import { connectWallet, disconnectWallet, getConnectedWallet } from '../../services/connectedWalletService';
import { isValidXdcAddress, detectNetwork } from '../../utils/network';
import { ActivityLogModel } from '../../models/ActivityLog';
import { AlertPlatform } from '../../models/Alert';
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
  cmdAlertCreate,
  cmdAlertList,
  cmdAlertDelete,
  cmdContractDeployments,
} from '../../services/blockchainCommands';

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

    case '/gas':
      return { text: (await cmdGasPrice()).text, parseMode: 'markdown' };

    case '/block':
      if (!address) return { text: 'Usage: /block <number>' };
      return { text: (await cmdBlockInfo(address)).text, parseMode: 'markdown' };

    case '/balance': {
      const addr = address || (await getConnectedAddress(platform, userId));
      if (!addr) return { text: 'Usage: /balance <address>\n\nOr connect a wallet first.' };
      return { text: (await cmdBalance(addr)).text, parseMode: 'markdown' };
    }

    case '/tx':
    case '/transactions': {
      const addr = address || (await getConnectedAddress(platform, userId));
      if (!addr) return { text: 'Usage: /tx <address>\n\nOr connect a wallet first.' };
      return { text: (await cmdTransactions(addr, 5)).text, parseMode: 'markdown' };
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
      const trackResult = await cmdTrack(addr, userId, platform);
      return { text: trackResult.text, parseMode: 'markdown' };
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
      const untrackResult = await cmdUntrack(address, userId);
      return { text: untrackResult.text, parseMode: 'markdown' };

    case '/list': {
      const listResult = await cmdList(userId);
      return { text: listResult.text, parseMode: 'markdown' };
    }

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

    case '/deploys': {
      const addr = address || (await getConnectedAddress(platform, userId));
      if (!addr) return { text: 'Usage: /deploys <address>\n\nOr connect a wallet first.' };
      return { text: (await cmdContractDeployments(addr, 5)).text, parseMode: 'markdown' };
    }

    case '/alert': {
      const subCommand = args[0] || '';
      const alertType = args[1] || '';
      const alertAddress = args[2] || (await getConnectedAddress(platform, userId));

      if (!subCommand) {
        return {
          text:
            '🔔 *Alert Commands*\n\n' +
            '• \`/alert create new_tx xdc...\` — Notify on new transactions\n' +
            '• \`/alert create failed_tx xdc...\` — Notify on failed transactions\n' +
            '• \`/alert create contract_deploy xdc...\` — Notify on contract deployments\n' +
            '• \`/alert list\` — Show your alerts\n' +
            '• \`/alert delete <id>\` — Remove an alert',
          parseMode: 'markdown',
        };
      }

      if (subCommand === 'create') {
        if (!['new_tx', 'failed_tx', 'contract_deploy'].includes(alertType)) {
          return { text: '❌ Invalid alert type. Use: new_tx, failed_tx, or contract_deploy' };
        }
        if (!alertAddress) return { text: 'Usage: /alert create <type> <address>' };
        const result = await cmdAlertCreate(userId, platform as AlertPlatform, alertType as any, alertAddress);
        return { text: result.text, parseMode: 'markdown' };
      }

      if (subCommand === 'list') {
        const result = await cmdAlertList(userId, platform as AlertPlatform);
        return { text: result.text, parseMode: 'markdown' };
      }

      if (subCommand === 'delete') {
        const alertId = args[1] || '';
        if (!alertId) return { text: 'Usage: /alert delete <alert_id>' };
        const result = await cmdAlertDelete(alertId, userId);
        return { text: result.text, parseMode: 'markdown' };
      }

      return { text: 'Unknown alert subcommand. Use: create, list, or delete.' };
    }

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

  const connectResult = await connectWallet(userId, platform, address);
  const balanceResult = await cmdBalance(address);

  await ActivityLogModel.create({
    userId,
    platform,
    action: connectResult.success ? 'wallet_connect' : 'wallet_connect_failed',
    input: address,
    output: connectResult.message.substring(0, 200),
    metadata: { address, success: connectResult.success },
  });

  return {
    text:
      `${connectResult.message}\n\n${balanceResult.text}\n\n---\n\n` +
      `💡 *Tip:* Try:\n• "transactions"\n• "activity"\n• "track this wallet"`,
    parseMode: 'markdown',
  };
}
