import { Router } from 'express';
import { deposit, withdrawInstructions, withdraw } from '../controllers/vaultController';
import { getUserVaults, getVaultDetails, getVaultTransactions, getVaultRewards } from '../controllers/vaultQueriesContoller';
import authMiddleware from '../middlewares/authMiddleware';
import { getUserVaultsWithDetails, getVaultsByToken, getAllVaultPlans } from '../controllers/vaultAggregate';

const router = Router();

router.use(authMiddleware);
router.get('/user/:userId', getUserVaults);
router.get('/user/:userId/details', getUserVaultsWithDetails);
router.get('/transactions/:vaultPubkey', getVaultTransactions);
router.get('/rewards/:vaultPubkey', getVaultRewards);
router.get('/token/:token', getVaultsByToken);
router.get('/vaultsplan',  getAllVaultPlans); 
router.get('/:vaultPubkey', getVaultDetails);
export default router;