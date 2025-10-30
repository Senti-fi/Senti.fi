import { Router } from 'express';
import {
  deposit,
  //withdrawInstructions,
  withdraw,
  getWithdrawOptions,
} from '../controllers/vaultController';
import {
  getUserVaults,
  getVaultDetails,
  getVaultTransactions,
  getVaultRewards,
} from '../controllers/vaultQueriesContoller';
import {
  getUserVaultsWithDetails,
  getVaultsByToken,
  getAllVaultPlans,
} from '../controllers/vaultAggregate';
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();
router.use(authMiddleware);
router.post('/deposit', deposit);
router.get('/withdraw-options', getWithdrawOptions)
//router.post('/withdraw/instructions', withdrawInstructions);
router.post('/withdraw',  withdraw);
router.get('/vaultsplan', getAllVaultPlans);
router.get('/token/:token', getVaultsByToken);
router.get('/user/:userId/details', getUserVaultsWithDetails);
router.get('/user/:userId', getUserVaults);
router.get('/transactions/:vaultPubkey', getVaultTransactions);
router.get('/rewards/:vaultPubkey', getVaultRewards);
router.get('/:vaultPubkey', getVaultDetails);

export default router;