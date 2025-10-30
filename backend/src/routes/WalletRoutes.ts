import { Router } from 'express';
import {
  send,
  receive,
  monitor,
  sendQr,
} from '../controllers/walletController';
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();

router.post('/send', authMiddleware, send);
router.post('/receive', authMiddleware, receive);
router.post('/monitor', authMiddleware, monitor);
router.post('/send-qr', authMiddleware, sendQr);

export default router;