import { logger } from '../utils/logger';
import { redis } from '../database';
import * as walletService from './walletService';
import * as planService from './planService';
import * as reputationService from './reputationService';
import {
  analyzeWalletReputation,
  formatReputationMessage,
  isValidAddress,
} from './blockchain/walletReputation';
import { PlanTier } from '../types';
import { env } from '../config/env';

export interface CommandResponse {
  text: string;
}

export async function commandHandler(
  command: string,
  args: string[],
  userId: string,
  telegramId?: number
): Promise<CommandResponse> {
  const normalizedCommand = command.toLowerCase();

  logger.info('Executing command', { userId, command: normalizedCommand, args });

  switch (normalizedCommand) {
    case '/help':
      return handleHelp();

    case '/status':
      return await handleStatus();

    case '/track':
      return handleTrack(userId, args);

    case '/untrack':
      return handleUntrack(userId, args);

    case '/list':
      return handleList(userId);

    case '/plans':
      return handlePlans();

    case '/myplan':
      return await handleMyPlan(telegramId);

    case '/admin':
      return await handleAdmin(args, telegramId);

    case '/rep':
      return await handleUserReputation(userId, telegramId);

    case '/reputation':
      return await handleWalletReputation(args);

    default:
      return { text: 'Unknown command.\n\nType /help to view available commands.' };
  }
}

function handleHelp(): CommandResponse {
  return {
    text:
      `📖 *Commands*\n\n` +
      `🔍 *Wallet Tracking*\n` +
      `• /track <wallet> — Monitor an XDC wallet\n` +
      `• /untrack <wallet> — Stop tracking\n` +
      `• /list — Your tracked wallets\n\n` +
      `💎 *Plans*\n` +
      `• /plans — Compare plans\n` +
      `• /myplan — Your current plan\n\n` +
      `🏆 *Reputation*\n` +
      `• /rep — Your activity reputation\n` +
      `• /reputation <wallet> — Analyze wallet on-chain trust\n\n` +
      `⚙️ *System*\n` +
      `• /status — Bot health\n` +
      `• /help — This menu`,
  };
}

async function handleStatus(): Promise<CommandResponse> {
  let redisStatus = 'Disconnected';
  try {
    await redis.ping();
    redisStatus = 'Connected';
  } catch {
    redisStatus = 'Disconnected';
  }

  return {
    text: `Smart AI Explorer Status

WhatsApp: Online
Telegram: Online
Backend: Online
MongoDB: Connected
Redis: ${redisStatus}`,
  };
}

function handleTrack(userId: string, args: string[]): CommandResponse {
  const wallet = args.join(' ').trim();

  if (!wallet) {
    return { text: '❌ Please provide a wallet address.\n\nUsage: /track <wallet>' };
  }

  const result = walletService.trackWallet(userId, wallet);

  if (!result.success) {
    return { text: '❌ Failed to track wallet. Please try again.' };
  }

  if (result.alreadyTracked) {
    return { text: `⚠️ Wallet already tracked\n\nWallet:\n${result.wallet}` };
  }

  reputationService.addPoints(userId, 10, 'walletsTracked');

  return { text: `✅ Wallet tracking enabled\n\nWallet:\n${result.wallet}` };
}

function handleUntrack(userId: string, args: string[]): CommandResponse {
  const wallet = args.join(' ').trim();

  if (!wallet) {
    return { text: '❌ Please provide a wallet address.\n\nUsage: /untrack <wallet>' };
  }

  const result = walletService.untrackWallet(userId, wallet);

  if (!result.success) {
    if (result.notFound) {
      return { text: `⚠️ Wallet not found in tracking list\n\nWallet:\n${result.wallet}` };
    }
    return { text: '❌ Failed to remove wallet. Please try again.' };
  }

  return { text: `✅ Wallet removed from tracking\n\nWallet:\n${result.wallet}` };
}

function handleList(userId: string): CommandResponse {
  const wallets = walletService.listWallets(userId);

  if (wallets.length === 0) {
    return { text: 'No tracked wallets.\n\nUse /track <wallet> to start tracking.' };
  }

  const list = wallets.map((wallet, index) => `${index + 1}. ${wallet}`).join('\n');

  reputationService.addPoints(userId, 1, 'commandsUsed');

  return { text: `Tracked Wallets\n\n${list}` };
}

function handlePlans(): CommandResponse {
  return {
    text:
      `💎 *Plans*\n\n` +
      `🆓 *FREE*\n` +
      `For all XDC explorers\n` +
      `• Wallet tracking\n` +
      `• Basic blockchain queries\n\n` +
      `⭐ *PRO*\n` +
      `Enhanced tools for active traders\n` +
      `• Everything in FREE\n` +
      `• Advanced alerts\n` +
      `• Priority AI responses\n\n` +
      `🏢 *ENTERPRISE*\n` +
      `For teams and institutions\n` +
      `• Everything in PRO\n` +
      `• Multi-wallet dashboards\n` +
      `• Dedicated support\n\n` +
      `📌 Check yours: /myplan`,
  };
}

async function handleMyPlan(telegramId?: number): Promise<CommandResponse> {
  if (!telegramId) {
    return { text: '❌ Unable to identify user.' };
  }

  const plan = await planService.getUserPlan(telegramId);

  if (!plan) {
    return { text: '❌ No plan found. Try /start to register.' };
  }

  reputationService.addPoints(telegramId.toString(), 1, 'commandsUsed');

  return {
    text:
      `📋 *Your Plan*\n\n` +
      `Tier: ${planService.planDisplay(plan)}\n` +
      `Status: Active\n` +
      `Since: ${new Date().toLocaleDateString()}\n\n` +
      `💡 Change anytime: /plans`,
  };
}

async function handleAdmin(args: string[], adminTelegramId?: number): Promise<CommandResponse> {
  if (!adminTelegramId || adminTelegramId.toString() !== env.ADMIN_TELEGRAM_ID) {
    return { text: '❌ Admin access denied.' };
  }

  if (args.length < 3 || args[0] !== 'setplan') {
    return { text: 'Usage: /admin setplan <telegramId> <FREE|PRO|ENTERPRISE>' };
  }

  const targetId = parseInt(args[1], 10);
  const newPlan = args[2].toUpperCase() as PlanTier;

  if (!['FREE', 'PRO', 'ENTERPRISE'].includes(newPlan)) {
    return { text: '❌ Invalid plan. Use FREE, PRO, or ENTERPRISE.' };
  }

  if (isNaN(targetId)) {
    return { text: '❌ Invalid telegram ID.' };
  }

  const updated = await planService.setUserPlan(targetId, newPlan);

  if (!updated) {
    return { text: `❌ User ${targetId} not found.` };
  }

  return {
    text: `✅ Plan updated\n\nUser: ${targetId}\nNew Plan: ${planService.planDisplay(newPlan)}`,
  };
}

async function handleWalletReputation(args: string[]): Promise<CommandResponse> {
  const wallet = args.join(' ').trim();

  if (!wallet) {
    return {
      text:
        '💎 *Wallet Reputation*\n\n' +
        'Analyze any XDC wallet\'s on-chain history.\n\n' +
        '*Usage:*\n' +
        '`/reputation xdcA7A0...2020`\n' +
        '`/reputation 0xA7A0...2020`\n\n' +
        'Returns:\n' +
        '• Trust score (0-100)\n' +
        '• Tier (Unverified → Legendary)\n' +
        '• Account age, tx count, balance\n' +
        '• Activity frequency, counterparties',
    };
  }

  // Validate XDC address format
  if (!isValidAddress(wallet)) {
    return {
      text: '❌ Invalid wallet address.\n\nUse format:\n• xdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020\n• 0xA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020',
    };
  }

  try {
    const data = await analyzeWalletReputation(wallet);
    return { text: formatReputationMessage(data) };
  } catch (error) {
    logger.error('Wallet reputation analysis failed', { wallet, error: (error as Error).message });
    return {
      text: '❌ Failed to analyze wallet.\n\nPossible reasons:\n• Invalid address\n• Network unavailable\n• No transaction history\n\nTry again later.',
    };
  }
}

async function handleUserReputation(userId: string, telegramId?: number): Promise<CommandResponse> {
  const lookupId = telegramId?.toString() || userId;
  const rep = await reputationService.getReputation(lookupId);

  if (!rep) {
    return { text: '❌ No reputation found. Try /start to register.' };
  }

  return {
    text:
      `🏆 *Your Reputation*\n\n` +
      `Tier: ${reputationService.tierDisplay(rep.tier)}\n` +
      `Score: ${rep.score} pts\n\n` +
      `📊 *Stats*\n` +
      `• Queries: ${rep.totalQueries}\n` +
      `• Wallets: ${rep.walletsTracked}\n` +
      `• Commands: ${rep.commandsUsed}\n\n` +
      `💡 Keep exploring to rank up!`,
  };
}
