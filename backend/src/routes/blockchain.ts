import { Router } from 'express';
import { getBalance, getTxList } from '../services/blockchain';
import { isValidXdcAddress } from '../utils/network';

const router = Router();

router.get('/balance/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    if (!isValidXdcAddress(address)) {
      res.status(400).json({ error: 'Invalid XDC address' });
      return;
    }
    const result = await getBalance(address);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/transactions/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    if (!isValidXdcAddress(address)) {
      res.status(400).json({ error: 'Invalid XDC address' });
      return;
    }
    const result = await getTxList(address);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
