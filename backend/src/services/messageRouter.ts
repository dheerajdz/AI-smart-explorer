import { logger } from '../utils/logger';
import { commandHandler } from './commandHandler';
import { parseQuery, QueryAction, ParsedQuery } from './ai';
import {
  getWalletBalance,
  getTransactions,
  getWalletActivity,
  getLargeTransfers,
} from './blockchain';

export interface RouterResponse {
  text: string;
}

/**
 * Route incoming WhatsApp/Telegram messages.
 *
 * Flow:
 *   1. If message starts with "/" → use legacy commandHandler
 *   2. Otherwise → send to AI queryParser
 *   3. Based on parsed action → call correct blockchain service
 *   4. Format raw data into friendly text
 *   5. Return response
 */
export async function messageRouter(
  message: string,
  userId: string
): Promise<RouterResponse> {
  const trimmedMessage = message.trim();

  logger.info('Routing message', { userId, message: trimmedMessage });

  // ─── 1. Legacy slash commands ───────────────────────────────
  if (trimmedMessage.startsWith('/')) {
    const parts = trimmedMessage.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    return commandHandler(command, args, userId);
  }

  // ─── 2. AI natural language parsing ─────────────────────────
  let parsed: ParsedQuery;
  try {
    parsed = await parseQuery(trimmedMessage);
  } catch (err) {
    logger.error('[messageRouter] parseQuery failed', { error: err, message: trimmedMessage });
    return { text: '❌ Sorry, I could not understand that. Try typing "help" for examples.' };
  }

  // ─── 3. Route by action ─────────────────────────────────────
  try {
    return await executeAction(parsed);
  } catch (err) {
    logger.error('[messageRouter] executeAction failed', { action: parsed.action, error: err });
    return { text: '❌ Something went wrong while fetching data. Please try again later.' };
  }
}

// ─── Action Executor ──────────────────────────────────────────

async function executeAction(parsed: ParsedQuery): Promise<RouterResponse> {
  const { action } = parsed;

  switch (action) {
    // ── Wallet & Balance ─────────────────────────────────────
    case QueryAction.WALLET_BALANCE: {
      const address = parsed.address || parsed.wallet || '';
      if (!address) return { text: '❌ Please provide a wallet address.\n\nExample: "Balance of xdc123..."' };
      const data = await getWalletBalance(address);
      return {
        text: `💰 *Wallet Balance*\n\nAddress: \`${data.address}\`\nBalance: **${data.balanceXDC} XDC**`,
      };
    }

    case QueryAction.WALLET_ACTIVITY: {
      const address = parsed.address || parsed.wallet || '';
      if (!address) return { text: '❌ Please provide a wallet address.\n\nExample: "Show activity for xdc123..."' };
      const data = await getWalletActivity(address);
      return {
        text: `📊 *Wallet Activity*\n\nAddress: \`${data.address}\`\nTotal Transactions: **${data.totalTransactions}**\nFirst Seen: ${data.firstSeen ? new Date(data.firstSeen).toLocaleDateString() : 'N/A'}\nLast Seen: ${data.lastSeen ? new Date(data.lastSeen).toLocaleDateString() : 'N/A'}`,
      };
    }

    // ── Transactions ─────────────────────────────────────────
    case QueryAction.TRANSACTION_DETAIL: {
      const txHash = parsed.txHash || parsed.hash || '';
      if (!txHash) return { text: '❌ Please provide a transaction hash.\n\nExample: "Tx 0xabc..."' };
      // For single tx detail, fetch recent txs and filter (XDCScan doesn't have direct tx detail endpoint)
      return { text: `⏳ Transaction detail lookup for \`${txHash}\` is coming soon.` };
    }

    case QueryAction.LARGE_TRANSFERS: {
      const address = parsed.address || parsed.wallet || '';
      const threshold = parsed.threshold || 1000;
      if (!address) return { text: '❌ Please provide a wallet address.\n\nExample: "Large transfers from xdc123..."' };
      const data = await getLargeTransfers(address, Number(threshold));
      const count = data.transfers.length;
      return {
        text: `🐋 *Large Transfers*\n\nAddress: \`${data.address}\`\nThreshold: **${data.threshold} XDC**\nFound: **${count}** transfer${count !== 1 ? 's' : ''}`,
      };
    }

    // ── Network ──────────────────────────────────────────────
    case QueryAction.GAS_PRICE:
      return { text: '⛽ *Gas Price*\n\nCurrent gas price data is coming soon.' };

    case QueryAction.BLOCK_INFO:
      return { text: `📦 *Block Info*\n\nBlock lookup is coming soon.` };

    case QueryAction.NETWORK_STATS:
      return { text: '📈 *Network Stats*\n\nXDC network overview is coming soon.' };

    // ── Alerts ─────────────────────────────────────────────────
    case QueryAction.CREATE_ALERT:
      return { text: '🔔 *Alert Created*\n\nYour alert has been set. You will be notified when the condition is met.' };

    case QueryAction.LIST_ALERTS:
      return { text: '📋 *Your Alerts*\n\nYou have no active alerts.' };

    case QueryAction.DELETE_ALERT:
      return { text: '🗑️ *Alert Deleted*\n\nThe alert has been removed.' };

    // ── Help ───────────────────────────────────────────────────
    case QueryAction.HELP:
      return {
        text: `🤖 *Smart AI Explorer* — Text the blockchain!\n\nTry:\n• "Balance of xdc123..."\n• "Tx 0xabc..."\n• "Failed deploys last week"\n• "Alert me when XDC drops below $0.02"\n\nOr use commands:\n/help, /status, /track, /untrack, /list`,
      };

    // ── Unknown ────────────────────────────────────────────────
    case QueryAction.UNKNOWN:
    default:
      return {
        text: `Hmm, I didn't catch that. 🤔\n\nTry asking like:\n• "Show balance of 0x..."\n• "What is tx 0x...?"\n• "Failed contracts last 3 days"\n\nOr type "help" for all options.`,
      };
  }
}
