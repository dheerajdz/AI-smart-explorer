import { AlertModel, IAlert, AlertType, AlertStatus, AlertPlatform } from '../../models/Alert';
import { logger } from '../../utils/logger';
import { isValidXdcAddress } from '../../utils/network';

export interface CreateAlertInput {
  userId: string;
  platform: AlertPlatform;
  chatId: string;
  type: AlertType;
  name: string;
  condition: IAlert['condition'];
  maxTriggers?: number;
  cooldownMinutes?: number;
}

export async function createAlert(input: CreateAlertInput): Promise<IAlert> {
  const alert = new AlertModel({
    ...input,
    status: 'active',
    isActive: true,
    triggerCount: 0,
    cooldownMinutes: input.cooldownMinutes ?? 60,
  });

  await alert.save();
  logger.info('[alertService] Alert created', { alertId: alert._id, userId: input.userId, type: input.type });
  return alert;
}

export async function listAlerts(userId: string): Promise<IAlert[]> {
  return AlertModel.find({ userId }).sort({ createdAt: -1 }).lean() as unknown as Promise<IAlert[]>;
}

export async function getAlertById(alertId: string, userId: string): Promise<IAlert | null> {
  return AlertModel.findOne({ _id: alertId, userId }).lean() as unknown as Promise<IAlert | null>;
}

export async function deleteAlert(alertId: string, userId: string): Promise<boolean> {
  const result = await AlertModel.deleteOne({ _id: alertId, userId });
  return result.deletedCount > 0;
}

export async function pauseAlert(alertId: string, userId: string): Promise<boolean> {
  const result = await AlertModel.updateOne(
    { _id: alertId, userId },
    { $set: { status: 'paused', isActive: false } }
  );
  return result.modifiedCount > 0;
}

export async function pauseAllAlerts(userId: string): Promise<number> {
  const result = await AlertModel.updateMany(
    { userId, status: 'active', isActive: true },
    { $set: { status: 'paused', isActive: false } }
  );
  logger.info('[alertService] Paused all alerts', { userId, modifiedCount: result.modifiedCount });
  return result.modifiedCount || 0;
}

export async function resumeAlert(alertId: string, userId: string): Promise<boolean> {
  const result = await AlertModel.updateOne(
    { _id: alertId, userId },
    { $set: { status: 'active', isActive: true } }
  );
  return result.modifiedCount > 0;
}

export async function getActiveAlerts(): Promise<IAlert[]> {
  return AlertModel.find({ status: 'active', isActive: true });
}

export async function markAlertTriggered(alertId: string): Promise<void> {
  const now = new Date();
  await AlertModel.updateOne(
    { _id: alertId },
    {
      $set: { lastTriggered: now },
      $inc: { triggerCount: 1 },
    }
  );
  logger.info('[alertService] Alert marked triggered', { alertId, lastTriggered: now });
}

export async function checkAlertCooldown(alert: IAlert): Promise<boolean> {
  if (!alert.lastTriggered) return true;
  const cooldownMinutes = Math.max(alert.cooldownMinutes || 60, 5); // Minimum 5 min cooldown
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const lastTriggeredTime = alert.lastTriggered instanceof Date ? alert.lastTriggered.getTime() : new Date(alert.lastTriggered).getTime();
  const timeSince = Date.now() - lastTriggeredTime;
  logger.debug('[checkAlertCooldown]', { alertId: alert._id, cooldownMinutes, timeSinceMs: timeSince, lastTriggered: alert.lastTriggered });
  return timeSince >= cooldownMs;
}

export async function checkMaxTriggers(alert: IAlert): Promise<boolean> {
  if (!alert.maxTriggers) return true;
  return alert.triggerCount < alert.maxTriggers;
}

export function formatAlertMessage(alert: IAlert, data: any): string {
  const { type, name, condition } = alert;

  switch (type) {
    case 'price_threshold':
      return `🔔 *Price Alert: ${name}*\n\n` +
        `XDC price is now **${condition.operator} ${condition.value} ${condition.currency}**\n\n` +
        `Current: ${data.currentPrice} ${condition.currency}`;

    case 'balance_change':
      return `🔔 *Balance Alert: ${name}*\n\n` +
        `Wallet \`${condition.address}\` balance changed\n\n` +
        `Previous: **${data.previousBalance} XDC**\n` +
        `New: **${data.balance} XDC**\n` +
        `Change: **${data.change} XDC**`;

    case 'tx_incoming':
      return `🔔 *Incoming Transaction: ${name}*\n\n` +
        `Wallet \`${condition.address}\` received a transaction\n\n` +
        `From: \`${data.from}\`\n` +
        `Value: **${data.value} XDC**`;

    case 'tx_outgoing':
      return `🔔 *Outgoing Transaction: ${name}*\n\n` +
        `Wallet \`${condition.address}\` sent a transaction\n\n` +
        `To: \`${data.to}\`\n` +
        `Value: **${data.value} XDC**`;

    case 'gas_spike':
      return `🔔 *Gas Spike Alert: ${name}*\n\n` +
        `Gas price is now **${condition.operator} ${condition.value} ${condition.unit}**\n\n` +
        `Current: ${data.gasPrice} ${condition.unit}`;

    case 'large_transfer':
      return `🔔 *Large Transfer Alert: ${name}*\n\n` +
        `Transfer **${condition.operator} ${condition.threshold} XDC** detected\n\n` +
        `Value: **${data.value} XDC**\n` +
        `From: \`${data.from}\`\n` +
        `To: \`${data.to}\``;

    case 'tx_failed':
      return `🔔 *Failed Transaction Alert: ${name}*\n\n` +
        `A transaction failed for wallet \`${condition.address}\`\n\n` +
        `Hash: \`${data.hash}\`\n` +
        `Value: **${data.value} XDC**\n` +
        `Gas Used: ${data.gasUsed}\n\n` +
        `[View on Explorer](https://xdcscan.io/tx/${data.hash})`;

    default:
      return `🔔 *Alert Triggered: ${name}*\n\nCondition met.`;
  }
}
