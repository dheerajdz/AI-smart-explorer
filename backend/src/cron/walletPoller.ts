import { logger } from '../utils/logger';
import { getTxList } from '../services/blockchain';
import * as store from '../services/storage/inMemoryStore';
import { sendTelegramNotification } from '../services/notification/telegramNotify';
import { getExplorerTxUrl } from '../utils/network';

const lastSeenTx = new Map<string, string>();

function getLastSeenKey(userId: string, address: string): string {
  return `${userId}:${address}`;
}

export async function pollWallets(): Promise<void> {
  logger.info('🔍 Starting wallet poll');

  for (const [userId, walletMap] of store.getAllUsers()) {
    for (const [address, wallet] of walletMap) {
      try {
        const result = await getTxList(address);
        if (result.transactions.length === 0) continue;

        const latestTx = result.transactions[0];
        const key = getLastSeenKey(userId, address);
        const previous = lastSeenTx.get(key);

        if (previous && previous !== latestTx.hash) {
          const explorerUrl = getExplorerTxUrl(result.network, latestTx.hash);
          const networkLabel = result.network === 'testnet' ? '🔵 Testnet' : '🟢 Mainnet';
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
