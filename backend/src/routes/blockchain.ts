import { Router } from 'express';
import { getWalletBalance, getTransactions, getGasPrice, getBlockByNumber } from '../services/blockchain';
import { isValidXdcAddress, detectNetwork } from '../utils/network';

const router = Router();

/**
 * GET /api/blockchain/balance/:address
 * Returns wallet balance for mainnet or testnet (auto-detected from prefix).
 */
router.get('/balance/:address', async (req, res, next) => {
  try {
    const { address } = req.params;

    if (!isValidXdcAddress(address)) {
      res.status(400).json({ error: 'Invalid address. Must start with xdc, txdc, or 0x (42 chars).' });
      return;
    }

    const network = detectNetwork(address);
    const data = await getWalletBalance(address, network);

    res.json({
      success: true,
      address: data.address,
      balance: data.balanceXDC,
      network: data.network,
      explorerUrl: data.explorerUrl,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/blockchain/transactions/:address
 * Returns transaction list for mainnet or testnet.
 */
router.get('/transactions/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    const page = parseInt(req.query.page as string, 10) || 1;
    const offset = parseInt(req.query.offset as string, 10) || 10;

    if (!isValidXdcAddress(address)) {
      res.status(400).json({ error: 'Invalid address. Must start with xdc, txdc, or 0x (42 chars).' });
      return;
    }

    const network = detectNetwork(address);
    const data = await getTransactions(address, network, page, offset);

    res.json({
      success: true,
      address: data.address,
      transactions: data.transactions,
      totalCount: data.totalCount,
      network: data.network,
      explorerUrl: data.explorerUrl,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/blockchain/gas
 * Returns current gas price.
 */
router.get('/gas', async (req, res, next) => {
  try {
    const network = (req.query.network as string) || 'mainnet';
    const data = await getGasPrice(network as any);

    res.json({
      success: true,
      safeGasPrice: data.safeGasPrice,
      proposeGasPrice: data.proposeGasPrice,
      fastGasPrice: data.fastGasPrice,
      network: data.network,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/blockchain/block/:blockNumber
 * Returns block information.
 */
router.get('/block/:blockNumber', async (req, res, next) => {
  try {
    const { blockNumber } = req.params;
    const network = (req.query.network as string) || 'mainnet';
    const data = await getBlockByNumber(blockNumber, network as any);

    res.json({
      success: true,
      blockNumber: data.blockNumber,
      hash: data.hash,
      miner: data.miner,
      transactions: data.transactions,
      gasUsed: data.gasUsed,
      gasLimit: data.gasLimit,
      timestamp: data.timestamp,
      network: data.network,
      explorerUrl: data.explorerUrl,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
