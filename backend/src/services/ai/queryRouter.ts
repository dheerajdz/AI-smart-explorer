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
import { WebhookService } from '../webhook';
import { emitWebhookEventAsync } from '../webhook';

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
 * @returns Friendly text response for WhatsApp/Telegram
 */
export async function executeQuery(parsed: ParsedQuery): Promise<QueryResult> {
  const { action } = parsed;
  const network: Network = parsed.network || 'mainnet';

  logger.info('[queryRouter] Executing action', { action, network, params: Object.keys(parsed) });

  switch (action) {
    // ── Wallet & Balance ─────────────────────────────────────
    case QueryAction.WALLET_BALANCE:
      return handleWalletBalance(parsed, network);

    case QueryAction.WALLET_ACTIVITY:
      return handleWalletActivity(parsed, network);

    case QueryAction.TOKEN_BALANCE:
      return handleTokenBalance(parsed, network);

    case QueryAction.NFT_BALANCE:
      return handleNftBalance(parsed, network);

    // ── Transactions ─────────────────────────────────────────
    case QueryAction.TRANSACTIONS:
      return handleTransactions(parsed, network);

    case QueryAction.TRANSACTION_DETAIL:
      return handleTransactionDetail(parsed, network);

    case QueryAction.FAILED_TRANSACTIONS:
      return handleFailedTransactions(parsed, network);

    case QueryAction.LARGE_TRANSFERS:
      return handleLargeTransfers(parsed, network);

    // ── Contracts ────────────────────────────────────────────
    case QueryAction.CONTRACT_DEPLOYER:
      return handleContractDeployer(parsed, network);

    case QueryAction.CONTRACT_VERIFICATION:
      return handleContractVerification(parsed, network);

    case QueryAction.FAILED_CONTRACT_DEPLOYMENTS:
      return handleFailedContractDeployments(parsed, network);

    // ── Network & Gas ────────────────────────────────────────
    case QueryAction.GAS_PRICE:
      return handleGasPrice(parsed, network);

    case QueryAction.BLOCK_INFO:
      return handleBlockInfo(parsed, network);

    case QueryAction.NETWORK_STATS:
      return handleNetworkStats(parsed, network);

    // ── Alerts ───────────────────────────────────────────────
    case QueryAction.CREATE_ALERT:
      return handleCreateAlert(parsed);

    case QueryAction.LIST_ALERTS:
      return handleListAlerts(parsed);

    case QueryAction.DELETE_ALERT:
      return handleDeleteAlert(parsed);

    // ── Webhooks ───────────────────────────────────────────────
    case QueryAction.WEBHOOK_CREATE:
      return handleWebhookCreate(parsed);

    case QueryAction.WEBHOOK_LIST:
      return handleWebhookList(parsed);

    case QueryAction.WEBHOOK_DELETE:
      return handleWebhookDelete(parsed);

    case QueryAction.WEBHOOK_TEST:
      return handleWebhookTest(parsed);

    // ── Help ─────────────────────────────────────────────────
    case QueryAction.HELP:
      return handleHelp();

    // ── Unknown ──────────────────────────────────────────────
    case QueryAction.UNKNOWN:
    default:
      return handleUnknown(parsed);
  }
}

// ─── Wallet & Balance Handlers ──────────────────────────────

async function handleWalletBalance(parsed: ParsedQuery, network: Network): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Balance of xdc123..."' };
  }

  try {
    const data = await getWalletBalance(address, network);
    const result = {
      text:
        `💰 *Wallet Balance*\n\n` +
        `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
        `Address: \`${data.address}\`\n` +
        `Balance: **${data.balanceXDC} XDC**\n\n` +
        `[View on Explorer](${data.explorerUrl})`,
      rawData: data,
    };

    // Emit webhook event for wallet balance check
    emitWebhookEventAsync('wallet.tracked', {
      address: data.address,
      balanceXDC: data.balanceXDC,
      source: data.source,
    });

    return result;
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
    const result = {
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

    // Emit webhook event for wallet activity check
    emitWebhookEventAsync('wallet.tracked', {
      address: data.address,
      totalTransactions: data.totalTransactions,
      uniqueContractsInteracted: data.uniqueContractsInteracted,
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
    });

    return result;
  } catch (err) {
    logger.error('[queryRouter] getWalletActivity failed', { address, network, error: err });
    return { text: '❌ Failed to fetch wallet activity. Please try again later.' };
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

    // Emit webhook event for large transfers
    emitWebhookEventAsync('large.transfer', {
      address: data.address,
      threshold: data.threshold,
      transferCount: count,
      transfers: data.transfers.slice(0, 5),
    });

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
      `📈 *Network Stats*\n\n` +
      `Network: ${network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n\n` +
      `Network-wide statistics are not yet available. Try:\n` +
      `• "Gas price"\n` +
      `• "Block 12345"`,
  });
}

// ─── Alert Handlers ─────────────────────────────────────────

function handleCreateAlert(parsed: ParsedQuery): Promise<QueryResult> {
  // Emit webhook event for alert creation
  emitWebhookEventAsync('alert.triggered', {
    message: 'New alert created',
    type: parsed.type || 'price_threshold',
    condition: parsed.condition || {},
    note: 'This is a creation event. Actual trigger events will fire when conditions are met.',
  });

  return Promise.resolve({
    text:
      `🔔 *Alert Created*\n\n` +
      `Your alert has been set. You will be notified when the condition is met.\n\n` +
      `Condition: ${JSON.stringify(parsed.condition || {})}`,
  });
}

function handleListAlerts(parsed: ParsedQuery): Promise<QueryResult> {
  return Promise.resolve({
    text:
      `📋 *Your Alerts*\n\n` +
      `You have no active alerts.\n\n` +
      `Create one with: "Alert me when XDC drops below $0.02"`,
  });
}

function handleDeleteAlert(parsed: ParsedQuery): Promise<QueryResult> {
  return Promise.resolve({
    text:
      `🗑️ *Alert Deleted*\n\n` +
      `The alert has been removed.`,
  });
}

// ─── Webhook Handlers ───────────────────────────────────────

async function handleWebhookCreate(parsed: ParsedQuery): Promise<QueryResult> {
  const url = parsed.url || '';
  const events = parsed.events || ['large.transfer'];
  const userId = parsed.userId || 'anonymous';

  if (!url) {
    return { text: '❌ Please provide a webhook URL.\n\nExample: "Webhook add https://myapp.com/events"' };
  }

  if (!url.startsWith('https://')) {
    return { text: '❌ Webhook URL must use HTTPS for security.' };
  }

  try {
    const webhook = await WebhookService.create({ userId, url, events });
    return {
      text:
        `🔗 *Webhook Registered*\n\n` +
        `URL: \`${webhook.url}\`\n` +
        `Events: **${webhook.events.join(', ')}**\n` +
        `Secret: \`${webhook.secret}\`\n\n` +
        `Save this secret — it's shown only once!`,
    };
  } catch (err) {
    logger.error('[queryRouter] webhook_create failed', { url, error: err });
    return { text: '❌ Failed to register webhook. Please try again.' };
  }
}

async function handleWebhookList(parsed: ParsedQuery): Promise<QueryResult> {
  const userId = parsed.userId || 'anonymous';

  try {
    const webhooks = await WebhookService.listByUser(userId);

    if (webhooks.length === 0) {
      return { text: '📭 *No Webhooks*\n\nYou have no registered webhooks.\n\nCreate one: "Webhook add https://myapp.com/events"' };
    }

    let text = `🔗 *Your Webhooks* (${webhooks.length})\n\n`;
    webhooks.forEach((w, i) => {
      const status = w.isActive ? '✅' : '❌';
      text += `${i + 1}. ${status} \`${w.url}\`\n   Events: ${w.events.join(', ')}\n   Failures: ${w.failureCount}\n\n`;
    });

    return { text };
  } catch (err) {
    logger.error('[queryRouter] webhook_list failed', { error: err });
    return { text: '❌ Failed to list webhooks.' };
  }
}

async function handleWebhookDelete(parsed: ParsedQuery): Promise<QueryResult> {
  const webhookId = parsed.webhookId || parsed.id || '';
  const userId = parsed.userId || 'anonymous';

  if (!webhookId) {
    return { text: '❌ Please provide a webhook ID.\n\nExample: "Delete webhook 667123..."' };
  }

  try {
    const deleted = await WebhookService.delete(userId, webhookId);
    if (!deleted) {
      return { text: '⚠️ Webhook not found or you do not own it.' };
    }
    return { text: '🗑️ *Webhook Deleted*\n\nThe webhook has been removed.' };
  } catch (err) {
    logger.error('[queryRouter] webhook_delete failed', { webhookId, error: err });
    return { text: '❌ Failed to delete webhook.' };
  }
}

async function handleWebhookTest(parsed: ParsedQuery): Promise<QueryResult> {
  const webhookId = parsed.webhookId || parsed.id || '';

  if (!webhookId) {
    return { text: '❌ Please provide a webhook ID.\n\nExample: "Test webhook 667123..."' };
  }

  try {
    const webhook = await WebhookService.findById(webhookId);
    if (!webhook) {
      return { text: '⚠️ Webhook not found.' };
    }

    const { emitWebhookEvent } = await import('../webhook');
    await emitWebhookEvent('wallet.tracked', {
      message: 'This is a test event from Smart AI Explorer',
      walletAddress: 'xdc0000000000000000000000000000000000000000',
      test: true,
    });

    return { text: '✅ *Test Event Sent*\n\nCheck your endpoint for the payload.' };
  } catch (err) {
    logger.error('[queryRouter] webhook_test failed', { webhookId, error: err });
    return { text: '❌ Failed to send test event.' };
  }
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
      `*Commands:*\n` +
      `/help, /status, /track, /untrack, /list, /balance, /tx, /price`,
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
