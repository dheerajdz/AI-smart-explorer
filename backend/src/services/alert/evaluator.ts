import { IAlert, AlertModel } from '../../models/Alert';
import { logger } from '../../utils/logger';
import { getWalletBalance, getTransactions, getGasPrice } from '../blockchain';
import { getXdcPrice } from '../blockchain/priceService';
import { isValidXdcAddress } from '../../utils/network';

export interface EvaluationResult {
  triggered: boolean;
  data?: any;
  error?: string;
}

export async function evaluateAlert(alert: IAlert): Promise<EvaluationResult> {
  try {
    switch (alert.type) {
      case 'price_threshold':
        return await evaluatePriceThreshold(alert);
      case 'balance_change':
        return await evaluateBalanceChange(alert);
      case 'tx_incoming':
        return await evaluateTxIncoming(alert);
      case 'tx_outgoing':
        return await evaluateTxOutgoing(alert);
      case 'gas_spike':
        return await evaluateGasSpike(alert);
      case 'tx_failed':
        return await evaluateTxFailed(alert);
      case 'large_transfer':
        return await evaluateLargeTransfer(alert);
      default:
        return { triggered: false, error: 'Unknown alert type' };
    }
  } catch (err) {
    logger.error('[alertEvaluator] Evaluation failed', { alertId: alert._id, error: err });
    return { triggered: false, error: (err as Error).message };
  }
}

async function evaluatePriceThreshold(alert: IAlert): Promise<EvaluationResult> {
  const { condition } = alert;
  if (!condition.value || !condition.operator) {
    return { triggered: false, error: 'Invalid condition' };
  }

  const price = await getXdcPrice();
  const currentPrice = price.usd;
  const threshold = condition.value;

  let triggered = false;
  switch (condition.operator) {
    case 'above':
      triggered = currentPrice > threshold;
      break;
    case 'below':
      triggered = currentPrice < threshold;
      break;
    case 'equals':
      triggered = Math.abs(currentPrice - threshold) < 0.0001;
      break;
  }

  // Don't re-trigger if already fired for this condition state
  // Use lastTriggered to prevent spam
  if (triggered && alert.lastTriggered) {
    const minutesSinceLastTrigger = (Date.now() - alert.lastTriggered.getTime()) / (60 * 1000);
    const cooldownMinutes = alert.cooldownMinutes || 60;
    if (minutesSinceLastTrigger < cooldownMinutes) {
      return { triggered: false, data: { currentPrice, threshold, operator: condition.operator, note: 'In cooldown' } };
    }
  }

  return { triggered, data: { currentPrice, threshold, operator: condition.operator } };
}

async function evaluateBalanceChange(alert: IAlert): Promise<EvaluationResult> {
  const address = alert.condition.address;
  if (!address || !isValidXdcAddress(address)) {
    return { triggered: false, error: 'Invalid address' };
  }

  const network = alert.condition.network || 'mainnet';
  const balance = await getWalletBalance(address, network);
  const balanceXDC = parseFloat(balance.balanceXDC);

  // Get previous balance from alert metadata
  const previousBalance = alert.condition.previousBalance;
  
  // First check — store balance but don't trigger
  if (previousBalance === undefined) {
    alert.condition.previousBalance = balanceXDC;
    await AlertModel.updateOne(
      { _id: alert._id },
      { $set: { 'condition.previousBalance': balanceXDC } }
    );
    return { triggered: false, data: { balance: balanceXDC, address, note: 'First check — baseline stored' } };
  }

  // Only trigger if balance actually changed
  if (Math.abs(balanceXDC - previousBalance) > 0.0001) {
    // Update stored balance
    await AlertModel.updateOne(
      { _id: alert._id },
      { $set: { 'condition.previousBalance': balanceXDC } }
    );
    
    return {
      triggered: true,
      data: { 
        balance: balanceXDC, 
        previousBalance,
        change: (balanceXDC - previousBalance).toFixed(4),
        address 
      },
    };
  }

  return { triggered: false, data: { balance: balanceXDC, address } };
}

async function evaluateTxIncoming(alert: IAlert): Promise<EvaluationResult> {
  const address = alert.condition.address;
  if (!address || !isValidXdcAddress(address)) {
    return { triggered: false, error: 'Invalid address' };
  }

  const network = alert.condition.network || 'mainnet';
  const txs = await getTransactions(address, network, 1, 5);
  const recentTx = txs.transactions[0];

  if (!recentTx) {
    return { triggered: false };
  }

  const isIncoming = recentTx.to.toLowerCase() === address.toLowerCase();
  const txTime = new Date(recentTx.timestamp).getTime();
  const alertTime = alert.lastTriggered?.getTime() || alert.createdAt.getTime();

  if (isIncoming && txTime > alertTime) {
    return {
      triggered: true,
      data: {
        from: recentTx.from,
        value: (parseFloat(recentTx.value) / 1e18).toFixed(4),
        hash: recentTx.hash,
      },
    };
  }

  return { triggered: false };
}

async function evaluateTxOutgoing(alert: IAlert): Promise<EvaluationResult> {
  const address = alert.condition.address;
  if (!address || !isValidXdcAddress(address)) {
    return { triggered: false, error: 'Invalid address' };
  }

  const network = alert.condition.network || 'mainnet';
  const txs = await getTransactions(address, network, 1, 5);
  const recentTx = txs.transactions[0];

  if (!recentTx) {
    return { triggered: false };
  }

  const isOutgoing = recentTx.from.toLowerCase() === address.toLowerCase();
  const txTime = new Date(recentTx.timestamp).getTime();
  const alertTime = alert.lastTriggered?.getTime() || alert.createdAt.getTime();

  if (isOutgoing && txTime > alertTime) {
    return {
      triggered: true,
      data: {
        to: recentTx.to,
        value: (parseFloat(recentTx.value) / 1e18).toFixed(4),
        hash: recentTx.hash,
      },
    };
  }

  return { triggered: false };
}

async function evaluateGasSpike(alert: IAlert): Promise<EvaluationResult> {
  const { condition } = alert;
  if (!condition.value || !condition.operator) {
    return { triggered: false, error: 'Invalid condition' };
  }

  const network = condition.network || 'mainnet';
  const gas = await getGasPrice(network);
  const currentGas = parseFloat(gas.proposeGasPrice || gas.safeGasPrice || '0');
  const threshold = condition.value;

  let triggered = false;
  switch (condition.operator) {
    case 'above':
      triggered = currentGas > threshold;
      break;
    case 'below':
      triggered = currentGas < threshold;
      break;
    case 'equals':
      triggered = Math.abs(currentGas - threshold) < 1;
      break;
  }

  // Cooldown check
  if (triggered && alert.lastTriggered) {
    const minutesSinceLastTrigger = (Date.now() - alert.lastTriggered.getTime()) / (60 * 1000);
    const cooldownMinutes = alert.cooldownMinutes || 60;
    if (minutesSinceLastTrigger < cooldownMinutes) {
      return { triggered: false, data: { gasPrice: currentGas, threshold, operator: condition.operator, note: 'In cooldown' } };
    }
  }

  return { triggered, data: { gasPrice: currentGas, threshold, operator: condition.operator } };
}

async function evaluateTxFailed(alert: IAlert): Promise<EvaluationResult> {
  const address = alert.condition.address;
  if (!address || !isValidXdcAddress(address)) {
    return { triggered: false, error: 'Invalid address' };
  }

  const network = alert.condition.network || 'mainnet';
  const txs = await getTransactions(address, network, 1, 10);

  for (const tx of txs.transactions) {
    if (tx.status !== 'failed') continue;

    const txTime = new Date(tx.timestamp).getTime();
    const alertTime = alert.lastTriggered?.getTime() || alert.createdAt.getTime();

    if (txTime > alertTime) {
      return {
        triggered: true,
        data: {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: (parseFloat(tx.value) / 1e18).toFixed(4),
          gasUsed: tx.gasUsed,
        },
      };
    }
  }

  return { triggered: false };
}

async function evaluateLargeTransfer(alert: IAlert): Promise<EvaluationResult> {
  const address = alert.condition.address;
  if (!address || !isValidXdcAddress(address)) {
    return { triggered: false, error: 'Invalid address' };
  }

  const network = alert.condition.network || 'mainnet';
  const threshold = alert.condition.threshold || 1000;
  const txs = await getTransactions(address, network, 1, 10);

  for (const tx of txs.transactions) {
    const value = parseFloat(tx.value) / 1e18;
    const txTime = new Date(tx.timestamp).getTime();
    const alertTime = alert.lastTriggered?.getTime() || alert.createdAt.getTime();

    if (value >= threshold && txTime > alertTime) {
      return {
        triggered: true,
        data: {
          value: value.toFixed(4),
          from: tx.from,
          to: tx.to,
          hash: tx.hash,
        },
      };
    }
  }

  return { triggered: false };
}
