import { logger } from '../utils/logger';
import { redis } from '../database';
import * as walletService from './walletService';
import { getBalance, getTxList } from './blockchain';
import { isValidXdcAddress, getExplorerAddressUrl, getExplorerTxUrl, Network } from '../utils/network';

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
      return handleTrack(userId, args);

    case '/untrack':
      return handleUntrack(userId, args);

    case '/list':
      return handleList(userId);

    case '/balance':
      return await handleBalance(userId, args);

    case '/tx':
      return await handleTx(userId, args);

    default:
      return { text: 'Unknown command.\n\nType /help to view available commands.' };
  }
}

function handleHelp(): CommandResponse {
  return {
    text: `Smart AI Explorer Commands

/help - Show commands
/status - Bot status
/track <wallet> - Track wallet (xdc... or txdc...)
/untrack <wallet> - Stop tracking wallet
/list - List tracked wallets
/balance <wallet> - Get wallet balance
/tx <wallet> - Get recent transactions`,
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

  if (!isValidXdcAddress(wallet)) {
    return { text: '❌ Invalid XDC address.\n\nAddresses must start with xdc (mainnet) or txdc (testnet).' };
  }

  const result = walletService.trackWallet(userId, wallet);

  if (!result.success) {
    return { text: '❌ Failed to track wallet. Please try again.' };
  }

  const networkLabel = result.network === 'testnet' ? '🔵 Testnet' : '🟢 Mainnet';
  const explorerUrl = getExplorerAddressUrl(result.network, result.wallet);

  if (result.alreadyTracked) {
    return {
      text: `⚠️ Wallet already tracked\n\nWallet: \`${result.wallet}\`\nNetwork: ${networkLabel}\n[View on Explorer](${explorerUrl})`,
    };
  }

  return {
    text: `✅ Wallet tracking enabled\n\nWallet: \`${result.wallet}\`\nNetwork: ${networkLabel}\n[View on Explorer](${explorerUrl})`,
  };
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

  const lines = wallets.map((w, index) => {
    const netLabel = w.network === 'testnet' ? '🔵 Testnet' : '🟢 Mainnet';
    return `${index + 1}. \`${w.address}\` ${netLabel}`;
  });

  return { text: `Tracked Wallets\n\n${lines.join('\n')}` };
}

async function handleBalance(userId: string, args: string[]): Promise<CommandResponse> {
  const wallet = args.join(' ').trim();

  if (!wallet) {
    return { text: '❌ Please provide a wallet address.\n\nUsage: /balance <wallet>' };
  }

  if (!isValidXdcAddress(wallet)) {
    return { text: '❌ Invalid XDC address.\n\nAddresses must start with xdc (mainnet) or txdc (testnet).' };
  }

  try {
    const result = await getBalance(wallet);
    const xdcValue = (BigInt(result.balance) / BigInt(10 ** 18)).toString();
    const networkLabel = result.network === 'testnet' ? '🔵 Testnet' : '🟢 Mainnet';
    const explorerUrl = getExplorerAddressUrl(result.network, result.address);

    return {
      text: `💰 Balance\n\nWallet: \`${result.address}\`\nNetwork: ${networkLabel}\nBalance: **${xdcValue} XDC**\n[View on Explorer](${explorerUrl})`,
    };
  } catch (err) {
    logger.error('Balance fetch failed', { wallet, error: (err as Error).message });
    return { text: '❌ Failed to fetch balance. Please try again later.' };
  }
}

async function handleTx(userId: string, args: string[]): Promise<CommandResponse> {
  const wallet = args.join(' ').trim();

  if (!wallet) {
    return { text: '❌ Please provide a wallet address.\n\nUsage: /tx <wallet>' };
  }

  if (!isValidXdcAddress(wallet)) {
    return { text: '❌ Invalid XDC address.\n\nAddresses must start with xdc (mainnet) or txdc (testnet).' };
  }

  try {
    const result = await getTxList(wallet);
    const networkLabel = result.network === 'testnet' ? '🔵 Testnet' : '🟢 Mainnet';

    if (result.transactions.length === 0) {
      return {
        text: `📭 No transactions found\n\nWallet: \`${result.address}\`\nNetwork: ${networkLabel}`,
      };
    }

    const top5 = result.transactions.slice(0, 5);
    const lines = top5.map((tx, i) => {
      const xdcValue = (BigInt(tx.value) / BigInt(10 ** 18)).toString();
      const explorerUrl = getExplorerTxUrl(result.network, tx.hash);
      const status = tx.isError === '1' ? '❌ Failed' : '✅ Success';
      return `${i + 1}. [${status}] ${xdcValue} XDC\n   \`${tx.hash}\`\n   [View on Explorer](${explorerUrl})`;
    });

    return {
      text: `📜 Recent Transactions\n\nWallet: \`${result.address}\`\nNetwork: ${networkLabel}\n\n${lines.join('\n\n')}`,
    };
  } catch (err) {
    logger.error('Tx list fetch failed', { wallet, error: (err as Error).message });
    return { text: '❌ Failed to fetch transactions. Please try again later.' };
  }
}
