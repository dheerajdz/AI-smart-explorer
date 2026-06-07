import { logger } from '../utils/logger';
import { AlertModel, IAlert, AlertType, AlertPlatform } from '../models/Alert';
import { Network, detectNetwork } from '../utils/network';

export interface CreateAlertInput {
  userId: string;
  platform: AlertPlatform;
  type: AlertType;
  address?: string;
  network?: Network;
  condition?: Record<string, any>;
  cooldownMinutes?: number;
}

export async function createAlert(input: CreateAlertInput): Promise<IAlert> {
  let network: Network | undefined = input.network;
  if (input.address && !network) {
    network = detectNetwork(input.address);
  }

  const alert = await AlertModel.create({
    ...input,
    address: input.address?.toLowerCase(),
    network,
    isActive: true,
    cooldownMinutes: input.cooldownMinutes ?? 5,
  });

  logger.info('[alertService] Alert created', {
    alertId: alert._id,
    userId: input.userId,
    type: input.type,
    address: input.address,
  });

  return alert;
}

export async function listAlerts(userId: string, platform: AlertPlatform): Promise<IAlert[]> {
  return AlertModel.findByUserId(userId, platform);
}

export async function listActiveAlerts(userId: string, platform: AlertPlatform): Promise<IAlert[]> {
  return AlertModel.findActiveByUserId(userId, platform);
}

export async function deleteAlert(alertId: string, userId: string): Promise<boolean> {
  const success = await AlertModel.deleteById(alertId, userId);
  if (success) {
    logger.info('[alertService] Alert deleted', { alertId, userId });
  }
  return success;
}

export async function toggleAlert(alertId: string, userId: string, isActive: boolean): Promise<boolean> {
  return AlertModel.toggleActive(alertId, userId, isActive);
}

export async function getAlertsForTrigger(
  address: string,
  network: Network,
  type: AlertType
): Promise<IAlert[]> {
  return AlertModel.findActiveForTrigger(address, network, type);
}

export async function recordTrigger(alertId: string): Promise<void> {
  await AlertModel.updateLastTriggered(alertId);
  logger.info('[alertService] Trigger recorded', { alertId });
}
