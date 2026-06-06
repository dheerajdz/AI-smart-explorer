# Blockchain Layer Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a robust blockchain abstraction layer that supports both XDC Mainnet and XDC Testnet (Apothem), with wallet tracking, transaction fetching, balance queries, and explorer link generation — all network-aware so users see the correct explorer (XDCScan for mainnet, testnet explorer for testnet) depending on whether they use `xdc` or `txdc` addresses.

**Architecture:** A unified `BlockchainService` abstracts all chain interactions. It auto-detects network from address prefix (`xdc` = mainnet, `txdc` = testnet), routes API calls to the correct endpoints (Blockscout/XDCScan mainnet vs testnet), and returns normalized data. Wallet tracking stores the network per wallet. Cron jobs poll tracked wallets for new transactions and notify users. The frontend will later consume the same service via API.

**Tech Stack:** Node.js, TypeScript, Express, MongoDB (Mongoose), node-cron, node-fetch (native fetch), Telegraf (bot notifications)

---

## Context: Current State

- **Backend:** Express + TypeScript at `backend/src/`
- **Blockchain services:** `backend/src/services/blockchain/` — currently has stub `blockscoutService.ts` and `xdcscanService.ts` with TODO comments, no real API calls
- **Wallet model:** `backend/src/models/Wallet.ts` — has `network: 'xdc' | 'xdc-testnet'` field already
- **Wallet service:** `backend/src/services/walletService.ts` — uses in-memory store, no network awareness
- **Storage:** `backend/src/services/storage/inMemoryStore.ts` — temporary in-memory, needs to support network per wallet
- **Commands:** `/track`, `/untrack`, `/list` exist but don't handle network selection or `txdc` addresses
- **Cron:** `backend/src/cron/jobs.ts` — placeholder, needs wallet polling logic
- **Notifications:** `backend/src/services/notification/telegramNotify.ts` — stub, needs real bot message sending
- **Env:** `BLOCKSCOUT_API`, `XDCSCAN_API` configured for mainnet only; testnet endpoints missing
- **No Web3 library** currently installed — we will use REST APIs (Blockscout/XDCScan) to avoid wallet/private key complexity

---

## XDC Network Reference

| Property | Mainnet | Testnet (Apothem) |
|---|---|---|
| Address prefix | `xdc` | `txdc` |
| Chain ID | 50 | 51 |
| Blockscout API | `https://blockscout.xdc.network/api` | `https://apothem.blockscout.com/api` |
| XDCScan API | `https://api.xdcscan.io/api` | `https://api-testnet.xdcscan.io/api` |
| Explorer (tx) | `https://xdcscan.io/tx/{hash}` | `https://apothem.xdcscan.io/tx/{hash}` |
| Explorer (addr) | `https://xdcscan.io/address/{addr}` | `https://apothem.xdcscan.io/address/{addr}` |

---

## Task 1: Add Testnet Environment Variables

**Objective:** Add testnet API endpoints to env config so both networks are configurable.

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/src/config/env.ts`

**Step 1: Update `.env.example`**

Replace the blockchain API lines with:

```env
# Mainnet APIs
BLOCKSCOUT_API=https://blockscout.xdc.network/api
XDCSCAN_API=https://api.xdcscan.io/api

# Testnet (Apothem) APIs
BLOCKSCOUT_TESTNET_API=https://apothem.blockscout.com/api
XDCSCAN_TESTNET_API=https://api-testnet.xdcscan.io/api
```

**Step 2: Update `env.ts` schema**

Add to the zod schema:

```typescript
BLOCKSCOUT_TESTNET_API: z.string().url().optional(),
XDCSCAN_TESTNET_API: z.string().url().optional(),
```

**Step 3: Commit**

```bash
git add backend/.env.example backend/src/config/env.ts
git commit -m "chore(env): add testnet blockchain API endpoints"
```

---

## Task 2: Create Network Detection Utility

**Objective:** Create a pure utility to detect network from address prefix and validate XDC addresses.

**Files:**
- Create: `backend/src/utils/network.ts`
- Test: `backend/src/utils/network.test.ts` (optional, can add later)

**Step 1: Write the utility**

```typescript
export type Network = 'mainnet' | 'testnet';

const MAINNET_PREFIX = 'xdc';
const TESTNET_PREFIX = 'txdc';

export function detectNetwork(address: string): Network {
  const lower = address.trim().toLowerCase();
  if (lower.startsWith(TESTNET_PREFIX)) return 'testnet';
  if (lower.startsWith(MAINNET_PREFIX)) return 'mainnet';
  // Fallback: if no prefix or 0x, assume mainnet (common default)
  return 'mainnet';
}

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function isValidXdcAddress(address: string): boolean {
  const lower = normalizeAddress(address);
  // xdc... (42 chars) or txdc... (43 chars) or 0x... (42 hex chars)
  if (/^xdc[0-9a-f]{39}$/i.test(lower)) return true;
  if (/^txdc[0-9a-f]{39}$/i.test(lower)) return true;
  if (/^0x[0-9a-f]{40}$/i.test(lower)) return true;
  return false;
}

export function getExplorerBaseUrl(network: Network): string {
  return network === 'testnet'
    ? 'https://apothem.xdcscan.io'
    : 'https://xdcscan.io';
}

export function getExplorerTxUrl(network: Network, txHash: string): string {
  return `${getExplorerBaseUrl(network)}/tx/${txHash}`;
}

export function getExplorerAddressUrl(network: Network, address: string): string {
  return `${getExplorerBaseUrl(network)}/address/${address}`;
}
```

**Step 2: Commit**

```bash
git add backend/src/utils/network.ts
git commit -m "feat(utils): add XDC network detection and explorer URL helpers"
```

---

## Task 3: Build Unified Blockchain Service

**Objective:** Create a single service that abstracts all blockchain API calls, auto-routes by network, and returns normalized data.

**Files:**
- Create: `backend/src/services/blockchain/blockchainService.ts`
- Modify: `backend/src/services/blockchain/index.ts` (update exports)
- Delete: `backend/src/services/blockchain/blockscoutService.ts` (replaced)
- Delete: `backend/src/services/blockchain/xdcscanService.ts` (replaced)

**Step 1: Write `blockchainService.ts`**

```typescript
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { detectNetwork, Network } from '../../utils/network';

// --- Types ---

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasUsed: string;
  timestamp: string;
  blockNumber: string;
  isError: string;
  txReceiptStatus: string;
}

export interface BalanceResult {
  address: string;
  balance: string; // in wei as string
  network: Network;
}

export interface TxListResult {
  address: string;
  transactions: Transaction[];
  network: Network;
}

// --- API Endpoint Resolution ---

function getBlockscoutApi(network: Network): string {
  return network === 'testnet'
    ? (env.BLOCKSCOUT_TESTNET_API ?? 'https://apothem.blockscout.com/api')
    : (env.BLOCKSCOUT_API ?? 'https://blockscout.xdc.network/api');
}

function getXdcscanApi(network: Network): string {
  return network === 'testnet'
    ? (env.XDCSCAN_TESTNET_API ?? 'https://api-testnet.xdcscan.io/api')
    : (env.XDCSCAN_API ?? 'https://api.xdcscan.io/api');
}

// --- Blockscout API ---

export async function getBalanceBlockscout(address: string): Promise<BalanceResult> {
  const network = detectNetwork(address);
  const apiUrl = getBlockscoutApi(network);
  const url = `${apiUrl}?module=account&action=balance&address=${address}`;

  logger.info('Blockscout: getBalance', { address, network });

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== '1' && data.message !== 'OK') {
    logger.warn('Blockscout balance error', { address, message: data.message });
    throw new Error(data.message || 'Blockscout balance fetch failed');
  }

  return {
    address,
    balance: data.result,
    network,
  };
}

export async function getTxListBlockscout(address: string): Promise<TxListResult> {
  const network = detectNetwork(address);
  const apiUrl = getBlockscoutApi(network);
  const url = `${apiUrl}?module=account&action=txlist&address=${address}&sort=desc`;

  logger.info('Blockscout: getTxList', { address, network });

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== '1' && data.message !== 'OK') {
    logger.warn('Blockscout txlist error', { address, message: data.message });
    // Empty result is common for new wallets — return empty array
    if (data.message === 'No transactions found') {
      return { address, transactions: [], network };
    }
    throw new Error(data.message || 'Blockscout txlist fetch failed');
  }

  const txs: Transaction[] = (data.result || []).map((t: any) => ({
    hash: t.hash,
    from: t.from,
    to: t.to,
    value: t.value,
    gasPrice: t.gasPrice,
    gasUsed: t.gasUsed,
    timestamp: t.timeStamp,
    blockNumber: t.blockNumber,
    isError: t.isError ?? '0',
    txReceiptStatus: t.txreceipt_status ?? '',
  }));

  return { address, transactions: txs, network };
}

// --- XDCScan API ---

export async function getBalanceXdcscan(address: string): Promise<BalanceResult> {
  const network = detectNetwork(address);
  const apiUrl = getXdcscanApi(network);
  const url = `${apiUrl}?module=account&action=balance&address=${address}&tag=latest`;

  logger.info('XDCScan: getBalance', { address, network });

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== '1' && data.message !== 'OK') {
    logger.warn('XDCScan balance error', { address, message: data.message });
    throw new Error(data.message || 'XDCScan balance fetch failed');
  }

  return {
    address,
    balance: data.result,
    network,
  };
}

export async function getTxListXdcscan(address: string): Promise<TxListResult> {
  const network = detectNetwork(address);
  const apiUrl = getXdcscanApi(network);
  const url = `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc`;

  logger.info('XDCScan: getTxList', { address, network });

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== '1' && data.message !== 'OK') {
    logger.warn('XDCScan txlist error', { address, message: data.message });
    if (data.message === 'No transactions found') {
      return { address, transactions: [], network };
    }
    throw new Error(data.message || 'XDCScan txlist fetch failed');
  }

  const txs: Transaction[] = (data.result || []).map((t: any) => ({
    hash: t.hash,
    from: t.from,
    to: t.to,
    value: t.value,
    gasPrice: t.gasPrice,
    gasUsed: t.gasUsed,
    timestamp: t.timeStamp,
    blockNumber: t.blockNumber,
    isError: t.isError ?? '0',
    txReceiptStatus: t.txreceipt_status ?? '',
  }));

  return { address, transactions: txs, network };
}

// --- Unified Public API ---

export async function getBalance(address: string): Promise<BalanceResult> {
  // Try Blockscout first, fallback to XDCScan
  try {
    return await getBalanceBlockscout(address);
  } catch (err) {
    logger.warn('Blockscout balance failed, falling back to XDCScan', { address, error: (err as Error).message });
    return await getBalanceXdcscan(address);
  }
}

export async function getTxList(address: string): Promise<TxListResult> {
  try {
    return await getTxListBlockscout(address);
  } catch (err) {
    logger.warn('Blockscout txlist failed, falling back to XDCScan', { address, error: (err as Error).message });
    return await getTxListXdcscan(address);
  }
}
```

**Step 2: Update `backend/src/services/blockchain/index.ts`**

```typescript
export {
  getBalance,
  getTxList,
  getBalanceBlockscout,
  getTxListBlockscout,
  getBalanceXdcscan,
  getTxListXdcscan,
  type Transaction,
  type BalanceResult,
  type TxListResult,
} from './blockchainService';
```

**Step 3: Delete old stub files**

```bash
git rm backend/src/services/blockchain/blockscoutService.ts backend/src/services/blockchain/xdcscanService.ts
```

**Step 4: Commit**

```bash
git add backend/src/services/blockchain/
git commit -m "feat(blockchain): unified blockchain service with mainnet/testnet auto-routing"
```

---

## Task 4: Update In-Memory Store to Support Network per Wallet

**Objective:** Wallet storage must track network alongside address so polling and links are correct.

**Files:**
- Modify: `backend/src/services/storage/inMemoryStore.ts`

**Step 1: Update the store**

```typescript
export interface StoredWallet {
  address: string;
  network: 'mainnet' | 'testnet';
}

const walletsByUser = new Map<string, Map<string, StoredWallet>>();

function getUserWalletMap(userId: string): Map<string, StoredWallet> {
  if (!walletsByUser.has(userId)) {
    walletsByUser.set(userId, new Map());
  }
  return walletsByUser.get(userId)!;
}

export function addWallet(userId: string, address: string): boolean {
  const normalized = address.trim().toLowerCase();
  if (!normalized) return false;

  const { detectNetwork } = require('../../utils/network');
  const network = detectNetwork(normalized);

  const wallets = getUserWalletMap(userId);
  if (wallets.has(normalized)) return false;

  wallets.set(normalized, { address: normalized, network });
  return true;
}

export function removeWallet(userId: string, address: string): boolean {
  const normalized = address.trim().toLowerCase();
  if (!normalized) return false;

  const wallets = getUserWalletMap(userId);
  if (!wallets.has(normalized)) return false;

  wallets.delete(normalized);
  return true;
}

export function listWallets(userId: string): StoredWallet[] {
  const wallets = getUserWalletMap(userId);
  return Array.from(wallets.values());
}

export function clearUserWallets(userId: string): void {
  walletsByUser.delete(userId);
}
```

**Step 2: Update `walletService.ts` to return network info**

Modify `backend/src/services/walletService.ts`:

```typescript
import { logger } from '../utils/logger';
import * as store from './storage/inMemoryStore';

export interface TrackResult {
  success: boolean;
  alreadyTracked?: boolean;
  wallet: string;
  network: 'mainnet' | 'testnet';
}

export interface UntrackResult {
  success: boolean;
  notFound?: boolean;
  wallet: string;
}

export function trackWallet(userId: string, wallet: string): TrackResult {
  const normalized = wallet.trim().toLowerCase();

  if (!normalized) {
    return { success: false, wallet: '', network: 'mainnet' };
  }

  const added = store.addWallet(userId, normalized);
  const stored = store.listWallets(userId).find(w => w.address === normalized);
  const network = stored?.network ?? 'mainnet';

  if (!added) {
    logger.info('Wallet already tracked', { userId, wallet: normalized });
    return { success: true, alreadyTracked: true, wallet: normalized, network };
  }

  logger.info('Wallet tracked', { userId, wallet: normalized, network });
  return { success: true, wallet: normalized, network };
}

export function untrackWallet(userId: string, wallet: string): UntrackResult {
  const normalized = wallet.trim().toLowerCase();

  if (!normalized) {
    return { success: false, wallet: '' };
  }

  const removed = store.removeWallet(userId, normalized);

  if (!removed) {
    logger.info('Wallet not found for untrack', { userId, wallet: normalized });
    return { success: false, notFound: true, wallet: normalized };
  }

  logger.info('Wallet untracked', { userId, wallet: normalized });
  return { success: true, wallet: normalized };
}

export function listWallets(userId: string): store.StoredWallet[] {
  return store.listWallets(userId);
}
```

**Step 3: Commit**

```bash
git add backend/src/services/storage/inMemoryStore.ts backend/src/services/walletService.ts
git commit -m "feat(wallet): store network per tracked wallet"
```

---

## Task 5: Update Bot Commands for Network Awareness

**Objective:** `/track`, `/untrack`, `/list`, and new `/balance` commands must handle `txdc` addresses and show correct network info.

**Files:**
- Modify: `backend/src/services/commandHandler.ts`
- Modify: `backend/src/bots/telegram/index.ts`

**Step 1: Update `commandHandler.ts`**

Add imports:
```typescript
import { getBalance, getTxList } from './blockchain';
import { isValidXdcAddress, getExplorerAddressUrl, Network } from '../utils/network';
```

Update `handleTrack`:
```typescript
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

  const networkLabel = result.network === 'testnet' ? 'Testnet' : 'Mainnet';
  const explorerUrl = getExplorerAddressUrl(result.network as Network, result.wallet);

  if (result.alreadyTracked) {
    return {
      text: `⚠️ Wallet already tracked\n\nWallet: \`${result.wallet}\`\nNetwork: ${networkLabel}\n[View on Explorer](${explorerUrl})`,
    };
  }

  return {
    text: `✅ Wallet tracking enabled\n\nWallet: \`${result.wallet}\`\nNetwork: ${networkLabel}\n[View on Explorer](${explorerUrl})`,
  };
}
```

Update `handleList`:
```typescript
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
```

Add `handleBalance`:
```typescript
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
    const networkLabel = result.network === 'testnet' ? 'Testnet' : 'Mainnet';
    const explorerUrl = getExplorerAddressUrl(result.network, result.address);

    return {
      text: `💰 Balance\n\nWallet: \`${result.address}\`\nNetwork: ${networkLabel}\nBalance: **${xdcValue} XDC**\n[View on Explorer](${explorerUrl})`,
    };
  } catch (err) {
    logger.error('Balance fetch failed', { wallet, error: (err as Error).message });
    return { text: '❌ Failed to fetch balance. Please try again later.' };
  }
}
```

Update the switch case:
```typescript
    case '/balance':
      return await handleBalance(userId, args);
```

Update `handleHelp`:
```typescript
function handleHelp(): CommandResponse {
  return {
    text: `Smart AI Explorer Commands

/help - Show commands
/status - Bot status
/track <wallet> - Track wallet (xdc... or txdc...)
/untrack <wallet> - Stop tracking wallet
/list - List tracked wallets
/balance <wallet> - Get wallet balance`,
  };
}
```

**Step 2: Update `telegram/index.ts`**

Add the `/balance` command handler:
```typescript
  bot.command('balance', (ctx) => {
    const messageText = ctx.message?.text ?? '/balance';
    return handleCommand(ctx, messageText);
  });
```

Update the `/start` welcome message to mention `txdc`:
```typescript
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '👋 Welcome to *Smart AI Explorer* — The Blockchain You Can Text!\n\n' +
        'I can help you query XDC blockchain data using natural language.\n\n' +
        '*Commands:*\n' +
        '/help - Show commands\n' +
        '/status - Bot status\n' +
        '/track <wallet> - Track wallet (xdc... or txdc...)\n' +
        '/untrack <wallet> - Untrack wallet\n' +
        '/list - List tracked wallets\n' +
        '/balance <wallet> - Get wallet balance',
      { parse_mode: 'Markdown' }
    );
  });
```

**Step 3: Commit**

```bash
git add backend/src/services/commandHandler.ts backend/src/bots/telegram/index.ts
git commit -m "feat(commands): add /balance, validate addresses, show network in tracking"
```

---

## Task 6: Build Transaction Polling & Notification Cron

**Objective:** Poll tracked wallets for new transactions and send Telegram notifications with correct explorer links.

**Files:**
- Create: `backend/src/cron/walletPoller.ts`
- Modify: `backend/src/cron/jobs.ts`
- Modify: `backend/src/services/notification/telegramNotify.ts`

**Step 1: Write `walletPoller.ts`**

```typescript
import { logger } from '../utils/logger';
import { getTxList, Transaction } from '../services/blockchain';
import * as store from '../services/storage/inMemoryStore';
import { sendTelegramNotification } from '../services/notification/telegramNotify';
import { getExplorerTxUrl, Network } from '../utils/network';

// In-memory last-seen tx hash per wallet (replace with Redis later)
const lastSeenTx = new Map<string, string>();

function getLastSeenKey(userId: string, address: string): string {
  return `${userId}:${address}`;
}

export async function pollWallets(): Promise<void> {
  logger.info('🔍 Starting wallet poll');

  // Iterate all users and their wallets
  for (const [userId, walletMap] of store.getAllUsers?.() ?? []) {
    for (const [address, wallet] of walletMap) {
      try {
        const result = await getTxList(address);
        if (result.transactions.length === 0) continue;

        const latestTx = result.transactions[0];
        const key = getLastSeenKey(userId, address);
        const previous = lastSeenTx.get(key);

        if (previous && previous !== latestTx.hash) {
          // New transaction detected
          const explorerUrl = getExplorerTxUrl(result.network, latestTx.hash);
          const networkLabel = result.network === 'testnet' ? 'Testnet' : 'Mainnet';
          const xdcValue = (BigInt(latestTx.value) / BigInt(10 ** 18)).toString();

          const message =
            `🔔 *New Transaction Detected*\n\n` +
            `Wallet: \`${address}\`\n` +
            `Network: ${networkLabel}\n` +
            `Hash: \`${latestTx.hash}\`\n` +
            `From: \`${latestTx.from}\`\n` +
            `To: \`${latestTx.to}\`\n` +
            `Value: **${xdcValue} XDC**\n` +
            `[View on Explorer](${explorerUrl})`;

          await sendTelegramNotification(Number(userId), message);
          logger.info('Notification sent', { userId, address, txHash: latestTx.hash });
        }

        lastSeenTx.set(key, latestTx.hash);
      } catch (err) {
        logger.error('Wallet poll failed', { userId, address, error: (err as Error).message });
      }
    }
  }

  logger.info('✅ Wallet poll complete');
}
```

**Note:** We need `getAllUsers` in the store. Add to `inMemoryStore.ts`:

```typescript
export function getAllUsers(): IterableIterator<[string, Map<string, StoredWallet>]> {
  return walletsByUser.entries();
}
```

**Step 2: Update `telegramNotify.ts`**

```typescript
import { Telegraf } from 'telegraf';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

let botInstance: Telegraf | null = null;

export function setBotInstance(bot: Telegraf): void {
  botInstance = bot;
}

export async function sendTelegramNotification(chatId: number, message: string): Promise<void> {
  logger.info('Sending Telegram notification', { chatId, messageLength: message.length });

  if (!botInstance) {
    logger.warn('No bot instance set, cannot send notification');
    return;
  }

  try {
    await botInstance.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Failed to send Telegram notification', { chatId, error: (err as Error).message });
  }
}
```

**Step 3: Wire bot instance in `index.ts`**

In `backend/src/index.ts`, after `const bot = createTelegramBot();`, add:

```typescript
import { setBotInstance } from './services/notification/telegramNotify';
setBotInstance(bot);
```

**Step 4: Update `jobs.ts`**

```typescript
import cron from 'node-cron';
import { logger } from '../utils/logger';
import { pollWallets } from './walletPoller';

export function startCronJobs(): void {
  // Poll wallets every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    logger.info('⏱️ Cron: wallet poll starting');
    try {
      await pollWallets();
    } catch (err) {
      logger.error('Cron wallet poll error', { error: (err as Error).message });
    }
  });

  logger.info('✅ Cron jobs started (wallet poll every 2 min)');
}
```

**Step 5: Commit**

```bash
git add backend/src/cron/ backend/src/services/notification/ backend/src/index.ts backend/src/services/storage/inMemoryStore.ts
git commit -m "feat(cron): wallet transaction polling with Telegram notifications"
```

---

## Task 7: Add `/tx` Command for Manual Transaction Lookup

**Objective:** Let users look up recent transactions for any address on-demand.

**Files:**
- Modify: `backend/src/services/commandHandler.ts`
- Modify: `backend/src/bots/telegram/index.ts`

**Step 1: Add `handleTx` to `commandHandler.ts`**

```typescript
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
    const networkLabel = result.network === 'testnet' ? 'Testnet' : 'Mainnet';

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
      return `${i + 1}. [${status}] ${xdcValue} XDC\n   \`${tx.hash}\`\n   [View](${explorerUrl})`;
    });

    return {
      text: `📜 Recent Transactions\n\nWallet: \`${result.address}\`\nNetwork: ${networkLabel}\n\n${lines.join('\n\n')}`,
    };
  } catch (err) {
    logger.error('Tx list fetch failed', { wallet, error: (err as Error).message });
    return { text: '❌ Failed to fetch transactions. Please try again later.' };
  }
}
```

Add to switch:
```typescript
    case '/tx':
      return await handleTx(userId, args);
```

Update `handleHelp` to include `/tx`.

**Step 2: Add `/tx` handler in `telegram/index.ts`**

```typescript
  bot.command('tx', (ctx) => {
    const messageText = ctx.message?.text ?? '/tx';
    return handleCommand(ctx, messageText);
  });
```

**Step 3: Commit**

```bash
git add backend/src/services/commandHandler.ts backend/src/bots/telegram/index.ts
git commit -m "feat(commands): add /tx for on-demand transaction lookup"
```

---

## Task 8: Add API Routes for Frontend Consumption

**Objective:** Expose blockchain data via REST so the Next.js frontend can consume it later.

**Files:**
- Create: `backend/src/routes/blockchain.ts`
- Modify: `backend/src/routes/index.ts`

**Step 1: Write `blockchain.ts`**

```typescript
import { Router } from 'express';
import { getBalance, getTxList } from '../services/blockchain';
import { isValidXdcAddress } from '../utils/network';
import { logger } from '../utils/logger';

const router = Router();

router.get('/balance/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    if (!isValidXdcAddress(address)) {
      res.status(400).json({ error: 'Invalid XDC address' });
      return;
    }
    const result = await getBalance(address);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/transactions/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    if (!isValidXdcAddress(address)) {
      res.status(400).json({ error: 'Invalid XDC address' });
      return;
    }
    const result = await getTxList(address);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
```

**Step 2: Update `routes/index.ts`**

```typescript
import { Router } from 'express';
import healthRouter from './health';
import blockchainRouter from './blockchain';
import whatsappRouter from '../bots/whatsapp';

const router = Router();

router.use('/health', healthRouter);
router.use('/api/blockchain', blockchainRouter);
router.use(whatsappRouter);

export default router;
```

**Step 3: Commit**

```bash
git add backend/src/routes/blockchain.ts backend/src/routes/index.ts
git commit -m "feat(api): add REST endpoints for balance and transaction queries"
```

---

## Task 9: Update README & Documentation

**Objective:** Document the new commands, env vars, and API endpoints.

**Files:**
- Modify: `backend/README.md` (or root `README.md`)

**Step 1: Update command table**

```markdown
| Command     | Description                          |
|-------------|--------------------------------------|
| `/start`    | Welcome message                      |
| `/help`     | Show commands                        |
| `/track`    | Track a wallet (xdc... or txdc...)   |
| `/untrack`  | Untrack a wallet                     |
| `/list`     | List tracked wallets with network    |
| `/balance`  | Get wallet balance                   |
| `/tx`       | Get recent transactions              |
| `/status`   | Get bot status                       |
```

**Step 2: Update env var table**

Add the new testnet variables to the env documentation.

**Step 3: Add API section**

```markdown
## API Endpoints

- `GET /api/blockchain/balance/:address` — Get balance for any xdc/txdc address
- `GET /api/blockchain/transactions/:address` — Get transaction list
```

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README with new commands, env vars, and API endpoints"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `xdc...` addresses route to mainnet APIs and show mainnet explorer links
- [ ] `txdc...` addresses route to testnet APIs and show testnet explorer links
- [ ] `/track txdc...` stores wallet with `network: 'testnet'`
- [ ] `/list` shows network label (Mainnet/Testnet) per wallet
- [ ] `/balance xdc...` and `/balance txdc...` return correct balances
- [ ] `/tx xdc...` and `/tx txdc...` return correct transactions
- [ ] Cron polls all tracked wallets every 2 minutes
- [ ] New transactions trigger Telegram notifications with correct explorer links
- [ ] API endpoints return JSON for both mainnet and testnet addresses
- [ ] Invalid addresses return validation error
- [ ] Fallback from Blockscout to XDCScan works when one is down

---

## Future Enhancements (Out of Scope)

- Persist `lastSeenTx` in Redis instead of memory (survives restarts)
- Migrate in-memory wallet store to MongoDB `Wallet` model
- Add price alerts via `Alert` model
- WebSocket push for real-time tx notifications
- Frontend pages for wallet dashboard and transaction history
- WhatsApp notification support
- Rate limiting on API endpoints
