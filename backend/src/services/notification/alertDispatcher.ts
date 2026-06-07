import { logger } from '../../utils/logger';
import { IAlert, AlertType } from '../../models/Alert';
import { sendTelegramNotification } from './telegramNotify';
import { sendWhatsAppNotification } from './whatsappNotify';
import { getTxExplorerUrl, getAddressExplorerUrl } from '../../utils/network';

export async function dispatchAlert(alert: IAlert, tx: any): Promise<void> {
  const message = formatAlertMessage(alert, tx);

  try {
    if (alert.platform === 'telegram') {
      await sendTelegramNotification(alert.userId, message);
    } else if (alert.platform === 'whatsapp') {
      await sendWhatsAppNotification(alert.userId, message);
    }
    logger.info('[alertDispatcher] Notification sent', {
      alertId: alert._id,
      userId: alert.userId,
      platform: alert.platform,
      type: alert.type,
    });
  } catch (err) {
    logger.error('[alertDispatcher] Failed to send notification', {
      alertId: alert._id,
      userId: alert.userId,
      platform: alert.platform,
      error: (err as Error).message,
    });
  }
}

function formatAlertMessage(alert: IAlert, tx: any): string {
  const explorerUrl = getTxExplorerUrl(tx.hash, alert.network || 'mainnet');
  const value = tx.value ? (Number(tx.value) / 1e18).toFixed(6) : '0';
  const networkLabel = alert.network === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet';

  switch (alert.type) {
    case 'new_tx':
      return (
        `🔔 *New Transaction Alert*\n\n` +
        `Wallet: \`${alert.address}\`\n` +
        `Network: ${networkLabel}\n` +
        `Hash: \`${tx.hash}\`\n` +
        `Value: *${value} XDC*\n` +
        `Status: ${tx.status === 'success' || tx.status === '1' || tx.txreceipt_status === '1' ? '✅ Success' : '❌ Failed'}\n\n` +
        `[View on Explorer](${explorerUrl})`
      );

    case 'failed_tx':
      return (
        `❌ *Failed Transaction Alert*\n\n` +
        `Wallet: \`${alert.address}\`\n` +
        `Network: ${networkLabel}\n` +
        `Hash: \`${tx.hash}\`\n` +
        `Value: *${value} XDC*\n` +
        `Gas Used: ${tx.gasUsed || tx.gasUsed || 'N/A'}\n` +
        `This transaction failed on-chain.\n\n` +
        `[View on Explorer](${explorerUrl})`
      );

    case 'contract_deploy':
      const contractAddress = tx.contractAddress || 'Pending verification';
      return (
        `📜 *Contract Deployment Alert*\n\n` +
        `Deployer: \`${alert.address}\`\n` +
        `Network: ${networkLabel}\n` +
        `Tx Hash: \`${tx.hash}\`\n` +
        `Contract: \`${contractAddress}\`\n` +
        `Gas Used: ${tx.gasUsed || 'N/A'}\n\n` +
        `[View on Explorer](${explorerUrl})`
      );

    default:
      return `🔔 Alert triggered for ${alert.type}\n\nTx: ${tx.hash}`;
  }
}
