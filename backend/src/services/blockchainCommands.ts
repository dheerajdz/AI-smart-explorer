// ============================================================
// blockchainCommands.ts
// Shared command logic for Telegram and WhatsApp bots.
// Each function is platform-agnostic — returns raw data + text.
// Platform-specific formatting happens in the bot layer.
//
// DESIGN PRINCIPLES:
//   1. Surface specific, actionable error messages.
//   2. Never swallow errors with generic "Failed to fetch".
//   3. Pass through XDCScanError details to the user.
//   4. Wallet tracking uses MongoDB persistence.
// ============================================================

import { logger } from '../utils/logger';
import {
  getWalletBalance,
  getTransactions,
  getWalletActivity,
  getLargeTransfers,
  getGasPrice,
  getBlockByNumber,
  getFailedTransactions,
  XDCScanError,
} from './blockchain';
import * as walletService from './walletService';
import * as alertService from './alertService';
import { AlertType, AlertPlatform } from '../models/Alert';
import { Network, detectNetwork, isValidXdcAddress, getExplorerBaseUrl } from '../utils/network';
// ─── Types ──────────────────────────────────────────────────

export interface CommandResult {
  success: boolean;
  text: string;
  rawData?: any;
}

// ─── Helper ─────────────────────────────────────────────────

function formatError(context: string, error: unknown): CommandResult {
  let message: string;

  if (error instanceof XDCScanError) {
    // Pass through specific XDCScan errors with their meaningful messages
    message = error.message;
  } else if (error instanceof Error) {
    message = `❌ ${context} failed: ${error.message}`;
  } else {
    message = `❌ ${context} failed. Please try again later.`;
  }

  logger.error(`[blockchainCommands] ${context} failed`, {
    error: error instanceof Error ? error.message : String(error),
  });

  return { success: false, text: message };
}

// ─── 1. Balance ─────────────────────────────────────────────

export async function cmdBalance(address: string): Promise<CommandResult> {
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  try {
    const network = detectNetwork(address);
    const data = await getWalletBalance(address, network);

    return {
      success: true,
      text:
        `💰 *Wallet Balance*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Address: \`${data.address}\`\n` +
        `Balance: **${data.balanceXDC} XDC**\n\n` +
        `[View on Explorer](${data.explorerUrl})`,
      rawData: data,
    };
  } catch (err) {
    return formatError('cmdBalance', err);
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
      data.transactions.forEach((tx, i) => {
        const value = Number(tx.value) / 1e18;
        const status = tx.status === 'success' ? '✅' : tx.status === 'failed' ? '❌' : '⏳';
        text += `${i + 1}. ${status} \`${tx.hash.slice(0, 20)}...\` — ${value} XDC\n`;
      });
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

export async function cmdTrack(
  address: string,
  userId: string,
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x' = 'telegram'
): Promise<CommandResult> {
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  const network = detectNetwork(address);
  const result = await walletService.trackWallet(address, userId, platform);

  if (result.alreadyTracked) {
    return {
      success: true,
      text: `⚠️ This wallet is already tracked on ${network}.`,
    };
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

export async function cmdUntrack(address: string, userId: string): Promise<CommandResult> {
  const result = await walletService.untrackWallet(address, userId);

  if (!result.success) {
    return {
      success: false,
      text: '❌ Wallet not found in your tracked list.',
    };
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

export async function cmdList(userId: string): Promise<CommandResult> {
  const wallets = await walletService.listWallets(userId);

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

export async function cmdGasPrice(network: Network = 'mainnet'): Promise<CommandResult> {
  try {
    const data = await getGasPrice(network);
    return {
      success: true,
      text:
        `⛽ *Gas Price*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Safe: **${data.safeGasPrice} Gwei**\n` +
        `Standard: **${data.proposeGasPrice} Gwei**\n` +
        `Fast: **${data.fastGasPrice} Gwei**`,
      rawData: data,
    };
  } catch (err) {
    return formatError('cmdGasPrice', err);
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
        `[View on Explorer](${explorerUrl})`,
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

export function cmdPrice(): CommandResult {
  return {
    success: true,
    text:
      '📈 *XDC Price*\n\n' +
      'Current price data is not yet available.\n\n' +
      'Try these instead:\n' +
      '• `/balance <address>`\n' +
      '• `/tx <address>`',
  };
}

// ─── 12. Status ─────────────────────────────────────────────

export async function cmdStatus(): Promise<CommandResult> {
  try {
    const data = await getGasPrice('mainnet');
    return {
      success: true,
      text:
        `🌐 *Network Status*\n\n` +
        `Network: XDC Mainnet\n` +
        `Gas Safe: **${data.safeGasPrice} Gwei**\n` +
        `Gas Standard: **${data.proposeGasPrice} Gwei**\n` +
        `Gas Fast: **${data.fastGasPrice} Gwei**\n\n` +
        `All systems operational ✅`,
    };
  } catch (err) {
    return formatError('cmdStatus', err);
  }
}

// ─── 13. Help ───────────────────────────────────────────────

export function cmdHelp(): CommandResult {
  return {
    success: true,
    text:
      `🤖 *Smart AI Explorer* — Text the blockchain!\n\n` +

      `*Wallet Commands:*\n` +
      `• \`/balance xdc...\` — Check XDC balance\n` +
      `• \`/balance txdc...\` — Check testnet balance\n` +
      `• \`/tx xdc...\` — Show last 5 transactions\n` +
      `• \`/activity xdc...\` — Wallet activity stats\n` +
      `• \`/failed xdc...\` — Failed transactions\n` +
      `• \`/large xdc...\` — Large transfers (>1000 XDC)\n\n` +

      `*Tracking & Alerts:*\n` +
      `• \`/track xdc...\` — Track wallet\n` +
      `• \`/untrack xdc...\` — Stop tracking\n` +
      `• \`/list\` — Show tracked wallets\n` +
      `• \`/alert create new_tx xdc...\` — Alert on new txs\n` +
      `• \`/alert create failed_tx xdc...\` — Alert on failed txs\n` +
      `• \`/alert create contract_deploy xdc...\` — Alert on deploys\n` +
      `• \`/alert list\` — Show your alerts\n` +
      `• \`/alert delete <id>\` — Remove alert\n\n` +

      `*Network Commands:*\n` +
      `• \`/gas\` — Current gas prices\n` +
      `• \`/block 12345\` — Block info\n` +
      `• \`/status\` — Network status\n` +
      `• \`/deploys xdc...\` — Contract deployments\n` +
      `• \`/price\` — XDC price (coming soon)\n\n` +

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
      `• "Block 12345"\n\n` +

      `*Examples:*\n` +
      `\`/balance xdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020\`\n` +
      `\`/tx txdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020\``,
  };
}

// ─── 14. Alert Create ───────────────────────────────────────

export async function cmdAlertCreate(
  userId: string,
  platform: AlertPlatform,
  type: AlertType,
  address?: string
): Promise<CommandResult> {
  if (address && !isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  try {
    const alert = await alertService.createAlert({
      userId,
      platform,
      type,
      address,
    });

    const typeLabels: Record<AlertType, string> = {
      new_tx: '🔔 New Transaction',
      failed_tx: '❌ Failed Transaction',
      contract_deploy: '📜 Contract Deployment',
      balance_change: '💰 Balance Change',
      price_threshold: '📈 Price Threshold',
    };

    return {
      success: true,
      text:
        `✅ *Alert Created*\n\n` +
        `Type: ${typeLabels[type] || type}\n` +
        `Address: ${address ? `\`${address}\`` : 'N/A'}\n` +
        `Platform: ${platform}\n` +
        `Cooldown: ${alert.cooldownMinutes} minutes\n\n` +
        `You will be notified when this condition is met.`,
      rawData: alert,
    };
  } catch (err) {
    return formatError('cmdAlertCreate', err);
  }
}

// ─── 15. Alert List ─────────────────────────────────────────

export async function cmdAlertList(userId: string, platform: AlertPlatform): Promise<CommandResult> {
  try {
    const alerts = await alertService.listAlerts(userId, platform);

    if (alerts.length === 0) {
      return {
        success: true,
        text:
          `📋 *Your Alerts*\n\n` +
          `You have no alerts set up.\n\n` +
          `Create one with:\n` +
          `• \`/alert new_tx xdc...\`\n` +
          `• \`/alert failed_tx xdc...\`\n` +
          `• \`/alert contract_deploy xdc...\``,
      };
    }

    const typeLabels: Record<AlertType, string> = {
      new_tx: '🔔 New Tx',
      failed_tx: '❌ Failed Tx',
      contract_deploy: '📜 Deploy',
      balance_change: '💰 Balance',
      price_threshold: '📈 Price',
    };

    let text = `📋 *Your Alerts (${alerts.length})*\n\n`;
    alerts.forEach((alert, i) => {
      const status = alert.isActive ? '✅' : '⏸️';
      const label = typeLabels[alert.type] || alert.type;
      const addr = alert.address ? `\`${alert.address.slice(0, 20)}...\`` : 'N/A';
      text += `${i + 1}. ${status} ${label} — ${addr} (${alert.network || 'any'})\n`;
    });

    text += `\nDelete with: \`/alert delete <number>\``;

    return { success: true, text, rawData: alerts };
  } catch (err) {
    return formatError('cmdAlertList', err);
  }
}

// ─── 16. Alert Delete ───────────────────────────────────────

export async function cmdAlertDelete(
  alertId: string,
  userId: string
): Promise<CommandResult> {
  try {
    const success = await alertService.deleteAlert(alertId, userId);

    if (!success) {
      return {
        success: false,
        text: '❌ Alert not found or you do not have permission to delete it.',
      };
    }

    return {
      success: true,
      text: `🗑️ *Alert Deleted*\n\nThe alert has been removed.`,
    };
  } catch (err) {
    return formatError('cmdAlertDelete', err);
  }
}

// ─── 17. Contract Deployments ─────────────────────────────────

export async function cmdContractDeployments(address: string, limit: number = 5): Promise<CommandResult> {
  if (!isValidXdcAddress(address)) {
    return {
      success: false,
      text: '❌ Invalid address. Must start with `xdc`, `txdc`, or `0x` (42 chars).',
    };
  }

  try {
    const network = detectNetwork(address);
    const data = await getTransactions(address, network, 1, limit * 3); // fetch more to filter
    const allTxs = data.transactions || [];

    // Filter for contract deployments
    const deploys = allTxs.filter((tx: any) => {
      if (!tx.to || tx.to === '0x' || tx.to === '0x0000000000000000000000000000000000000000') return true;
      if (tx.contractAddress && tx.contractAddress !== '0x') return true;
      return false;
    });

    const explorerUrl = `${getExplorerBaseUrl(network)}/address/${address}`;

    let text =
      `📜 *Contract Deployments*\n\n` +
      `Deployer: \`${address}\`\n` +
      `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
      `Found: **${deploys.length}** deployment${deploys.length !== 1 ? 's' : ''}\n\n`;

    if (deploys.length > 0) {
      deploys.slice(0, limit).forEach((tx: any, i: number) => {
        const contract = tx.contractAddress || 'Pending verification';
        text += `${i + 1}. \`${tx.hash.slice(0, 20)}...\` → Contract: \`${contract.slice(0, 20)}...\`\n`;
      });
      text += `\n[View on Explorer](${explorerUrl})`;
    } else {
      text += `No contract deployments found for this address.`;
    }

    return { success: true, text, rawData: deploys };
  } catch (err) {
    return formatError('cmdContractDeployments', err);
  }
}
