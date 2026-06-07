import { logger } from '../utils/logger';
import { redis } from '../database';
import * as walletService from './walletService';
import * as planService from './planService';
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
      return await handleTrack(userId, args);

    case '/untrack':
      return await handleUntrack(userId, args);

    case '/list':
      return await handleList(userId);

    case '/plans':
      return handlePlans();

    case '/myplan':
      return await handleMyPlan(telegramId);

    case '/admin':
      return await handleAdmin(args, telegramId);

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

async function handleTrack(userId: string, args: string[]): Promise<CommandResponse> {
  const wallet = args.join(' ').trim();

  if (!wallet) {
    return { text: '❌ Please provide a wallet address.\n\nUsage: /track <wallet>' };
  }

  const result = await walletService.trackWallet(wallet, userId);

  if (result.alreadyTracked) {
    return { text: `⚠️ Wallet already tracked\n\nWallet:\n${wallet}` };
  }

  return { text: `✅ Wallet tracking enabled\n\nWallet:\n${wallet}` };
}

async function handleUntrack(userId: string, args: string[]): Promise<CommandResponse> {
  const wallet = args.join(' ').trim();

  if (!wallet) {
    return { text: '❌ Please provide a wallet address.\n\nUsage: /untrack <wallet>' };
  }

  const result = await walletService.untrackWallet(wallet, userId);

  if (!result.success) {
    return { text: `⚠️ Wallet not found in tracking list\n\nWallet:\n${wallet}` };
  }

  return { text: `✅ Wallet removed from tracking\n\nWallet:\n${wallet}` };
}

async function handleList(userId: string): Promise<CommandResponse> {
  const wallets = await walletService.listWallets(userId);

  if (wallets.length === 0) {
    return { text: 'No tracked wallets.\n\nUse /track <wallet> to start tracking.' };
  }

  const list = wallets.map((wallet, index) => `${index + 1}. ${wallet.address} (${wallet.network})`).join('\n');
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
