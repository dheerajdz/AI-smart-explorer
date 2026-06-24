import { logger } from '../utils/logger';
import { getTransactions } from '../services/blockchain';
import * as store from '../services/storage/inMemoryStore';
import { sendTelegramNotification } from '../services/notification/telegramNotify';
import { getTxExplorerUrl } from '../utils/network';
import { withDistributedLock } from './alertPoller';

const lastSeenTx = new Map<string, string>(); // userId:address -> last tx hash

export async function pollWallets(): Promise<void> {
  await withDistributedLock('walletPoller', async () => {
    logger.info('[walletPoller] Starting poll cycle');

    const users = store.getAllUsers();

    for (const userId of users) {
      const wallets = store.getWalletsForUser(userId);

      for (const wallet of wallets) {
        try {
          const txResponse = await getTransactions(wallet.address, wallet.network, 1, 1);
          const latestTx = txResponse.transactions[0];

          if (!latestTx) continue;

          const key = `${userId}:${wallet.address}`;
          const previousHash = lastSeenTx.get(key);

          if (previousHash && previousHash !== latestTx.hash) {
            // New transaction detected
            const explorerUrl = getTxExplorerUrl(wallet.network, latestTx.hash);
            const value = Number(latestTx.value) / 1e18;

            await sendTelegramNotification(
              userId,
              `🔔 *New Transaction Detected*\n\n` +
                `Wallet: \`${wallet.address}\`\n` +
                `Network: ${wallet.network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet'}\n` +
                `Hash: \`${latestTx.hash.slice(0, 20)}...\`\n` +
                `Value: **${value} XDC**\n` +
                `Status: ${latestTx.status === 'success' ? '✅ Success' : '❌ Failed'}\n\n` +
                `[View on Explorer](${explorerUrl})`,
            );

            logger.info('[walletPoller] New tx notification sent', {
              userId,
              address: wallet.address,
              hash: latestTx.hash,
            });
          }

          lastSeenTx.set(key, latestTx.hash);
        } catch (err) {
          logger.error('[walletPoller] Failed to poll wallet', {
            userId,
            address: wallet.address,
            error: err,
          });
        }
      }
    }

    logger.info('[walletPoller] Poll cycle complete');
  });
}
