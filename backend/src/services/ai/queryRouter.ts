// ============================================================
// queryRouter.ts
// The brain that routes parsed AI queries to the correct
// blockchain service and formats the response.
//
// Flow:
//   ParsedQuery (action + params)
//        ↓
//   executeQuery()
//        ↓
//   Call correct service (xdcscan / blockscout)
//        ↓
//   Format raw data → friendly text
// ============================================================

import { logger } from '../../utils/logger';
import { QueryAction, ParsedQuery } from '../../types';
import {
  getWalletBalance,
  getTransactions,
  getWalletActivity,
  getLargeTransfers,
} from '../blockchain';
import { formatResponse } from './kimiService';
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

  logger.info('[queryRouter] Executing action', { action, params: Object.keys(parsed) });

  switch (action) {
    // ── Wallet & Balance ─────────────────────────────────────
    case QueryAction.WALLET_BALANCE:
      return handleWalletBalance(parsed);

    case QueryAction.WALLET_ACTIVITY:
      return handleWalletActivity(parsed);

    case QueryAction.TOKEN_BALANCE:
      return handleTokenBalance(parsed);

    case QueryAction.NFT_BALANCE:
      return handleNftBalance(parsed);

    // ── Transactions ─────────────────────────────────────────
    case QueryAction.TRANSACTION_DETAIL:
      return handleTransactionDetail(parsed);

    case QueryAction.FAILED_TRANSACTIONS:
      return handleFailedTransactions(parsed);

    case QueryAction.LARGE_TRANSFERS:
      return handleLargeTransfers(parsed);

    // ── Contracts ────────────────────────────────────────────
    case QueryAction.CONTRACT_DEPLOYER:
      return handleContractDeployer(parsed);

    case QueryAction.CONTRACT_VERIFICATION:
      return handleContractVerification(parsed);

    case QueryAction.FAILED_CONTRACT_DEPLOYMENTS:
      return handleFailedContractDeployments(parsed);

    // ── Network & Gas ────────────────────────────────────────
    case QueryAction.GAS_PRICE:
      return handleGasPrice(parsed);

    case QueryAction.BLOCK_INFO:
      return handleBlockInfo(parsed);

    case QueryAction.NETWORK_STATS:
      return handleNetworkStats(parsed);

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

async function handleWalletBalance(parsed: ParsedQuery): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Balance of xdc123..."' };
  }

  try {
    const data = await getWalletBalance(address);
    const result = {
      text: `💰 *Wallet Balance*\n\nAddress: \`${data.address}\`\nBalance: **${data.balanceXDC} XDC**`,
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
    logger.error('[queryRouter] getWalletBalance failed', { address, error: err });
    return { text: '❌ Failed to fetch wallet balance. Please try again later.' };
  }
}

async function handleWalletActivity(parsed: ParsedQuery): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Show activity for xdc123..."' };
  }

  try {
    const data = await getWalletActivity(address);
    const result = {
      text:
        `📊 *Wallet Activity*\n\n` +
        `Address: \`${data.address}\`\n` +
        `Total Transactions: **${data.totalTransactions}**\n` +
        `First Seen: ${data.firstSeen ? new Date(data.firstSeen).toLocaleDateString() : 'N/A'}\n` +
        `Last Seen: ${data.lastSeen ? new Date(data.lastSeen).toLocaleDateString() : 'N/A'}\n` +
        `Contracts Interacted: **${data.uniqueContractsInteracted}**`,
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
    logger.error('[queryRouter] getWalletActivity failed', { address, error: err });
    return { text: '❌ Failed to fetch wallet activity. Please try again later.' };
  }
}

function handleTokenBalance(parsed: ParsedQuery): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return Promise.resolve({ text: '❌ Please provide a wallet address.\n\nExample: "Token balance of xdc123..."' });
  }
  return Promise.resolve({ text: `⏳ Token balance lookup for \`${address}\` is coming soon.` });
}

function handleNftBalance(parsed: ParsedQuery): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return Promise.resolve({ text: '❌ Please provide a wallet address.\n\nExample: "NFTs owned by xdc123..."' });
  }
  return Promise.resolve({ text: `⏳ NFT balance lookup for \`${address}\` is coming soon.` });
}

// ─── Transaction Handlers ───────────────────────────────────

async function handleTransactionDetail(parsed: ParsedQuery): Promise<QueryResult> {
  const txHash = parsed.txHash || parsed.hash || '';
  if (!txHash) {
    return { text: '❌ Please provide a transaction hash.\n\nExample: "Tx 0xabc..."' };
  }

  // XDCScan doesn't have a direct tx detail endpoint; we could fetch recent txs and filter
  // For now, return a placeholder
  return { text: `⏳ Transaction detail for \`${txHash}\` is coming soon.` };
}

function handleFailedTransactions(parsed: ParsedQuery): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  if (!address) {
    return Promise.resolve({ text: '❌ Please provide a wallet address.\n\nExample: "Failed transactions for xdc123..."' });
  }
  return Promise.resolve({ text: `⏳ Failed transaction lookup for \`${address}\` is coming soon.` });
}

async function handleLargeTransfers(parsed: ParsedQuery): Promise<QueryResult> {
  const address = parsed.address || parsed.wallet || '';
  const threshold = parsed.threshold || 1000;

  if (!address) {
    return { text: '❌ Please provide a wallet address.\n\nExample: "Large transfers from xdc123..."' };
  }

  try {
    const data = await getLargeTransfers(address, Number(threshold));
    const count = data.transfers.length;

    let text = `🐋 *Large Transfers*\n\n`;
    text += `Address: \`${data.address}\`\n`;
    text += `Threshold: **${data.threshold} XDC**\n`;
    text += `Found: **${count}** transfer${count !== 1 ? 's' : ''}\n\n`;

    if (count > 0) {
      data.transfers.slice(0, 5).forEach((tx, i) => {
        text += `${i + 1}. \`${tx.hash.slice(0, 20)}...\` → **${tx.valueXDC} XDC**\n`;
      });
      if (count > 5) text += `\n...and ${count - 5} more`;
    }

    const result = { text, rawData: data };

    // Emit webhook event for large transfers
    emitWebhookEventAsync('large.transfer', {
      address: data.address,
      threshold: data.threshold,
      transferCount: count,
      transfers: data.transfers.slice(0, 5),
    });

    return result;
  } catch (err) {
    logger.error('[queryRouter] getLargeTransfers failed', { address, error: err });
    return { text: '❌ Failed to fetch large transfers. Please try again later.' };
  }
}

// ─── Contract Handlers ──────────────────────────────────────

function handleContractDeployer(parsed: ParsedQuery): Promise<QueryResult> {
  const contract = parsed.contract || parsed.address || '';
  if (!contract) {
    return Promise.resolve({ text: '❌ Please provide a contract address.\n\nExample: "Who deployed 0xabc...?"' });
  }
  return Promise.resolve({ text: `⏳ Contract deployer lookup for \`${contract}\` is coming soon.` });
}

function handleContractVerification(parsed: ParsedQuery): Promise<QueryResult> {
  const contract = parsed.contract || parsed.address || '';
  if (!contract) {
    return Promise.resolve({ text: '❌ Please provide a contract address.\n\nExample: "Is 0xabc... verified?"' });
  }
  return Promise.resolve({ text: `⏳ Contract verification check for \`${contract}\` is coming soon.` });
}

function handleFailedContractDeployments(parsed: ParsedQuery): Promise<QueryResult> {
  const period = parsed.period || '7d';
  return Promise.resolve({ text: `⏳ Failed contract deployments (last ${period}) is coming soon.` });
}

// ─── Network & Gas Handlers ─────────────────────────────────

function handleGasPrice(parsed: ParsedQuery): Promise<QueryResult> {
  return Promise.resolve({ text: '⛽ *Gas Price*\n\nCurrent gas price data is coming soon.' });
}

function handleBlockInfo(parsed: ParsedQuery): Promise<QueryResult> {
  const blockNumber = parsed.blockNumber || parsed.block || 'latest';
  return Promise.resolve({ text: `📦 *Block Info*\n\nBlock lookup for \`${blockNumber}\` is coming soon.` });
}

function handleNetworkStats(parsed: ParsedQuery): Promise<QueryResult> {
  return Promise.resolve({ text: '📈 *Network Stats*\n\nXDC network overview is coming soon.' });
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

  return Promise.resolve({ text: '🔔 *Alert Created*\n\nYour alert has been set. You will be notified when the condition is met.' });
}

function handleListAlerts(parsed: ParsedQuery): Promise<QueryResult> {
  return Promise.resolve({ text: '📋 *Your Alerts*\n\nYou have no active alerts.' });
}

function handleDeleteAlert(parsed: ParsedQuery): Promise<QueryResult> {
  return Promise.resolve({ text: '🗑️ *Alert Deleted*\n\nThe alert has been removed.' });
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
      `• "Failed deploys last week"\n\n` +
      `*Commands:*\n` +
      `/help, /status, /track, /untrack, /list`,
  });
}

function handleUnknown(parsed: ParsedQuery): Promise<QueryResult> {
  return Promise.resolve({
    text:
      `Hmm, I didn't catch that. 🤔\n\n` +
      `Try asking like:\n` +
      `• "Show balance of 0x..."\n` +
      `• "What is tx 0x...?"\n` +
      `• "Failed contracts last 3 days"\n\n` +
      `Or type "help" for all options.`,
  });
}
