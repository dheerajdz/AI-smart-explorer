// ============================================================
// blockchainCommands.ts
// Shared command logic for Telegram and WhatsApp bots.
// Each function is platform-agnostic — returns raw data + text.
// Platform-specific formatting happens in the bot layer.
// ============================================================

import { logger } from '../utils/logger';
import { Network, detectNetwork, isValidXdcAddress, getExplorerBaseUrl } from '../utils/network';
import {
  getWalletBalance,
  getTransactions,
  getWalletActivity,
  getLargeTransfers,
  getGasPrice,
  getBlockByNumber,
  getFailedTransactions,
  getNetworkStats,
} from './blockchain';
import * as walletService from './walletService';
import { getReputation, getLeaderboard, getTier, getTierEmoji } from './reputation/reputationService';
import { getTranslationByLang } from '../services/i18nService';

// ─── Types ──────────────────────────────────────────────────

export interface CommandResult {
  success: boolean;
  text: string;
  rawData?: any;
}

// ─── Helper ─────────────────────────────────────────────────

function formatError(context: string, error: unknown, lang: string = 'en'): CommandResult {
  logger.error(`[blockchainCommands] ${context} failed`, { error });
  const t = getTranslationByLang(lang);
  return { success: false, text: t.err_server_error };
}

// ─── 1. Balance ─────────────────────────────────────────────

export async function cmdBalance(address: string, network?: Network, lang: string = 'en'): Promise<CommandResult> {
  const t = getTranslationByLang(lang);
  
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: t.err_invalid_address,
    };
  }

  try {
    const detectedNetwork = network || detectNetwork(address);
    const data = await getWalletBalance(address, detectedNetwork);

    return {
      success: true,
      text:
        `💰 *${t.cmd_balance_title}*\n\n` +
        `Network: ${detectedNetwork === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Address: \`${data.address}\`\n` +
        `Balance: **${data.balanceXDC} ${detectedNetwork === 'testnet' ? 'TXDC' : 'XDC'}**\n\n` +
        `[View on Explorer](${data.explorerUrl})\n\n` +
        `_💡 Tip: Use /reputation ${address} to see reputation score_`,
      rawData: data,
    };
  } catch (err) {
    return formatError('cmdBalance', err, lang);
  }
}

// ─── 2. Transactions ────────────────────────────────────────

export async function cmdTransactions(address: string, limit: number = 5): Promise<CommandResult> {
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  try {
    const network = detectNetwork(address);
    const data = await getTransactions(address, network, 1, limit);
    const explorerUrl = `${getExplorerBaseUrl(network)}/address/${address}`;

    let text =
      `📄 *Recent Transactions*\n\n` +
      `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
      `Address: \`${data.address}\`\n` +
      `Showing: ${data.transactions.length} of ${data.totalCount}\n\n`;

    if (data.transactions.length > 0) {
      data.transactions.slice(0, 10).forEach((tx, i) => {
        const value = Number(tx.value) / 1e18;
        const status = tx.status === 'success' ? '✅' : tx.status === 'failed' ? '❌' : '⏳';
        text += `${i + 1}. ${status} \`${tx.hash.slice(0, 16)}...\` — ${value.toFixed(4)} XDC\n`;
      });
      if (data.transactions.length > 10) {
        text += `\n...and ${data.transactions.length - 10} more\n`;
      }
      text += `\n[View on Explorer](${explorerUrl})`;
    } else {
      text += 'No transactions found.';
    }

    return { success: true, text, rawData: data };
  } catch (err) {
    return formatError('cmdTransactions', err);
  }
}

// ─── 3. Track Wallet ────────────────────────────────────────

export async function cmdTrack(address: string, userId: string, platform?: string): Promise<CommandResult> {
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  // ── Check tier limits ────────────────────────────────────
  if (platform) {
    const { canAddPortfolioWallet, incrementUsage } = await import('./billing/subscriptionService');
    const wallets = walletService.listWallets(userId);
    const canAdd = await canAddPortfolioWallet(userId, platform as any, wallets.length);
    if (!canAdd) {
      return {
        success: false,
        text:
          '❌ *Wallet Limit Reached*\n\n' +
          'You have reached the maximum number of tracked wallets for your plan.\n\n' +
          '💎 Upgrade to Pro for more wallets:\n' +
          '• /upgrade',
      };
    }
    await incrementUsage(userId, platform as any, 'portfolioWallets');
  }

  const network = detectNetwork(address);
  const result = walletService.trackWallet(address, userId);

  if (result.alreadyTracked) {
    return {
      success: true,
      text: `⚠️ This wallet is already tracked on ${network}.`,
    };
  }

  // Also save to MongoDB portfolio collection so /portfolio can find it
  if (platform) {
    try {
      const { addPortfolioWallet } = await import('./portfolioService');
      await addPortfolioWallet(userId, platform as any, address, network);
    } catch (err) {
      logger.error('[cmdTrack] Failed to add to portfolio DB', { error: err });
      // Don't fail the whole command if portfolio DB save fails
    }
  }

  return {
    success: true,
    text:
      `✅ *Wallet Tracked*\n\n` +
      `Address: \`${address}\`\n` +
      `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n\n` +
      `You will receive notifications for new transactions.`,
  };
}

// ─── 4. Untrack Wallet ──────────────────────────────────────

export function cmdUntrack(address: string, userId: string, platform?: string): CommandResult {
  const result = walletService.untrackWallet(address, userId);

  if (!result.success) {
    return {
      success: false,
      text: '❌ Wallet not found in your tracked list.',
    };
  }

  // Also remove from MongoDB portfolio collection
  if (platform) {
    import('./portfolioService').then(({ removePortfolioWallet }) => {
      removePortfolioWallet(userId, platform as any, address).catch((err: any) => {
        logger.error('[cmdUntrack] Failed to remove from portfolio DB', { error: err });
      });
    });
  }

  return {
    success: true,
    text:
      `🔕 *Wallet Untracked*\n\n` +
      `Address: \`${address}\`\n\n` +
      `You will no longer receive notifications.`,
  };
}

// ─── 5. List Tracked Wallets ────────────────────────────────

export function cmdList(userId: string): CommandResult {
  const wallets = walletService.listWallets(userId);

  if (wallets.length === 0) {
    return {
      success: true,
      text:
        '📋 *Tracked Wallets*\n\n' +
        'You are not tracking any wallets yet.\n\n' +
        'Use `/track <address>` to start tracking.',
    };
  }

  let text = '📋 *Tracked Wallets*\n\n';
  wallets.forEach((w, i) => {
    text += `${i + 1}. \`${w.address}\` ${w.network === 'testnet' ? '(🧪 Testnet)' : '(🌐 Mainnet)'}\n`;
  });

  return { success: true, text };
}

// ─── 6. Gas Price ───────────────────────────────────────────

export async function cmdGasPrice(network: Network = 'mainnet', lang: string = 'en'): Promise<CommandResult> {
  const t = getTranslationByLang(lang);
  try {
    const data = await getGasPrice(network);
    return {
      success: true,
      text:
        `⛽ *${t.cmd_gas_title}*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Safe: **${data.safeGasPrice} Gwei**\n` +
        `Standard: **${data.proposeGasPrice} Gwei**\n` +
        `Fast: **${data.fastGasPrice} Gwei**`,
      rawData: data,
    };
  } catch (err) {
    return formatError('cmdGasPrice', err, lang);
  }
}

// ─── 7. Block Info ──────────────────────────────────────────

export async function cmdBlockInfo(blockNumber: string | number, network: Network = 'mainnet'): Promise<CommandResult> {
  try {
    const data = await getBlockByNumber(blockNumber, network);
    return {
      success: true,
      text:
        `📦 *Block Info*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Block: **${data.blockNumber}**\n` +
        `Hash: \`${data.hash}\`\n` +
        `Miner: \`${data.miner}\`\n` +
        `Transactions: **${data.transactions}**\n` +
        `Gas Used: ${data.gasUsed}\n` +
        `Timestamp: ${data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}\n\n` +
        `[View on Explorer](${data.explorerUrl})`,
      rawData: data,
    };
  } catch (err) {
    return formatError('cmdBlockInfo', err);
  }
}

// ─── 8. Failed Transactions ─────────────────────────────────

export async function cmdFailedTransactions(address: string, limit: number = 5): Promise<CommandResult> {
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  try {
    const network = detectNetwork(address);
    const data = await getFailedTransactions(address, network, limit);
    const explorerUrl = `${getExplorerBaseUrl(network)}/address/${address}`;
    const count = data.transactions.length;

    let text =
      `❌ *Failed Transactions*\n\n` +
      `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
      `Address: \`${data.address}\`\n` +
      `Total Failed: **${data.totalCount}**\n\n`;

    if (count > 0) {
      data.transactions.forEach((tx, i) => {
        text += `${i + 1}. \`${tx.hash.slice(0, 20)}...\` — ${Number(tx.value) / 1e18} XDC\n`;
      });
      text += `\n[View on Explorer](${explorerUrl})`;
    } else {
      text += `No failed transactions found in recent history. 🎉`;
    }

    return { success: true, text, rawData: data };
  } catch (err) {
    return formatError('cmdFailedTransactions', err);
  }
}

// ─── 9. Wallet Activity ─────────────────────────────────────

export async function cmdWalletActivity(address: string): Promise<CommandResult> {
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  try {
    const network = detectNetwork(address);
    const data = await getWalletActivity(address, network);
    const explorerUrl = `${getExplorerBaseUrl(network)}/address/${address}`;

    return {
      success: true,
      text:
        `📊 *Wallet Activity*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Address: \`${data.address}\`\n` +
        `Total Transactions: **${data.totalTransactions}**\n` +
        `First Seen: ${data.firstSeen ? new Date(data.firstSeen).toLocaleDateString() : 'N/A'}\n` +
        `Last Seen: ${data.lastSeen ? new Date(data.lastSeen).toLocaleDateString() : 'N/A'}\n` +
        `Contracts Interacted: **${data.uniqueContractsInteracted}**\n\n` +
        `[View on Explorer](${explorerUrl})\n\n` +
        `_💡 Tip: Use /reputation ${address} to see reputation score_`,
      rawData: data,
    };
  } catch (err) {
    return formatError('cmdWalletActivity', err);
  }
}

// ─── 10. Large Transfers ────────────────────────────────────

export async function cmdLargeTransfers(address: string, thresholdXDC: number = 1000): Promise<CommandResult> {
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  try {
    const network = detectNetwork(address);
    const data = await getLargeTransfers(address, network, thresholdXDC);
    const explorerUrl = `${getExplorerBaseUrl(network)}/address/${address}`;
    const count = data.transfers.length;

    let text =
      `🐋 *Large Transfers*\n\n` +
      `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
      `Address: \`${data.address}\`\n` +
      `Threshold: **${data.threshold} XDC**\n` +
      `Found: **${count}** transfer${count !== 1 ? 's' : ''}\n\n`;

    if (count > 0) {
      data.transfers.slice(0, 5).forEach((tx, i) => {
        text += `${i + 1}. \`${tx.hash.slice(0, 20)}...\` → **${tx.valueXDC} XDC**\n`;
      });
      if (count > 5) text += `\n...and ${count - 5} more`;
      text += `\n\n[View on Explorer](${explorerUrl})`;
    } else {
      text += `No large transfers found above the threshold.`;
    }

    return { success: true, text, rawData: data };
  } catch (err) {
    return formatError('cmdLargeTransfers', err);
  }
}

// ─── 11. Price (Stub) ───────────────────────────────────────

export function cmdPrice(lang: string = 'en'): CommandResult {
  const t = getTranslationByLang(lang);
  return {
    success: true,
    text:
      `📈 *${t.cmd_price_title}*\n\n` +
      'Current price data is not yet available.\n\n' +
      'Try these instead:\n' +
      '• `/balance <address>`\n' +
      '• `/tx <address>`',
  };
}

// ─── 12. Status ─────────────────────────────────────────────

export async function cmdStatus(lang: string = 'en'): Promise<CommandResult> {
  const t = getTranslationByLang(lang);
  try {
    // Default to mainnet, but could accept network param in future
    const [gasData, stats] = await Promise.all([
      getGasPrice('mainnet'),
      getNetworkStats('mainnet'),
    ]);
    
    let text =
      `🌐 *${t.cmd_status_title}*\n\n` +
      `📊 *Network Stats*\n` +
      `Latest Block: **${stats.latestBlock}**\n` +
      `Total Blocks: **${stats.totalBlocks}**\n` +
      `Block TXs: **${stats.totalTransactions}**\n` +
      `XDC Price: **$${stats.xdcPrice}**\n\n`;
    
    if (stats.latestTransactions.length > 0) {
      text += `📄 *Latest Transactions*\n`;
      stats.latestTransactions.forEach((tx, i) => {
        text += `${i + 1}. \`${tx.hash.slice(0, 16)}...\` — ${tx.value} XDC\n`;
      });
      text += `\n`;
    }
    
    text +=
      `⛽ *${t.cmd_gas_title}*\n` +
      `Safe: **${gasData.safeGasPrice} Gwei**\n` +
      `Standard: **${gasData.proposeGasPrice} Gwei**\n` +
      `Fast: **${gasData.fastGasPrice} Gwei**\n\n` +
      `All systems operational ✅\n\n` +
      `💡 *Ready to explore?* Send your wallet address to connect.`;

    return { success: true, text };
  } catch (err) {
    return formatError('cmdStatus', err, lang);
  }
}

// ─── 14. List Alerts ────────────────────────────────────────

export async function cmdListAlerts(userId: string): Promise<CommandResult> {
  try {
    const { listAlerts } = await import('./alert');
    const alerts = await listAlerts(userId);

    if (alerts.length === 0) {
      return {
        success: true,
        text:
          '📋 *Your Alerts*\n\n' +
          'You have no active alerts.\n\n' +
          'Create one with:\n' +
          '• \`/alert gas > 50\`\n' +
          '• \`/alert price < 0.02\`\n' +
          '• \`Alert me when XDC drops below \$0.02\`',
      };
    }

    let text = `📋 *Your Alerts (${alerts.length})*\n\n`;
    alerts.forEach((alert, i) => {
      const status = alert.status === 'active' ? '✅' : alert.status === 'paused' ? '⏸️' : '🔔';
      text += `${i + 1}. ${status} **${alert.name}** (${alert.type})\n`;
      if (alert.condition.operator && alert.condition.value) {
        text += `   ${alert.condition.operator} ${alert.condition.value} ${alert.condition.currency || alert.condition.unit || ''}\n`;
      }
      text += `   ID: \`${alert._id}\`\n`;
      text += `   Triggers: ${alert.triggerCount}${alert.maxTriggers ? `/${alert.maxTriggers}` : ''}\n\n`;
    });

    text += 'To delete: \`/deletealert <id>\`';

    return { success: true, text };
  } catch (err) {
    return formatError('cmdListAlerts', err);
  }
}

// ─── 15. Create Alert ───────────────────────────────────────

export async function cmdCreateAlert(
  userId: string,
  platform: string,
  chatId: string,
  args: string[]
): Promise<CommandResult> {
  try {
    // ── Validate args ──────────────────────────────────────────
    if (!args || args.length === 0) {
      return {
        success: false,
        text:
          '🔔 *Create Alert*\n\n' +
          'Usage examples:\n' +
          '• \`/alert gas > 50\` — Gas price alert\n' +
          '• \`/alert price < 0.02\` — Price alert\n' +
          '• \`/alert failed xdc...\` — Failed tx alert\n' +
          '• \`/alert incoming xdc...\` — Incoming tx alert',
      };
    }

    const type = args[0]?.toLowerCase();
    const operator = args[1];
    const rawValue = args[2];
    const value = parseFloat(rawValue);
    const address = rawValue;

    // ── Validate alert type ────────────────────────────────────
    const validTypes = ['gas', 'price', 'failed', 'incoming'];
    if (!validTypes.includes(type)) {
      return {
        success: false,
        text:
          '❌ Unknown alert type: `' + type + '`\n\n' +
          'Valid types: gas, price, failed, incoming\n\n' +
          'Examples:\n' +
          '• \`/alert gas > 50\`\n' +
          '• \`/alert price < 0.02\`',
      };
    }

    // ── Validate numeric alerts have required args ─────────────
    if ((type === 'gas' || type === 'price') && (!operator || isNaN(value))) {
      return {
        success: false,
        text:
          '❌ Invalid alert format.\n\n' +
          'Usage: \`/alert ' + type + ' <operator> <value>\`\n' +
          'Example: \`/alert ' + type + ' > 50\`',
      };
    }

    // ── Validate address-based alerts have address ─────────────
    if ((type === 'failed' || type === 'incoming') && !address) {
      return {
        success: false,
        text:
          '❌ Address required.\n\n' +
          'Usage: \`/alert ' + type + ' <address>\`\n' +
          'Example: \`/alert ' + type + ' xdc84E1...\`',
      };
    }

    // ── Validate address format for address-based alerts ───────
    if ((type === 'failed' || type === 'incoming') && !isValidXdcAddress(address)) {
      return {
        success: false,
        text: '❌ Invalid XDC address: `' + address + '`\n\nPlease provide a valid address.',
      };
    }

    // ── Check tier limits ──────────────────────────────────────
    const { canCreateAlert } = await import('./billing/subscriptionService');
    const canCreate = await canCreateAlert(userId, platform as any);
    if (!canCreate) {
      return {
        success: false,
        text:
          '❌ *Alert Limit Reached*\n\n' +
          'You have reached the maximum number of alerts for your plan.\n\n' +
          '💎 Upgrade to Pro for unlimited alerts:\n' +
          '• /upgrade',
      };
    }

    const { createAlert } = await import('./alert');

    let alertType: string;
    let condition: any = {};
    let name: string;

    switch (type) {
      case 'gas':
        alertType = 'gas_spike';
        condition = { operator, value, unit: 'Gwei', network: 'mainnet' };
        name = `Gas ${operator} ${value} Gwei`;
        break;
      case 'price':
        alertType = 'price_threshold';
        condition = { operator, value, currency: 'USD', network: 'mainnet' };
        name = `Price ${operator} $${value}`;
        break;
      case 'failed':
        alertType = 'tx_failed';
        condition = { address, network: detectNetwork(address) };
        name = `Failed TX for ${address.slice(0, 10)}...`;
        break;
      case 'incoming':
        alertType = 'tx_incoming';
        condition = { address, network: detectNetwork(address) };
        name = `Incoming TX for ${address.slice(0, 10)}...`;
        break;
      default:
        return {
          success: false,
          text:
            '❌ Unknown alert type.\n\n' +
            'Usage: \`/alert gas > 50\`\n' +
            'Or: \`Alert me when XDC drops below \$0.02\`',
        };
    }

    const alert = await createAlert({
      userId,
      platform: platform as any,
      chatId,
      type: alertType as any,
      name,
      condition,
      cooldownMinutes: 60,
    });

    // Track usage (best effort — don't fail if this errors)
    try {
      const { incrementUsage } = await import('./billing/subscriptionService');
      await incrementUsage(userId, platform as any, 'alertsCreated');
    } catch (usageErr) {
      logger.warn('[cmdCreateAlert] Failed to track usage', { error: usageErr });
    }

    return {
      success: true,
      text:
        `🔔 *Alert Created*\n\n` +
        `Name: **${alert.name}**\n` +
        `Type: ${alert.type}\n` +
        `Status: ✅ Active\n\n` +
        `You'll be notified when the condition is met.`,
    };
  } catch (err: any) {
    // Return specific error message for validation errors
    if (err?.name === 'ValidationError' && err?.message) {
      logger.error('[blockchainCommands] cmdCreateAlert validation failed', { error: err.message });
      return {
        success: false,
        text: '❌ *Alert Creation Failed*\n\n' + err.message,
      };
    }
    return formatError('cmdCreateAlert', err);
  }
}

export async function cmdPauseAllAlerts(userId: string): Promise<CommandResult> {
  try {
    const { pauseAllAlerts } = await import('./alert');
    const count = await pauseAllAlerts(userId);

    if (count === 0) {
      return {
        success: true,
        text: 'ℹ️ You have no active alerts to stop.',
      };
    }

    return {
      success: true,
      text:
        `🔕 *Alerts Paused*

` +
        `Stopped ${count} active alert${count === 1 ? '' : 's'}.
` +
        `Use /alerts to review your paused alerts or /deletealert <id> to remove them permanently.`,
    };
  } catch (err) {
    return formatError('cmdPauseAllAlerts', err);
  }
}

// ─── 16. Delete Alert ───────────────────────────────────────

export async function cmdDeleteAlert(alertId: string, userId: string): Promise<CommandResult> {
  try {
    const { deleteAlert } = await import('./alert');
    const success = await deleteAlert(alertId, userId);

    if (success) {
      return {
        success: true,
        text: `🗑️ *Alert Deleted*\n\nThe alert has been removed.`,
      };
    }
    return {
      success: false,
      text: '⚠️ Alert not found or already deleted.',
    };
  } catch (err) {
    return formatError('cmdDeleteAlert', err);
  }
}

export async function cmdSetLanguage(userId: string, lang: string): Promise<CommandResult> {
  const validLangs = ['en', 'hi', 'mr'];
  if (!validLangs.includes(lang)) {
    return {
      success: false,
      text: '❌ Invalid language. Use: en, hi, or mr',
    };
  }

  try {
    const { UserModel } = await import('../models/User');
    await UserModel.updateOne(
      { telegramId: parseInt(userId) },
      { preferredLanguage: lang as 'en' | 'hi' | 'mr' }
    );

    const messages: Record<string, Record<string, string>> = {
      en: { en: '✅ Language set to English', hi: '✅ भाषा अंग्रेजी में सेट की गई', mr: '✅ भाषा इंग्रजीमध्ये सेट केली' },
      hi: { en: '✅ Language set to Hindi', hi: '✅ भाषा हिंदी में सेट की गई', mr: '✅ भाषा हिंदीमध्ये सेट केली' },
      mr: { en: '✅ Language set to Marathi', hi: '✅ भाषा मराठी में सेट की गई', mr: '✅ भाषा मराठीत सेट केली' },
    };

    return {
      success: true,
      text: messages[lang][lang],
    };
  } catch (err) {
    logger.error('cmdSetLanguage failed', { error: err });
    return {
      success: false,
      text: '❌ Failed to set language. Please try again.',
    };
  }
}

export async function cmdPremium(userId: string): Promise<CommandResult> {
  try {
    const { generateUPIPayment } = await import('./payments/upiService');
    const payment = await generateUPIPayment(99, 'smartai@upi', userId);

    return {
      success: true,
      text:
        `💎 *Premium Plan*\n\n` +
        `Upgrade to unlock:\n` +
        `• Unlimited alerts\n` +
        `• Advanced analytics\n` +
        `• Priority support\n` +
        `• Custom notifications\n\n` +
        `Price: **₹99/month**\n\n` +
        `Click to pay via UPI:\n` +
        `[Pay ₹99](${payment.upiLink})\n\n` +
        `Transaction ID: \`${payment.transactionId}\``,
    };
  } catch (err) {
    logger.error('cmdPremium failed', { error: err });
    return {
      success: false,
      text: '❌ Failed to generate payment. Please try again.',
    };
  }
}

export function cmdHelp(): CommandResult {
  return {
    success: true,
    text:
      `🤖 *Smart AI Explorer* — Text the blockchain!\n\n` +

      `*Alert Commands:*\n` +
      `• \`/alerts\` — Show your active alerts\n` +
      `• \`/alert\` — Create a new alert\n` +
      `• \`/deletealert <id>\` — Delete an alert\n\n` +

      `*Wallet Commands:*\n` +
      `• \`/balance xdc...\` — Check XDC balance\n` +
      `• \`/balance txdc...\` — Check testnet balance\n` +
      `• \`/tx xdc...\` — Show last 5 transactions\n` +
      `• \`/activity xdc...\` — Wallet activity stats\n` +
      `• \`/failed xdc...\` — Failed transactions\n` +
      `• \`/large xdc...\` — Large transfers (>1000 XDC)\n\n` +

      `*Tracking Commands:*\n` +
      `• \`/track xdc...\` — Track wallet for alerts\n` +
      `• \`/untrack xdc...\` — Stop tracking\n` +
      `• \`/list\` — Show tracked wallets\n\n` +

      `*Network Commands:*\n` +
      `• \`/gas\` — Current gas prices (XDC)\n` +
      `• \`/gas eth\` — Gas price on any chain\n` +
      `• \`/block 12345\` — Block info\n` +
      `• \`/status\` — Network status\n` +
      `• \`/price\` — XDC price (coming soon)\n\n` +

      `*Multi-Chain Commands:*\n` +
      `• \`/chains\` — List supported chains\n` +
      `• \`/balance eth 0x...\` — Balance on any chain\n` +
      `• \`/tx base 0x...\` — Transactions on any chain\n` +
      `• \`/gas polygon\` — Gas price on any chain\n\n` +

      `*Billing Commands:*\n` +
      `• \`/subscription\` — Your current plan\n` +
      `• \`/upgrade\` — Upgrade to Pro/Enterprise\n` +
      `• \`/billing\` — Manage subscription\n\n` +

      `*Reputation Commands:*\n` +
      `• \`/reputation xdc...\` — Check wallet reputation\n` +
      `• \`/reputation\` — Your reputation (connected wallet)\n` +
      `• \`/leaderboard\` — Top wallets by reputation\n\n` +

      `*Language Commands:*\n` +
      `• \`/language en\` — English\n` +
      `• \`/language hi\` — Hindi\n` +
      `• \`/language mr\` — Marathi\n\n` +

      `*Keyword Shortcuts (no slash):*\n` +
      `• \`b xdc...\` — Same as /balance\n` +
      `• \`t xdc...\` — Same as /tx\n` +
      `• \`gas\` — Same as /gas\n` +
      `• \`status\` — Same as /status\n` +
      `• \`help\` — Show this message\n\n` +

      `*Natural Language (beta):*\n` +
      `• "Balance of xdc..."\n` +
      `• "Show transactions for xdc..."\n` +
      `• "Gas price"\n` +
      `• "Block 12345"\n` +
      `• "Alert me when XDC drops below \$0.02"\n\n` +

      `*Examples:*\n` +
      `\`/balance xdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020\`\n` +
      `\`/tx txdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020\``,
  };
}

// ─── Reputation Commands ────────────────────────────────────

export async function cmdReputation(address: string): Promise<CommandResult> {
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  try {
    const network = detectNetwork(address);
    const rep = await getReputation(address, network);

    if (!rep) {
      return {
        success: false,
        text: '❌ Could not calculate reputation. Please try again later.',
      };
    }

    const emoji = getTierEmoji(rep.tier);
    const badges = rep.badges.length > 0
      ? rep.badges.map((b) => `• ${b.replace(/_/g, ' ').toUpperCase()}`).join('\n')
      : 'None yet';

    return {
      success: true,
      text:
        `${emoji} *Wallet Reputation*\n\n` +
        `*Address:* \`${address}\`\n` +
        `*Score:* ${rep.overallScore}/100\n` +
        `*Tier:* ${rep.tier}\n\n` +
        `*Metrics:*\n` +
        `• Account Age: ${rep.metrics.accountAgeDays} days\n` +
        `• Transactions: ${rep.metrics.transactionCount}\n` +
        `• Total Volume: ${rep.metrics.totalVolumeXDC} XDC\n` +
        `• Avg Tx Value: ${rep.metrics.avgTxValueXDC} XDC\n` +
        `• Success Rate: ${((1 - rep.metrics.failedTxRatio) * 100).toFixed(1)}%\n` +
        `• Contracts: ${rep.metrics.contractInteractions}\n` +
        `• Whale Score: ${rep.metrics.whaleScore}/100\n\n` +
        `*Badges:*\n${badges}\n\n` +
        `_Last updated: ${rep.lastUpdated.toLocaleDateString()}_`,
      rawData: rep,
    };
  } catch (err) {
    return formatError('cmdReputation', err);
  }
}

export async function cmdLeaderboard(): Promise<CommandResult> {
  try {
    const leaders = await getLeaderboard('mainnet', 10);

    if (leaders.length === 0) {
      return {
        success: true,
        text: '🏆 *Reputation Leaderboard*\n\nNo wallets ranked yet. Be the first!',
      };
    }

    const list = leaders
      .map((w, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const emoji = getTierEmoji(w.tier);
        return `${medal} \`${w.address.slice(0, 12)}...\` — ${emoji} ${w.overallScore} pts`;
      })
      .join('\n');

    return {
      success: true,
      text:
        `🏆 *Reputation Leaderboard*\n\n` +
        `${list}\n\n` +
        `_Total ranked wallets: ${leaders[0]?.totalRanked || 0}_`,
      rawData: leaders,
    };
  } catch (err) {
    return formatError('cmdLeaderboard', err);
  }
}
