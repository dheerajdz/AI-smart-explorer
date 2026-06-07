import 'dotenv/config';
import { logger } from '../utils/logger';
import { getTransactions } from '../services/blockchain';
import { TrackedWalletModel } from '../models/TrackedWallet';
import { WalletPollStateModel } from '../models/WalletPollState';
import { getAlertsForTrigger, recordTrigger } from '../services/alertService';
import { dispatchAlert } from '../services/notification/alertDispatcher';
import { Network } from '../utils/network';
import { connectMongo } from '../database';

/**
 * Poll all tracked wallets for new transactions.
 * Evaluate active alerts and dispatch notifications.
 * Poll state is persisted in MongoDB (survives restart).
 */
export async function pollWallets(): Promise<void> {
  logger.info('[walletPoller] Starting poll cycle');

  const wallets = await TrackedWalletModel.findAllActive();
  logger.info('[walletPoller] Wallets to poll', { count: wallets.length });

  for (const wallet of wallets) {
    try {
      await pollWallet(wallet.address, wallet.network as Network, wallet.userId, wallet.platform);
    } catch (err) {
      logger.error('[walletPoller] Failed to poll wallet', {
        userId: wallet.userId,
        address: wallet.address,
        error: (err as Error).message,
      });
    }
  }

  logger.info('[walletPoller] Poll cycle complete');
}

async function pollWallet(
  address: string,
  network: Network,
  userId: string,
  platform: string
): Promise<void> {
  const normalizedAddress = address.toLowerCase();

  // Fetch recent transactions (last 10 to catch up if we missed some)
  const txResponse = await getTransactions(address, network, 1, 10);
  const transactions = txResponse.transactions || [];

  if (transactions.length === 0) {
    await WalletPollStateModel.upsert(normalizedAddress, network);
    return;
  }

  // Get last known tx hash from persistent state
  const pollState = await WalletPollStateModel.findByAddress(normalizedAddress, network);
  const lastKnownHash = pollState?.lastTxHash;

  // Find new transactions (those before the last known hash in the list)
  let newTransactions: any[] = [];
  if (!lastKnownHash) {
    // First time polling this wallet — don't alert on historical txs
    logger.info('[walletPoller] First poll for wallet, skipping historical txs', {
      address: normalizedAddress,
    });
    newTransactions = [];
  } else {
    const lastKnownIndex = transactions.findIndex((tx) => tx.hash === lastKnownHash);
    if (lastKnownIndex === -1) {
      // Last known tx not found — might be too old. Only alert on the very latest.
      logger.info('[walletPoller] Last known tx not in fetched batch, treating only latest as new', {
        address: normalizedAddress,
        lastKnownHash,
        fetchedCount: transactions.length,
      });
      newTransactions = [transactions[0]];
    } else {
      newTransactions = transactions.slice(0, lastKnownIndex);
    }
  }

  // Update poll state with the latest tx hash (always do this, even if no new txs)
  const latestHash = transactions[0]?.hash;
  if (latestHash) {
    await WalletPollStateModel.upsert(normalizedAddress, network, latestHash);
    logger.info('[walletPoller] Poll state updated', {
      address: normalizedAddress,
      latestHash,
    });
  }

  if (newTransactions.length === 0) {
    logger.info('[walletPoller] No new transactions', { address: normalizedAddress });
    return;
  }

  logger.info('[walletPoller] New transactions detected', {
    address: normalizedAddress,
    network,
    count: newTransactions.length,
  });

  // Process new transactions and evaluate alerts
  for (const tx of newTransactions.reverse()) {
    // Ensure tx has a hash
    const txHash = tx.hash || tx.transactionHash || '';
    if (!txHash) continue;

    // ── Evaluate new_tx alerts ──
    const newTxAlerts = await getAlertsForTrigger(normalizedAddress, network, 'new_tx');
    logger.info('[walletPoller] Evaluating new_tx alerts', {
      address: normalizedAddress,
      alertCount: newTxAlerts.length,
    });
    for (const alert of newTxAlerts) {
      await dispatchAlert(alert, { ...tx, hash: txHash });
      await recordTrigger(alert._id!);
    }

    // ── Evaluate failed_tx alerts ──
    const isFailed = isTransactionFailed(tx);
    if (isFailed) {
      const failedAlerts = await getAlertsForTrigger(normalizedAddress, network, 'failed_tx');
      for (const alert of failedAlerts) {
        await dispatchAlert(alert, { ...tx, hash: txHash });
        await recordTrigger(alert._id!);
      }
    }

    // ── Evaluate contract_deploy alerts ──
    const isContractDeploy = isContractDeployment(tx);
    if (isContractDeploy) {
      const deployAlerts = await getAlertsForTrigger(normalizedAddress, network, 'contract_deploy');
      for (const alert of deployAlerts) {
        await dispatchAlert(alert, { ...tx, hash: txHash });
        await recordTrigger(alert._id!);
      }
    }
  }
}

function isTransactionFailed(tx: any): boolean {
  // XDCScan returns status in various formats
  if (tx.status === '0' || tx.status === 0) return true;
  if (tx.isError === '1' || tx.isError === 1) return true;
  if (tx.txreceipt_status === '0' || tx.txreceipt_status === 0) return true;
  if (tx.errCode || tx.error) return true;
  return false;
}

function isContractDeployment(tx: any): boolean {
  // Contract deployment: to is null/empty/0x, or contractAddress is present
  if (!tx.to || tx.to === '0x' || tx.to === '0x0000000000000000000000000000000000000000') return true;
  if (tx.contractAddress && tx.contractAddress !== '0x') return true;
  if (tx.input && tx.input.length > 2 && (!tx.to || tx.to === '')) return true;
  return false;
}

// ── Standalone entrypoint for PM2 cron ──
async function main() {
  try {
    await connectMongo();
    await pollWallets();
    process.exit(0);
  } catch (err) {
    logger.error('[walletPoller] Fatal error', { error: (err as Error).message });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
