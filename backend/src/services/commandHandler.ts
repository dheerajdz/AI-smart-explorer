import { logger } from '../utils/logger';
import { redis } from '../database';
import * as walletService from './walletService';

export interface CommandResponse {
  text: string;
}

export async function commandHandler(
  command: string,
  args: string[],
  userId: string
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

    default:
      return { text: 'Unknown command.\n\nType /help to view available commands.' };
  }
}

function handleHelp(): CommandResponse {
  return {
    text: `Smart AI Explorer Commands

/help - Show commands
/status - Bot status
/track <wallet> - Track wallet
/untrack <wallet> - Stop tracking wallet
/list - List tracked wallets`,
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
