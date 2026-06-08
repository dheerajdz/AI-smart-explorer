import { IAlert } from '../../models/Alert';
import { logger } from '../../utils/logger';
import { getBotInstance } from '../notification/telegramNotify';
import { sendWhatsAppMessage } from '../../bots/whatsapp/sendMessage';
import { formatAlertMessage } from './alertService';

export async function sendAlertNotification(alert: IAlert, data: any): Promise<void> {
  const message = formatAlertMessage(alert, data);
  const { platform, chatId } = alert;

  try {
    switch (platform) {
      case 'telegram': {
        const bot = getBotInstance();
        if (bot) {
          await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
          logger.warn('[alertNotifier] Telegram bot not available');
        }
        break;
      }

      case 'whatsapp':
        await sendWhatsAppMessage(chatId, message);
        break;

      case 'slack':
        // TODO: Implement Slack DM notification
        logger.info('[alertNotifier] Slack notification not yet implemented', { alertId: alert._id });
        break;

      case 'x':
        // TODO: Implement X DM notification
        logger.info('[alertNotifier] X notification not yet implemented', { alertId: alert._id });
        break;

      default:
        logger.warn('[alertNotifier] Unknown platform', { platform, alertId: alert._id });
    }

    logger.info('[alertNotifier] Notification sent', {
      alertId: alert._id,
      platform,
      chatId,
    });
  } catch (err) {
    logger.error('[alertNotifier] Failed to send notification', {
      alertId: alert._id,
      platform,
      error: err,
    });
  }
}
