import { Router } from 'express';
import { getUserTransactions } from '../controllers/transactionController';
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();

router.get('/transactions', authMiddleware, getUserTransactions);

export default router;