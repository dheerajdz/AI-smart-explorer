import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { AlertModel } from '../../models/Alert';
import { sendAlertNotification } from '../alert/notifier';

export interface WebhookPayload {
  event: 'price_change' | 'gas_spike' | 'tx_failed' | 'large_transfer' | 'balance_change';
  data: {
    address?: string;
    value?: number;
    currency?: string;
    network?: string;
    txHash?: string;
    from?: string;
    to?: string;
    gasPrice?: number;
    threshold?: number;
    [key: string]: any;
  };
  timestamp: string;
  source: string;
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const payload: WebhookPayload = req.body;

  logger.info('[webhook] Received webhook', {
    event: payload.event,
    source: payload.source,
    timestamp: payload.timestamp,
  });

  try {
    switch (payload.event) {
      case 'price_change':
        await handlePriceChangeWebhook(payload);
        break;
      case 'gas_spike':
        await handleGasSpikeWebhook(payload);
        break;
      case 'tx_failed':
        await handleTxFailedWebhook(payload);
        break;
      case 'large_transfer':
        await handleLargeTransferWebhook(payload);
        break;
      case 'balance_change':
        await handleBalanceChangeWebhook(payload);
        break;
      default:
        logger.warn('[webhook] Unknown event type', { event: payload.event });
        res.status(400).json({ success: false, error: 'Unknown event type' });
        return;
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (err) {
    logger.error('[webhook] Failed to process webhook', { error: err });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function handlePriceChangeWebhook(payload: WebhookPayload): Promise<void> {
  const { value, currency } = payload.data;

  const alerts = await AlertModel.find({
    type: 'price_threshold',
    status: 'active',
    isActive: true,
  });

  for (const alert of alerts) {
    const { operator, value: threshold } = alert.condition;
    let triggered = false;

    switch (operator) {
      case 'above':
        triggered = (value || 0) > (threshold || 0);
        break;
      case 'below':
        triggered = (value || 0) < (threshold || 0);
        break;
      case 'equals':
        triggered = Math.abs((value || 0) - (threshold || 0)) < 0.0001;
        break;
    }

    if (triggered) {
      await sendAlertNotification(alert, {
        currentPrice: value,
        threshold,
        operator,
        currency,
      });

      alert.lastTriggered = new Date();
      alert.triggerCount += 1;
      await alert.save();
    }
  }
}

async function handleGasSpikeWebhook(payload: WebhookPayload): Promise<void> {
  const { gasPrice, network } = payload.data;

  const alerts = await AlertModel.find({
    type: 'gas_spike',
    status: 'active',
    isActive: true,
  });

  for (const alert of alerts) {
    const { operator, value: threshold } = alert.condition;
    let triggered = false;

    switch (operator) {
      case 'above':
        triggered = (gasPrice || 0) > (threshold || 0);
        break;
      case 'below':
        triggered = (gasPrice || 0) < (threshold || 0);
        break;
    }

    if (triggered) {
      await sendAlertNotification(alert, {
        gasPrice,
        threshold,
        operator,
        network,
      });

      alert.lastTriggered = new Date();
      alert.triggerCount += 1;
      await alert.save();
    }
  }
}

async function handleTxFailedWebhook(payload: WebhookPayload): Promise<void> {
  const { address, txHash, from, to, value } = payload.data;

  const alerts = await AlertModel.find({
    type: 'tx_failed',
    status: 'active',
    isActive: true,
    'condition.address': address,
  });

  for (const alert of alerts) {
    await sendAlertNotification(alert, {
      txHash,
      from,
      to,
      value,
      address,
    });

    alert.lastTriggered = new Date();
    alert.triggerCount += 1;
    await alert.save();
  }
}

async function handleLargeTransferWebhook(payload: WebhookPayload): Promise<void> {
  const { address, value, from, to, txHash } = payload.data;

  const alerts = await AlertModel.find({
    type: 'large_transfer',
    status: 'active',
    isActive: true,
    'condition.address': address,
  });

  for (const alert of alerts) {
    const threshold = alert.condition.threshold || 1000;

    if ((value || 0) >= threshold) {
      await sendAlertNotification(alert, {
        value,
        threshold,
        from,
        to,
        txHash,
        address,
      });

      alert.lastTriggered = new Date();
      alert.triggerCount += 1;
      await alert.save();
    }
  }
}

async function handleBalanceChangeWebhook(payload: WebhookPayload): Promise<void> {
  const { address, value, network } = payload.data;

  const alerts = await AlertModel.find({
    type: 'balance_change',
    status: 'active',
    isActive: true,
    'condition.address': address,
  });

  for (const alert of alerts) {
    const previousBalance = alert.condition.previousBalance || 0;
    const change = (value || 0) - previousBalance;

    if (Math.abs(change) > 0.0001) {
      await sendAlertNotification(alert, {
        balance: value,
        previousBalance,
        change: change.toFixed(4),
        address,
        network,
      });

      alert.condition.previousBalance = value;
      alert.lastTriggered = new Date();
      alert.triggerCount += 1;
      await alert.save();
    }
  }
}
