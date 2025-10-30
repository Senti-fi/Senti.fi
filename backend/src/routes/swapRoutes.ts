import { Router } from 'express';
import { swapTokens, swapWebhook } from '../controllers/swapController';

const router = Router();
router.post('/swap', swapTokens);        
router.post('/webhook', swapWebhook); 

export default router;