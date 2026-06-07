import { logger } from '../utils/logger';
import { detectNetwork, isValidXdcAddress } from '../utils/network';
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
} from './blockchainCommands';

export interface RouterResponse {
  text: string;
}

/**
 * Keyword-based router for natural language messages.
 * No AI required — fast, predictable, works offline.
 *
 * Flow:
 *   1. Extract address from message
 *   2. Check for keywords (balance, tx, gas, etc.)
 *   3. Route to appropriate command
 *   4. If no match → suggest commands
 */
export async function keywordRouter(
  message: string,
  userId: string,
  platform?: string
): Promise<RouterResponse> {
  try {
    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();

    logger.info('[keywordRouter] Processing', { userId, message: trimmed });

    // ─── Extract address ────────────────────────────────────────
    const addr = extractAddress(trimmed);

    // ─── WhatsApp numbered menu responses ───────────────────────
    if (platform === 'whatsapp') {
      // ... (rest of WhatsApp handling)
    }

    // ─── 0. Greetings ───────────────────────────────────────────
    if (
      lower === 'hi' ||
      lower === 'hii' ||
      lower === 'hello' ||
      lower === 'hey' ||
      lower === 'start'
    ) {
      return {
        text:
          '👋 *Welcome to Smart AI Explorer!*\n\n' +
          'I am your AI assistant for the XDC blockchain.\n\n' +
          '*What you can ask me:*\n' +
          '• "Balance of xdc..."\n' +
          '• "Show transactions for xdc..."\n' +
          '• "Gas price"\n' +
          '• "Block 12345"\n' +
          '• "Track wallet xdc..."\n' +
          '• "Failed contract deploys last week"\n\n' +
          '*Or use commands:*\n' +
          '• `/balance xdc...`\n' +
          '• `/tx xdc...`\n' +
          '• `/gas`\n' +
          '• `/help`\n\n' +
          'How can I help you today? 🚀',
      };
    }

    // ─── 1. Balance queries ─────────────────────────────────────
    if (lower.includes('balance') || lower.includes('how much')) {
      if (!addr) {
        return {
          text:
            '💰 *Balance Lookup*\n\n' +
            'Please provide a wallet address.\n\n' +
            'Try:\n' +
            '• `/balance xdc...`\n' +
            '• `/balance txdc...`',
        };
      }
      const result = await cmdBalance(addr);
      return { text: result.text };
    }

    // ─── 2. Transaction queries ─────────────────────────────────
    if (
      lower.includes('transaction') ||
      lower.includes('tx history') ||
      lower.includes('history') ||
      lower.includes('recent tx')
    ) {
      if (!addr) {
        return {
          text:
            '📄 *Transaction History*\n\n' +
            'Please provide a wallet address.\n\n' +
            'Try:\n' +
            '• `/tx xdc...`\n' +
            '• `/tx txdc...`',
        };
      }
      const result = await cmdTransactions(addr, 5);
      return { text: result.text };
    }

    // ─── 3. Gas price ───────────────────────────────────────────
    if (lower.includes('gas') || lower.includes('fee')) {
      const result = await cmdGasPrice();
      return { text: result.text };
    }

    // ─── 4. Block info ──────────────────────────────────────────
    if (lower.includes('block')) {
      const match = trimmed.match(/(\d+)/);
      const blockNumber = match ? match[1] : 'latest';
      const result = await cmdBlockInfo(blockNumber);
      return { text: result.text };
    }

    // ─── 5. Activity / Stats ────────────────────────────────────
    if (lower.includes('activity') || lower.includes('stats') || lower.includes('overview')) {
      if (!addr) {
        return {
          text:
            '📊 *Wallet Activity*\n\n' +
            'Please provide a wallet address.\n\n' +
            'Try: `/activity xdc...`',
        };
      }
      const result = await cmdWalletActivity(addr);
      return { text: result.text };
    }

    // ─── 6. Failed transactions ─────────────────────────────────
    if (lower.includes('failed')) {
      if (!addr) {
        return {
          text:
            '❌ *Failed Transactions*\n\n' +
            'Please provide a wallet address.\n\n' +
            'Try: `/failed xdc...`',
        };
      }
      const result = await cmdFailedTransactions(addr, 5);
      return { text: result.text };
    }

    // ─── 7. Large transfers ─────────────────────────────────────
    if (lower.includes('large') || lower.includes('whale') || lower.includes('big transfer')) {
      if (!addr) {
        return {
          text:
            '🐋 *Large Transfers*\n\n' +
            'Please provide a wallet address.\n\n' +
            'Try: `/large xdc...`',
        };
      }
      const result = await cmdLargeTransfers(addr, 1000);
      return { text: result.text };
    }

    // ─── 8. Price ───────────────────────────────────────────────
    if (lower.includes('price') || lower.includes('cost') || lower.includes('value')) {
      const result = cmdPrice();
      return { text: result.text };
    }

    // ─── 9. Status / Network ────────────────────────────────────
    if (lower.includes('status') || lower.includes('network') || lower.includes('operational')) {
      const result = await cmdStatus();
      return { text: result.text };
    }

    // ─── 10. Help / Main Menu ───────────────────────────────────
    if (lower.includes('help') || lower === '?' || lower.includes('command') || lower.includes('main menu') || lower === 'menu' || lower === 'start') {
      const result = cmdHelp();
      return { text: result.text };
    }

    // ─── 11. Track ──────────────────────────────────────────────
    if (lower.includes('track') || lower.includes('monitor') || lower.includes('watch')) {
      if (!addr) {
        return {
          text:
            '🔔 *Track Wallet*\n\n' +
            'Please provide a wallet address.\n\n' +
            'Try: `/track xdc...`',
        };
      }
      const result = cmdTrack(addr, userId);
      return { text: result.text };
    }

    // ─── 12. Untrack ────────────────────────────────────────────
    if (lower.includes('untrack') || lower.includes('stop monitoring')) {
      if (!addr) {
        return {
          text:
            '🔕 *Untrack Wallet*\n\n' +
            'Please provide a wallet address.\n\n' +
            'Try: `/untrack xdc...`',
        };
      }
      const result = cmdUntrack(addr, userId);
      return { text: result.text };
    }

    // ─── 13. List tracked ───────────────────────────────────────
    if (lower.includes('list') || lower.includes('tracked') || lower.includes('my wallets')) {
      const result = cmdList(userId);
      return { text: result.text };
    }

    // ─── 14. Connect wallet ─────────────────────────────────────
    if (lower.includes('connect wallet') || lower.includes('add wallet') || lower.includes('link wallet')) {
      return {
        text:
          '🔗 *Connect Wallet*\n\n' +
          'WhatsApp wallet connection is menu-driven.\n\n' +
          'Send me your XDC address and I will save it for you.\n\n' +
          'Example: `xdc1234...abcd`',
      };
    }

    // ─── 15. Disconnect wallet ──────────────────────────────────
    if (lower.includes('disconnect') || lower.includes('remove wallet') || lower.includes('logout wallet')) {
      const { disconnectWallet } = await import('./connectedWalletService');
      const result = await disconnectWallet(userId, 'whatsapp');
      return {
        text:
          result.success
            ? '✅ *Wallet Disconnected*\n\nYour wallet has been removed. Send /start to connect a new one.'
            : '⚠️ No wallet found to disconnect.',
      };
    }

    // ─── 16. Subscription / Billing ───────────────────────────────
    if (lower.includes('subscription') || lower.includes('my plan') || lower.includes('current plan') || lower.includes('tier')) {
      const { getOrCreateSubscription } = await import('./billing/subscriptionService');
      const sub = await getOrCreateSubscription(userId);
      const tier = sub.tier;
      const expires = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A';
      
      return {
        text:
          `📋 *Your Subscription*\n\n` +
          `*Tier:* ${tier.toUpperCase()}\n` +
          `*Status:* ${sub.status}\n` +
          `*Renews:* ${expires}\n\n` +
          (tier === 'free'
            ? `💡 Upgrade to unlock more features:\n• /upgrade — see plans`
            : `✅ You have full access.\n• /billing — manage subscription`),
      };
    }

    if (lower.includes('upgrade') || lower.includes('go pro') || lower.includes('billing') || lower.includes('payment')) {
      const { createCheckoutSession } = await import('./billing/subscriptionService');
      
      // Determine which tier
      const isEnterprise = lower.includes('enterprise') || lower.includes('business');
      const tier = isEnterprise ? 'enterprise' : 'pro';
      
      try {
        const session = await createCheckoutSession(userId, tier as any);
        return {
          text:
            `💳 *Upgrade to ${tier.toUpperCase()}*\n\n` +
            `Click below to complete payment:\n\n` +
            `${session.url}`,
        };
      } catch (err) {
        return {
          text:
            `⚠️ *Billing Unavailable*\n\n` +
            `Stripe is not configured. Please contact support.`,
        };
      }
    }

    // ─── 17. Portfolio ────────────────────────────────────────────
    if (lower.includes('portfolio') || lower.includes('my wallets') || lower.includes('all wallets') || lower.includes('net worth')) {
      const { getPortfolioSummary } = await import('./portfolioService');
      const summary = await getPortfolioSummary(userId);
      return {
        text:
          `📊 *Portfolio Summary*\n\n` +
          `*Wallets:* ${summary.walletCount}\n` +
          `*Total Balance:* ${summary.totalBalanceXDC} XDC\n` +
          `*Total Value:* $${summary.totalValueUSD}\n\n` +
          (summary.wallets.length > 0
            ? summary.wallets.map((w: any) => `• \`${w.address.slice(0, 12)}...\` — ${w.balanceXDC} XDC`).join('\n')
            : 'No wallets connected.'),
      };
    }

    // ─── Fallback: address without keyword ──────────────────────
    if (addr) {
      // User just sent an address — show balance by default
      const result = await cmdBalance(addr);
      return {
        text:
          result.text +
          '\n\n---\n\n' +
          '💡 *Tip:* You can also try:\n' +
          '• `/tx ' +
          addr +
          '` — transactions\n' +
          '• `/activity ' +
          addr +
          '` — activity\n' +
          '• `/track ' +
          addr +
          '` — track this wallet',
      };
    }

    // ─── Complete fallback ──────────────────────────────────────
    return {
      text:
        '🤖 *Smart AI Explorer*\n\n' +
        'I did not understand that. Here is what I can do:\n\n' +
        '*Wallet:*\n' +
        '• `/balance xdc...` — check balance\n' +
        '• `/tx xdc...` — transaction history\n' +
        '• `/activity xdc...` — wallet activity\n\n' +
        '*Network:*\n' +
        '• `/gas` — gas prices\n' +
        '• `/block 12345` — block info\n' +
        '• `/status` — network status\n\n' +
        '*Tracking:*\n' +
        '• `/track xdc...` — track wallet\n' +
        '• `/untrack xdc...` — stop tracking\n' +
        '• `/list` — show tracked wallets\n\n' +
        'Type `/help` for all commands.',
    };
  } catch (err: any) {
    logger.error('[keywordRouter] Unhandled error', {
      error: err?.message || err?.toString?.() || String(err),
      stack: err?.stack,
      message,
      userId,
    });
    return {
      text: "🤖 I didn't understand that. Type /help to see what I can do.",
    };
  }
}

// ─── Helper: extract address ──────────────────────────────────
function extractAddress(message: string): string {
  const match = message.match(/(0x[0-9a-fA-F]{40}|xdc[0-9a-fA-F]{40}|txdc[0-9a-fA-F]{40})/);
  return match ? match[1] : '';
}
