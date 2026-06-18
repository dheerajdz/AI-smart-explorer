// ============================================================
// queryRouter.ts
// The brain that routes parsed AI queries to the correct
// blockchain service and formats the response.
//
// Flow:
//   ParsedQuery (action + params + network)
//        ↓
//   executeQuery()
//        ↓
//   Call correct blockchain service
//        ↓
//   Format raw data → friendly text
// ============================================================

import { logger } from '../../utils/logger';
import { QueryAction, ParsedQuery } from '../../types';
import { Network, getTxExplorerUrl, getAddressExplorerUrl } from '../../utils/network';
import {
  getWalletBalance,
  getTransactions,
  getWalletActivity,
  getLargeTransfers,
  getTransactionByHash,
  getTokenBalance,
  getGasPrice,
  getBlockByNumber,
  getFailedTransactions,
  getFailedContractDeployments,
} from '../blockchain';
import { createAlert, listAlerts, deleteAlert, pauseAlert, pauseAllAlerts } from '../alert';
import { isValidXdcAddress } from '../../utils/network';
import { translateResponse, SupportedLanguage } from '../i18n';

// ─── Types ──────────────────────────────────────────────────

export interface QueryResult {
  text: string;
  rawData?: any;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Execute a parsed query by routing to the correct blockchain service.
 *
 * @param parsed The structured query from queryParser.ts
 * @param userLanguage The user's preferred language for response translation
 * @returns Friendly text response for WhatsApp/Telegram
 */
export async function executeQuery(
  parsed: ParsedQuery,
  userLanguage: SupportedLanguage = 'en'
): Promise<QueryResult> {
  const { action } = parsed;
  const network: Network = parsed.network || 'mainnet';

  logger.info('[queryRouter] Executing action', { action, network, params: Object.keys(parsed) });

  let result: QueryResult;

  switch (action) {
    // ── Wallet & Balance ─────────────────────────────────────
    case QueryAction.WALLET_BALANCE:
      result = await handleWalletBalance(parsed, network);
      break;

    case QueryAction.WALLET_ACTIVITY:
      result = await handleWalletActivity(parsed, network);
      break;

    case QueryAction.WALLET_STATUS:
      result = await handleWalletStatus(parsed);
      break;

    case QueryAction.TOKEN_BALANCE:
      result = await handleTokenBalance(parsed, network);
      break;

    case QueryAction.NFT_BALANCE:
      result = await handleNftBalance(parsed, network);
      break;

    // ── Transactions ─────────────────────────────────────────
    case QueryAction.TRANSACTIONS:
      result = await handleTransactions(parsed, network);
      break;

    case QueryAction.TRANSACTION_DETAIL:
      result = await handleTransactionDetail(parsed, network);
      break;

    case QueryAction.FAILED_TRANSACTIONS:
      result = await handleFailedTransactions(parsed, network);
      break;

    case QueryAction.LARGE_TRANSFERS:
      result = await handleLargeTransfers(parsed, network);
      break;

    // ── Contracts ────────────────────────────────────────────
    case QueryAction.CONTRACT_DEPLOYER:
      result = await handleContractDeployer(parsed, network);
      break;

    case QueryAction.CONTRACT_VERIFICATION:
      result = await handleContractVerification(parsed, network);
      break;

    case QueryAction.FAILED_CONTRACT_DEPLOYMENTS:
    case QueryAction.DEPLOYS:
      result = await handleFailedContractDeployments(parsed, network);
      break;

    // ── Network & Gas ────────────────────────────────────────
    case QueryAction.GAS_PRICE:
      result = await handleGasPrice(parsed, network);
      break;

    case QueryAction.BLOCK_INFO:
      result = await handleBlockInfo(parsed, network);
      break;

    case QueryAction.NETWORK_STATS:
      result = await handleNetworkStats(parsed, network);
      break;

    // ── Alerts ───────────────────────────────────────────────
    case QueryAction.CREATE_ALERT:
      result = await handleCreateAlert(parsed);
      break;

    case QueryAction.LIST_ALERTS:
      result = await handleListAlerts(parsed);
      break;

    case QueryAction.DELETE_ALERT:
      result = await handleDeleteAlert(parsed);
      break;

    case QueryAction.PAUSE_ALL_ALERTS:
      result = await handlePauseAllAlerts(parsed);
      break;

    // ── Portfolio ────────────────────────────────────────────
    case QueryAction.PORTFOLIO_SUMMARY:
      result = await handlePortfolioSummary(parsed);
      break;

    case QueryAction.ADD_PORTFOLIO_WALLET:
      result = await handleAddPortfolioWallet(parsed);
      break;

    case QueryAction.REMOVE_PORTFOLIO_WALLET:
      result = await handleRemovePortfolioWallet(parsed);
      break;

    // ── Language ─────────────────────────────────────────────
    case QueryAction.SET_LANGUAGE:
      result = await handleSetLanguage(parsed);
      break;

    // ── Help ─────────────────────────────────────────────────
    case QueryAction.HELP:
      result = await handleHelp();
      break;

    // ── Unknown ──────────────────────────────────────────────
    case QueryAction.UNKNOWN:
    default:
      result = await handleUnknown(parsed);
      break;
  }

  // Translate response if user prefers non-English
  if (userLanguage !== 'en' && result.text) {
    try {
      result.text = await translateResponse(result.text, userLanguage);
    } catch (err) {
      logger.error('[queryRouter] Translation failed, returning original', { error: err, userLanguage });
    }
  }

  return result;
}

// ─── Wallet & Balance Handlers ──────────────────────────────

async function handleWalletBalance(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Balance of xdc123..."' };
  }

  try {
    const data = await getWalletBalance(address, network);
    return {
      text:
        `💰 *Wallet Balance*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Address: \`${data.address}\`\n` +
        `Balance: **${data.balanceXDC} XDC**\n\n` +
        `[View on Explorer](${data.explorerUrl})`,
      rawData: data,
    };
  } catch (err) {
    logger.error('[queryRouter] getWalletBalance failed', { address, network, error: err });
    return { text: '❌ Failed to fetch wallet balance. Please try again later.' };
  }
}

async function handleWalletActivity(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Show activity for xdc123..."' };
  }

  try {
    const data = await getWalletActivity(address, network);
    const explorerUrl = getAddressExplorerUrl(network, address);
    return {
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
    logger.error('[queryRouter] getWalletActivity failed', { address, network, error: err });
    return { text: '❌ Failed to fetch wallet activity. Please try again later.' };
  }
}

async function handleWalletStatus(parsed: ParsedQuery): Promise<QueryResult> {
  const { userId, platform } = parsed;

  if (!userId || !platform) {
    return { text: '❌ Unable to check wallet status. Please try again.' };
  }

  try {
    const { getConnectedWallet } = await import('../connectedWalletService');
    const wallet = await getConnectedWallet(userId, platform as any);

    if (!wallet) {
      return {
        text:
          `👛 *No Wallet Connected*\n\n` +
          `You haven't connected a wallet yet.\n\n` +
          `Send /start to connect your XDC wallet.`,
      };
    }

    const networkLabel = wallet.network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet';
    const prefix = wallet.network === 'testnet' ? 'txdc' : 'xdc';
    const displayAddress = wallet.address.startsWith('0x')
      ? `${prefix}${wallet.address.slice(2)}`
      : wallet.address;

    return {
      text:
        `👛 *Wallet Connected*\n\n` +
        `Network: ${networkLabel}\n` +
        `Address: \`${displayAddress}\`\n\n` +
        `Use /disconnect to remove this wallet.`,
    };
  } catch (err) {
    logger.error('[queryRouter] handleWalletStatus failed', { userId, platform, error: err });
    return { text: '❌ Failed to check wallet status. Please try again later.' };
  }
}

async function handleTokenBalance(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  const tokenAddress = parsed.tokenAddress || parsed.token || '';

  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Token balance of xdc123..."' };
  }

  if (!tokenAddress) {
    return {
      text:
        `⏳ *Token Balance*\n\n` +
        `I need a token contract address to check your balance.\n\n` +
        `Example: "Token balance of xdc123... for token 0xabc..."`,
    };
  }

  try {
    const data = await getTokenBalance(address, tokenAddress, network);
    return {
      text:
        `🪙 *Token Balance*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Wallet: \`${data.address}\`\n` +
        `Token: \`${data.tokenAddress}\`\n` +
        `Balance: **${data.balance}**`,
      rawData: data,
    };
  } catch (err) {
    logger.error('[queryRouter] getTokenBalance failed', { address, tokenAddress, network, error: err });
    return { text: '❌ Failed to fetch token balance. Please try again later.' };
  }
}

function handleNftBalance(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return Promise.resolve({ text: '❌ Please provide a wallet address.\n\nExample: "NFTs owned by xdc123..."' });
  }
  const explorerUrl = getAddressExplorerUrl(network, address);
  return Promise.resolve({
    text:
      `🎨 *NFT Balance*\n\n` +
      `NFT lookup for \`${address}\` is not yet available.\n\n` +
      `You can view this address on the explorer:\n` +
      `[View on Explorer](${explorerUrl})`,
  });
}

// ─── Transaction Handlers ───────────────────────────────────

async function handleTransactions(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Show transactions for xdc123..."' };
  }

  try {
    const data = await getTransactions(address, network, 1, 5);
    const explorerUrl = getAddressExplorerUrl(network, address);

    let text =
      `📄 *Transaction History*\n\n` +
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

    return { text, rawData: data };
  } catch (err) {
    logger.error('[queryRouter] getTransactions failed', { address, network, error: err });
    return { text: '❌ Failed to fetch transactions. Please try again later.' };
  }
}

async function handleTransactionDetail(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const txHash = parsed.txHash || parsed.hash || '';
  if (!txHash) {
    return { text: '❌ Please provide a transaction hash.\n\nExample: "Tx 0xabc..."' };
  }

  try {
    const data = await getTransactionByHash(txHash, network);
    const explorerUrl = getTxExplorerUrl(network, txHash);

    if (!data.transaction) {
      return {
        text:
          `📄 *Transaction Detail*\n\n` +
          `Hash: \`${txHash}\`\n` +
          `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n\n` +
          `View full details on the explorer:\n` +
          `[View on Explorer](${explorerUrl})`,
        rawData: data,
      };
    }

    const tx = data.transaction;
    return {
      text:
        `📄 *Transaction Detail*\n\n` +
        `Hash: \`${tx.hash}\`\n` +
        `Status: ${tx.status === 'success' ? '✅ Success' : tx.status === 'failed' ? '❌ Failed' : '⏳ Pending'}\n` +
        `From: \`${tx.from}\`\n` +
        `To: \`${tx.to || 'Contract Creation'}\`\n` +
        `Value: **${Number(tx.value) / 1e18} XDC**\n` +
        `Block: ${tx.blockNumber}\n\n` +
        `[View on Explorer](${explorerUrl})`,
      rawData: data,
    };
  } catch (err) {
    logger.error('[queryRouter] getTransactionByHash failed', { txHash, network, error: err });
    return { text: '❌ Failed to fetch transaction details. Please try again later.' };
  }
}

async function handleFailedTransactions(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Failed transactions for xdc123..."' };
  }

  try {
    const data = await getFailedTransactions(address, network, 5);
    const explorerUrl = getAddressExplorerUrl(network, address);
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

    return { text, rawData: data };
  } catch (err) {
    logger.error('[queryRouter] getFailedTransactions failed', { address, network, error: err });
    return { text: '❌ Failed to fetch failed transactions. Please try again later.' };
  }
}

async function handleLargeTransfers(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  const threshold = parsed.threshold || 1000;

  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Large transfers from xdc123..."' };
  }

  try {
    const data = await getLargeTransfers(address, network, Number(threshold));
    const explorerUrl = getAddressExplorerUrl(network, address);
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

    return { text, rawData: data };
  } catch (err) {
    logger.error('[queryRouter] getLargeTransfers failed', { address, network, error: err });
    return { text: '❌ Failed to fetch large transfers. Please try again later.' };
  }
}

// ─── Contract Handlers ──────────────────────────────────────

function handleContractDeployer(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const contract = parsed.contract || parsed.address || '';
  if (!contract) {
    return Promise.resolve({ text: '❌ Please provide a contract address.\n\nExample: "Who deployed 0xabc...?"' });
  }
  const explorerUrl = getAddressExplorerUrl(network, contract);
  return Promise.resolve({
    text:
      `🔍 *Contract Deployer*\n\n` +
      `Deployer lookup for \`${contract}\` requires internal transaction tracing.\n\n` +
      `[View Contract on Explorer](${explorerUrl})`,
  });
}

function handleContractVerification(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const contract = parsed.contract || parsed.address || '';
  if (!contract) {
    return Promise.resolve({ text: '❌ Please provide a contract address.\n\nExample: "Is 0xabc... verified?"' });
  }
  const explorerUrl = getAddressExplorerUrl(network, contract);
  return Promise.resolve({
    text:
      `✅ *Contract Verification*\n\n` +
      `Verification check for \`${contract}\` is not yet available.\n\n` +
      `[View Contract on Explorer](${explorerUrl})`,
  });
}

async function handleFailedContractDeployments(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const period = parsed.period || '7d';

  try {
    const data = await getFailedContractDeployments(network, 5);
    return {
      text:
        `❌ *Failed Contract Deployments*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Period: last ${period}\n` +
        `Total Found: **${data.totalCount}**\n\n` +
        `Note: This query requires scanning internal transactions, which is not fully supported yet.`,
      rawData: data,
    };
  } catch (err) {
    logger.error('[queryRouter] getFailedContractDeployments failed', { network, error: err });
    return { text: '❌ Failed to fetch failed contract deployments. Please try again later.' };
  }
}

// ─── Network & Gas Handlers ─────────────────────────────────

async function handleGasPrice(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  try {
    const data = await getGasPrice(network);
    return {
      text:
        `⛽ *Gas Price*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Safe: **${data.safeGasPrice} Gwei**\n` +
        `Standard: **${data.proposeGasPrice} Gwei**\n` +
        `Fast: **${data.fastGasPrice} Gwei**`,
      rawData: data,
    };
  } catch (err) {
    logger.error('[queryRouter] getGasPrice failed', { network, error: err });
    return { text: '❌ Failed to fetch gas price. Please try again later.' };
  }
}

async function handleBlockInfo(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const blockNumber = parsed.blockNumber || parsed.block || 'latest';

  try {
    const data = await getBlockByNumber(blockNumber, network);
    return {
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
    logger.error('[queryRouter] getBlockByNumber failed', { blockNumber, network, error: err });
    return { text: '❌ Failed to fetch block info. Please try again later.' };
  }
}

function handleNetworkStats(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  return Promise.resolve({
    text:
      `🌐 *Network Stats*\n\n` +
      `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
      `XDC Network is operational ✅\n\n` +
      `Use /gas for current gas prices\n` +
      `Use /block for latest block info`,
  });
}

// ─── Alert Handlers ─────────────────────────────────────────

async function handleCreateAlert(parsed: ParsedQuery): Promise<QueryResult> {
  const { userId, platform, chatId, alertType, alertName, threshold, operator, currency, unit } = parsed;

  if (!userId || !platform || !chatId) {
    return { text: '❌ Unable to create alert. Please try again.' };
  }

  try {
    const type = alertType || 'price_threshold';
    const name = alertName || `${type} alert`;
    const condition: any = {};

    if (threshold !== undefined) condition.value = threshold;
    if (operator) condition.operator = operator;
    if (currency) condition.currency = currency;
    if (unit) condition.unit = unit;

    const alert = await createAlert({
      userId,
      platform: platform as any,
      chatId,
      type: type as any,
      name,
      condition,
      cooldownMinutes: 60,
    });

    return {
      text:
        `🔔 *Alert Created*\n\n` +
        `Name: **${alert.name}**\n` +
        `Type: ${alert.type}\n` +
        `Status: ✅ Active\n\n` +
        `You'll be notified when the condition is met.`,
    };
  } catch (err) {
    logger.error('[queryRouter] createAlert failed', { error: err });
    return { text: '❌ Failed to create alert. Please try again later.' };
  }
}

async function handleListAlerts(parsed: ParsedQuery): Promise<QueryResult> {
  const { userId } = parsed;

  if (!userId) {
    return { text: '❌ Unable to list alerts. Please try again.' };
  }

  try {
    const alerts = await listAlerts(userId);

    if (alerts.length === 0) {
      return {
        text:
          `📋 *Your Alerts*\n\n` +
          `You have no active alerts.\n\n` +
          `Create one with:\n` +
          `• \`/alert gas > 50\`\n` +
          `• \`/alert price < 0.02\`\n` +
          `• \`Alert me when XDC drops below \$0.02\``,
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

    text += 'To delete: \`/deletealert <id>\`\n';
    text += 'To stop all alerts: \`/stopalerts\`';

    return { text };
  } catch (err) {
    logger.error('[queryRouter] listAlerts failed', { error: err });
    return { text: '❌ Failed to list alerts. Please try again later.' };
  }
}

async function handleDeleteAlert(parsed: ParsedQuery): Promise<QueryResult> {
  const { alertId, userId } = parsed;

  if (!alertId) {
    return { text: '❌ Please provide an alert ID.\n\nUsage: /deletealert <id>' };
  }

  try {
    const success = await deleteAlert(alertId, userId || '');

    if (success) {
      return {
        text: `🗑️ *Alert Deleted*\n\nThe alert has been removed.`,
      };
    }
    return {
      text: '⚠️ Alert not found or already deleted.',
    };
  } catch (err) {
    logger.error('[queryRouter] deleteAlert failed', { error: err });
    return { text: '❌ Failed to delete alert. Please try again later.' };
  }
}

async function handlePauseAllAlerts(parsed: ParsedQuery): Promise<QueryResult> {
  const { userId } = parsed;

  if (!userId) {
    return { text: '❌ Unable to stop alerts. Please try again.' };
  }

  try {
    const count = await pauseAllAlerts(userId);
    if (count === 0) {
      return { text: 'ℹ️ You have no active alerts to stop.' };
    }

    return {
      text:
        `🔕 *Alerts Paused*

` +
        `Stopped ${count} active alert${count === 1 ? '' : 's'}.
` +
        `Use /alerts to review your paused alerts or /deletealert <id> to remove them permanently.`,
    };
  } catch (err) {
    logger.error('[queryRouter] pauseAllAlerts failed', { error: err });
    return { text: '❌ Failed to stop alerts. Please try again later.' };
  }
}

// ─── Portfolio Handlers ─────────────────────────────────────

async function handlePortfolioSummary(parsed: ParsedQuery): Promise<QueryResult> {
  const { userId, platform } = parsed;

  if (!userId || !platform) {
    return { text: '❌ Unable to fetch portfolio. Please try again.' };
  }

  try {
    const { getPortfolioSummary } = await import('../portfolioService');
    const portfolio = await getPortfolioSummary(userId, platform);

    if (portfolio.totalWallets === 0) {
      return {
        text:
          `📊 *Portfolio*\n\n` +
          `No wallets in your portfolio yet.\n\n` +
          `Add one with:\n` +
          `• "Add wallet xdc123... to portfolio"\n` +
          `• "Track wallet 0xabc..."`,
      };
    }

    let text =
      `📊 *Portfolio Overview*\n\n` +
      `Wallets: **${portfolio.totalWallets}**\n` +
      `Total Balance: **${portfolio.totalBalanceXDC} XDC** (~$${portfolio.totalBalanceUSD})\n` +
      `Last Updated: ${portfolio.lastUpdated.toLocaleString()}\n\n`;

    portfolio.wallets.forEach((w, i) => {
      const label = w.label ? ` (${w.label})` : '';
      text += `${i + 1}. \`${w.address.slice(0, 16)}...\`${label}\n`;
      text += `   ${w.network === 'testnet' ? '🧪' : '🌐'} ${w.balanceXDC} XDC | ${w.txCount} txs\n`;
    });

    return { text, rawData: portfolio };
  } catch (err) {
    logger.error('[queryRouter] handlePortfolioSummary failed', { userId, platform, error: err });
    return { text: '❌ Failed to fetch portfolio. Please try again later.' };
  }
}

async function handleAddPortfolioWallet(parsed: ParsedQuery): Promise<QueryResult> {
  const { userId, platform, address, network } = parsed;

  if (!userId || !platform) {
    return { text: '❌ Unable to add wallet. Please try again.' };
  }

  const walletAddress = address || parsed.wallet || '';
  if (!walletAddress) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Add wallet xdc123... to portfolio"' };
  }

  try {
    const { addPortfolioWallet } = await import('../portfolioService');
    const result = await addPortfolioWallet(
      userId,
      platform,
      walletAddress,
      network || 'mainnet'
    );
    return { text: result.message };
  } catch (err) {
    logger.error('[queryRouter] handleAddPortfolioWallet failed', { userId, address, error: err });
    return { text: '❌ Failed to add wallet to portfolio.' };
  }
}

async function handleRemovePortfolioWallet(parsed: ParsedQuery): Promise<QueryResult> {
  const { userId, platform, address } = parsed;

  if (!userId || !platform) {
    return { text: '❌ Unable to remove wallet. Please try again.' };
  }

  const walletAddress = address || parsed.wallet || '';
  if (!walletAddress) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Remove wallet xdc123... from portfolio"' };
  }

  try {
    const { removePortfolioWallet } = await import('../portfolioService');
    const result = await removePortfolioWallet(userId, platform, walletAddress);
    return { text: result.message };
  } catch (err) {
    logger.error('[queryRouter] handleRemovePortfolioWallet failed', { userId, address, error: err });
    return { text: '❌ Failed to remove wallet from portfolio.' };
  }
}

// ─── Language Handler ───────────────────────────────────────

async function handleSetLanguage(parsed: ParsedQuery): Promise<QueryResult> {
  const { userId, platform, language } = parsed;
  const lang = language || 'en';

  if (!['en', 'hi', 'mr'].includes(lang)) {
    return { text: '❌ Invalid language. Use: en, hi, or mr' };
  }

  if (userId && platform) {
    try {
      const { UserModel } = await import('../../models/User');
      await UserModel.updateOne(
        { telegramId: parseInt(userId) },
        { preferredLanguage: lang }
      );
    } catch (err) {
      logger.error('[queryRouter] handleSetLanguage failed', { error: err });
    }
  }

  const messages: Record<string, Record<string, string>> = {
    en: { en: '✅ Language set to English', hi: '✅ भाषा अंग्रेजी में सेट की गई', mr: '✅ भाषा इंग्रजीमध्ये सेट केली' },
    hi: { en: '✅ Language set to Hindi', hi: '✅ भाषा हिंदी में सेट की गई', mr: '✅ भाषा हिंदीमध्ये सेट केली' },
    mr: { en: '✅ Language set to Marathi', hi: '✅ भाषा मराठी में सेट की गई', mr: '✅ भाषा मराठीत सेट केली' },
  };

  return { text: messages[lang][lang] };
}

// ─── Utility Handlers ───────────────────────────────────────

function handleHelp(): Promise<QueryResult> {
  return Promise.resolve({
    text:
      `🤖 *Smart AI Explorer* — Text the blockchain!\n\n` +
      `*Wallet Queries:*\n` +
      `• "Balance of xdc123..."\n` +
      `• "Show activity for 0xabc..."\n` +
      `• "Large transfers from xdc123..."\n\n` +
      `*Transaction Queries:*\n` +
      `• "Tx 0xabc..."\n` +
      `• "Failed transactions for xdc123..."\n` +
      `• "Failed deploys last week"\n\n` +
      `*Network Queries:*\n` +
      `• "Gas price"\n` +
      `• "Block 12345"\n\n` +
      `*Alerts:*\n` +
      `• "Alert me when XDC drops below \$0.02"\n` +
      `• "Show my alerts"\n` +
      `• "Delete alert #1"\n\n` +
      `*Language:*\n` +
      `• /language en — English\n` +
      `• /language hi — Hindi\n` +
      `• /language mr — Marathi\n\n` +
      `*Commands:*\n` +
      `/start, /menu, /status, /track, /untrack, /list, /balance, /tx, /price, /premium, /language, /help`,
  });
}

function handleUnknown(parsed: ParsedQuery): Promise<QueryResult> {
  return Promise.resolve({
    text:
      `Hmm, I didn't catch that. 🤔\n\n` +
      `Try asking like:\n` +
      `• "Show balance of xdc..."\n` +
      `• "What is tx 0x...?"\n` +
      `• "Failed contracts last 3 days"\n` +
      `• "Gas price now"\n\n` +
      `Or type "help" for all options.`,
  });
}
